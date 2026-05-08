import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function initTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      event_date DATE,
      cover_url TEXT,
      cover_public_id TEXT,
      media JSONB DEFAULT '[]',
      published BOOLEAN DEFAULT false,
      "order" INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `)
}

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

export async function GET(req: NextRequest) {
  await initTable()
  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'

  const query = all
    ? 'SELECT * FROM events ORDER BY event_date DESC NULLS LAST, "order" ASC'
    : 'SELECT * FROM events WHERE published = true ORDER BY event_date DESC NULLS LAST, "order" ASC'

  const { rows } = await pool.query(query)
  return NextResponse.json(rows.map(mapRow))
}

export async function POST(req: NextRequest) {
  await initTable()
  const b = await req.json()
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, location, event_date, cover_url, cover_public_id, media, published, "order")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
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
    ]
  )
  return NextResponse.json(mapRow(rows[0]))
}
