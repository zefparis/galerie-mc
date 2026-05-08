import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json()
  const { rows } = await pool.query(
    `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
     image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11
     WHERE id=$12 RETURNING *`,
    [
      b.title,
      b.year,
      b.technique,
      b.dimensions || '',
      b.description || '',
      b.imageUrl,
      b.imagePublicId || '',
      b.price || null,
      b.priceStatus || 'sur_demande',
      b.featured || false,
      b.order || 0,
      params.id,
    ]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const r = rows[0]
  return NextResponse.json({
    id: r.id,
    title: r.title,
    year: r.year,
    technique: r.technique,
    dimensions: r.dimensions || '',
    description: r.description || '',
    imageUrl: r.image_url,
    imagePublicId: r.image_public_id || '',
    price: r.price ? Number(r.price) : undefined,
    priceStatus: r.price_status,
    featured: r.featured,
    order: r.order,
    createdAt: r.created_at,
  })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await pool.query('DELETE FROM paintings WHERE id=$1', [params.id])
  return NextResponse.json({ success: true })
}
