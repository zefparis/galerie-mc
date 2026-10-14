import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isAdminRequest, requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { mapEventRow } from '@/lib/mappers'
import { eventBodySchema } from '@/lib/validation'

// La première photo sert de couverture — synchronisé ici pour que la
// règle tienne quel que soit le client.
function coverFor(b: { coverUrl: string; coverPublicId: string; images?: { url: string; publicId?: string }[] }) {
  if (b.images && b.images.length > 0) {
    return { url: b.images[0].url, publicId: b.images[0].publicId || '' }
  }
  return { url: b.coverUrl, publicId: b.coverPublicId }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const all = isAdminRequest(req) && searchParams.get('all') === 'true'

    const query = all
      ? 'SELECT * FROM events ORDER BY event_date DESC NULLS LAST, "order" ASC'
      : 'SELECT * FROM events WHERE published = true ORDER BY event_date DESC NULLS LAST, "order" ASC'

    const { rows } = await pool.query(query)
    return NextResponse.json(rows.map(mapEventRow))
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = eventBodySchema.parse(await req.json())
    const cover = coverFor(b)
    const images = b.images ?? []
    let rows
    try {
      ;({ rows } = await pool.query(
        `INSERT INTO events (title, description, location, event_date, cover_url, cover_public_id, media, images, published, "order", translations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          b.title,
          b.description,
          b.location,
          b.eventDate || null,
          cover.url,
          cover.publicId,
          JSON.stringify(b.media),
          JSON.stringify(images),
          b.published,
          b.order,
          JSON.stringify(b.translations || {}),
        ]
      ))
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
      ;({ rows } = await pool.query(
        `INSERT INTO events (title, description, location, event_date, cover_url, cover_public_id, media, published, "order")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          b.title,
          b.description,
          b.location,
          b.eventDate || null,
          cover.url,
          cover.publicId,
          JSON.stringify(b.media),
          b.published,
          b.order,
        ]
      ))
    }
    return NextResponse.json(mapEventRow(rows[0]))
  } catch (err) {
    return handleRouteError(err)
  }
}
