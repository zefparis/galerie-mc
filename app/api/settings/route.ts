import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { settingsBodySchema } from '@/lib/validation'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import { settingsFrenchFields, withStaleMarks } from '@/lib/translations-core'
import { GallerySettings, Translations } from '@/lib/types'

// Indispensable : sans force-dynamic, Next.js pré-rend statiquement GET /api/settings
// au build et le CDN Vercel rejette alors PUT /api/settings en 405 Method Not Allowed.
export const dynamic = 'force-dynamic'

// Lecture publique : les visiteurs ont besoin du nom, de la présentation, etc.
export async function GET() {
  try {
    const { rows } = await pool.query('SELECT data, translations FROM settings WHERE id = 1')
    if (!rows.length) return NextResponse.json(DEFAULT_SETTINGS)
    return NextResponse.json({
      ...DEFAULT_SETTINGS,
      ...(rows[0].data as Partial<GallerySettings>),
      translations: (rows[0].translations as Translations) || {},
    })
  } catch (err) {
    // Table ou colonne pas encore créée : valeurs par défaut plutôt que 500.
    const code = (err as { code?: string })?.code
    if (code === '42P01' || code === '42703') {
      try {
        const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
        if (!rows.length) return NextResponse.json(DEFAULT_SETTINGS)
        return NextResponse.json({
          ...DEFAULT_SETTINGS,
          ...(rows[0].data as Partial<GallerySettings>),
        })
      } catch {
        return NextResponse.json(DEFAULT_SETTINGS)
      }
    }
    return handleRouteError(err)
  }
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = settingsBodySchema.parse(await req.json())
    const { translations, ...data } = b

    // Si le français a changé, les traductions corrigées à la main passent
    // « À mettre à jour » sans rien effacer.
    let merged: Translations = (translations as Translations) || {}
    try {
      const prev = await pool.query('SELECT data, translations FROM settings WHERE id = 1')
      if (prev.rows.length) {
        const base = (translations as Translations) ?? (prev.rows[0].translations as Translations)
        merged = withStaleMarks(
          base,
          settingsFrenchFields({ ...DEFAULT_SETTINGS, ...(prev.rows[0].data as Partial<GallerySettings>) }),
          settingsFrenchFields({ ...DEFAULT_SETTINGS, ...data })
        )
      }
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
    }

    try {
      await pool.query(
        `INSERT INTO settings (id, data, translations, updated_at)
         VALUES (1, $1, $2, now())
         ON CONFLICT (id) DO UPDATE SET data = $1, translations = $2, updated_at = now()`,
        [JSON.stringify(data), JSON.stringify(merged)]
      )
    } catch (err) {
      // Colonne translations absente : on enregistre quand même le reste.
      if ((err as { code?: string })?.code !== '42703') throw err
      await pool.query(
        `INSERT INTO settings (id, data, updated_at)
         VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
        [JSON.stringify(data)]
      )
    }
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...data, translations: merged })
  } catch (err) {
    return handleRouteError(err)
  }
}
