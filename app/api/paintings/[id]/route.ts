import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { mapPaintingRow } from '@/lib/mappers'
import { paintingBodySchema, uuidSchema } from '@/lib/validation'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const b = paintingBodySchema.parse(await req.json())
    const values = [
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
      parsedId.data,
    ]
    let rows
    try {
      ;({ rows } = await pool.query(
        `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
         image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11,
         image_width=$12, image_height=$13, category=$14
         WHERE id=$15 RETURNING *`,
        values
      ))
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
      ;({ rows } = await pool.query(
        `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
         image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11
         WHERE id=$12 RETURNING *`,
        [...values.slice(0, 11), parsedId.data]
      ))
    }
    if (rows.length === 0) return notFound('Tableau introuvable')
    return NextResponse.json(mapPaintingRow(rows[0]))
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const { rows } = await pool.query(
      'DELETE FROM paintings WHERE id=$1 RETURNING id',
      [parsedId.data]
    )
    if (rows.length === 0) return notFound('Tableau introuvable')
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
