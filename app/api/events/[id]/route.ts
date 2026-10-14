import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isAdminRequest, requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { mapEventRow } from '@/lib/mappers'
import { eventBodySchema, uuidSchema } from '@/lib/validation'
import { eventFrenchFields, withStaleMarks } from '@/lib/translations-core'
import type { Translations } from '@/lib/types'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const admin = isAdminRequest(req)
    const { rows } = await pool.query(
      `SELECT * FROM events WHERE id=$1 ${admin ? '' : 'AND published = true'}`,
      [parsedId.data]
    )
    if (rows.length === 0) return notFound('Événement introuvable')
    return NextResponse.json(mapEventRow(rows[0]))
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const b = eventBodySchema.parse(await req.json())

    // Français modifié → les traductions corrigées passent « À mettre à jour ».
    let mergedTranslations: Translations | undefined = b.translations as Translations | undefined
    let prevImages: unknown[] | undefined
    try {
      const prev = await pool.query(
        'SELECT title, description, location, images, translations FROM events WHERE id=$1',
        [parsedId.data]
      )
      if (prev.rows.length) {
        prevImages = Array.isArray(prev.rows[0].images) ? prev.rows[0].images : []
        const base = mergedTranslations ?? (prev.rows[0].translations as Translations)
        mergedTranslations = withStaleMarks(
          base,
          eventFrenchFields(prev.rows[0]),
          eventFrenchFields({
            title: b.title,
            description: b.description,
            location: b.location,
            images: b.images,
          })
        )
      }
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
    }

    // Un client qui n'envoie pas `images` n'efface pas les photos.
    const images = b.images ?? prevImages ?? []
    const cover =
      images.length > 0
        ? { url: (images[0] as { url: string }).url, publicId: (images[0] as { publicId?: string }).publicId || '' }
        : { url: b.coverUrl, publicId: b.coverPublicId }

    const run = (withTranslations: boolean, withImages: boolean) =>
      pool.query(
        `UPDATE events SET title=$1, description=$2, location=$3, event_date=$4,
         cover_url=$5, cover_public_id=$6, media=$7, published=$8, "order"=$9
         ${withImages ? ', images=$12' : ''}
         ${withTranslations ? ', translations=$11' : ''}
         WHERE id=$10 RETURNING *`,
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
          parsedId.data,
          JSON.stringify(mergedTranslations || {}),
          JSON.stringify(images),
        ]
      )
    let rows
    try {
      ;({ rows } = await run(true, true))
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
      // Ancienne base sans colonne images : on garde les traductions.
      try {
        ;({ rows } = await run(true, false))
      } catch (err2) {
        if ((err2 as { code?: string })?.code !== '42703') throw err2
        ;({ rows } = await run(false, false))
      }
    }
    if (rows.length === 0) return notFound('Événement introuvable')
    return NextResponse.json(mapEventRow(rows[0]))
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
      'DELETE FROM events WHERE id=$1 RETURNING id',
      [parsedId.data]
    )
    if (rows.length === 0) return notFound('Événement introuvable')
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
