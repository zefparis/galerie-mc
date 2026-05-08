import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function initTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paintings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      year INTEGER,
      technique TEXT,
      dimensions TEXT,
      description TEXT,
      image_url TEXT NOT NULL,
      image_public_id TEXT,
      price NUMERIC,
      price_status TEXT DEFAULT 'sur_demande',
      featured BOOLEAN DEFAULT false,
      "order" INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `)
}

export async function GET() {
  await initTable()
  const { rows } = await pool.query(
    'SELECT * FROM paintings ORDER BY featured DESC, "order" ASC'
  )
  // Map snake_case to camelCase for frontend compatibility
  const paintings = rows.map((r: any) => ({
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
  }))
  return NextResponse.json(paintings)
}

export async function POST(req: NextRequest) {
  await initTable()
  const b = await req.json()
  const { rows } = await pool.query(
    `INSERT INTO paintings (id, title, year, technique, dimensions, description, image_url, image_public_id, price, price_status, featured, "order")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      b.id,
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
    ]
  )
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
