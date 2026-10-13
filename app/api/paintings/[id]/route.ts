import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { mapPaintingRow } from '@/lib/mappers'
import { paintingBodySchema, uuidSchema } from '@/lib/validation'
import { withStaleMarks } from '@/lib/translations-core'
import type { Translations } from '@/lib/types'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const b = paintingBodySchema.parse(await req.json())

    // Ancien français + traductions : si le titre/la description change,
    // les traductions corrigées à la main passent « À mettre à jour ».
    let mergedTranslations: Translations | undefined = b.translations as Translations | undefined
    try {
      const prev = await pool.query(
        'SELECT title, description, translations FROM paintings WHERE id=$1',
        [parsedId.data]
      )
      if (prev.rows.length) {
        const base = mergedTranslations ?? (prev.rows[0].translations as Translations)
        mergedTranslations = withStaleMarks(
          base,
          { title: prev.rows[0].title || '', description: prev.rows[0].description || '' },
          { title: b.title, description: b.description }
        )
      }
    } catch (err) {
      // Colonne translations absente : on continue sans.
      if ((err as { code?: string })?.code !== '42703') throw err
    }

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
    const valuesT = [...values.slice(0, 14), JSON.stringify(mergedTranslations || {}), parsedId.data]
    let rows
    try {
      ;({ rows } = await pool.query(
        `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
         image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11,
         image_width=$12, image_height=$13, category=$14, translations=$15
         WHERE id=$16 RETURNING *`,
        valuesT
      ))
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
      try {
        ;({ rows } = await pool.query(
          `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
           image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11,
           image_width=$12, image_height=$13
           WHERE id=$14 RETURNING *`,
          values.slice(0, 14)
        ))
      } catch (err2) {
        if ((err2 as { code?: string })?.code !== '42703') throw err2
        ;({ rows } = await pool.query(
          `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
           image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11
           WHERE id=$12 RETURNING *`,
          [...values.slice(0, 11), parsedId.data]
        ))
      }
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
