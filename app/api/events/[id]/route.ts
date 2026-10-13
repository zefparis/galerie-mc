import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isAdminRequest, requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { mapEventRow } from '@/lib/mappers'
import { eventBodySchema, uuidSchema } from '@/lib/validation'

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
    const { rows } = await pool.query(
      `UPDATE events SET title=$1, description=$2, location=$3, event_date=$4,
       cover_url=$5, cover_public_id=$6, media=$7, published=$8, "order"=$9
       WHERE id=$10 RETURNING *`,
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
        parsedId.data,
      ]
    )
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
