import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { settingsBodySchema } from '@/lib/validation'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'

// Lecture publique : les visiteurs ont besoin du nom, de la présentation, etc.
export async function GET() {
  try {
    const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
    if (!rows.length) return NextResponse.json(DEFAULT_SETTINGS)
    return NextResponse.json({
      ...DEFAULT_SETTINGS,
      ...(rows[0].data as Partial<GallerySettings>),
    })
  } catch (err) {
    // Table pas encore créée : on sert les valeurs par défaut plutôt que 500.
    if ((err as { code?: string })?.code === '42P01') {
      return NextResponse.json(DEFAULT_SETTINGS)
    }
    return handleRouteError(err)
  }
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = settingsBodySchema.parse(await req.json())
    await pool.query(
      `INSERT INTO settings (id, data, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
      [JSON.stringify(b)]
    )
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...b })
  } catch (err) {
    return handleRouteError(err)
  }
}
