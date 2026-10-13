import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { mapPaintingRow } from '@/lib/mappers'
import { paintingBodySchema } from '@/lib/validation'

export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM paintings ORDER BY featured DESC, "order" ASC'
    )
    return NextResponse.json(rows.map(mapPaintingRow))
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = paintingBodySchema.parse(await req.json())
    const values = [
      b.id ?? null,
      b.title,
      b.year ?? null,
      b.technique ?? null,
      b.dimensions,
      b.description,
      b.imageUrl,
      b.imagePublicId,
      b.price ?? null,
      b.priceStatus,
      b.featured,
      b.order,
      b.imageWidth ?? null,
      b.imageHeight ?? null,
      b.category,
    ]
    try {
      const { rows } = await pool.query(
        `INSERT INTO paintings (id, title, year, technique, dimensions, description, image_url, image_public_id, price, price_status, featured, "order", image_width, image_height, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        values
      )
      return NextResponse.json(mapPaintingRow(rows[0]))
    } catch (err) {
      // Colonnes récentes pas encore créées : repli sans elles.
      if ((err as { code?: string })?.code !== '42703') throw err
      const { rows } = await pool.query(
        `INSERT INTO paintings (id, title, year, technique, dimensions, description, image_url, image_public_id, price, price_status, featured, "order")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        values.slice(0, 12)
      )
      return NextResponse.json(mapPaintingRow(rows[0]))
    }
  } catch (err) {
    return handleRouteError(err)
  }
}
