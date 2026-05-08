import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    location: r.location || '',
    eventDate: r.event_date ? r.event_date.toISOString().split('T')[0] : '',
    coverUrl: r.cover_url || '',
    coverPublicId: r.cover_public_id || '',
    media: r.media || [],
    published: r.published,
    order: r.order,
    createdAt: r.created_at,
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { rows } = await pool.query('SELECT * FROM events WHERE id=$1', [params.id])
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(mapRow(rows[0]))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json()
  const { rows } = await pool.query(
    `UPDATE events SET title=$1, description=$2, location=$3, event_date=$4,
     cover_url=$5, cover_public_id=$6, media=$7, published=$8, "order"=$9
     WHERE id=$10 RETURNING *`,
    [
      b.title,
      b.description || '',
      b.location || '',
      b.eventDate || null,
      b.coverUrl || '',
      b.coverPublicId || '',
      JSON.stringify(b.media || []),
      b.published || false,
      b.order || 0,
      params.id,
    ]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(mapRow(rows[0]))
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await pool.query('DELETE FROM events WHERE id=$1', [params.id])
  return NextResponse.json({ success: true })
}
