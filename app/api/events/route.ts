import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isAdminRequest, requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { mapEventRow } from '@/lib/mappers'
import { eventBodySchema } from '@/lib/validation'

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
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, location, event_date, cover_url, cover_public_id, media, published, "order")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        b.title,
        b.description,
        b.location,
        b.eventDate || null,
        b.coverUrl,
        b.coverPublicId,
        JSON.stringify(b.media),
        b.published,
        b.order,
      ]
    )
    return NextResponse.json(mapEventRow(rows[0]))
  } catch (err) {
    return handleRouteError(err)
  }
}
