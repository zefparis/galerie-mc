import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError, notFound } from '@/lib/api'
import { uuidSchema } from '@/lib/validation'
import {
  TARGET_LOCALES,
  markCorrected,
  settingsFrenchFields,
  translateFields,
} from '@/lib/translations-core'
import { getTranslator, isTranslationConfigured } from '@/lib/translate'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import type { GallerySettings, TargetLocale, Translations } from '@/lib/types'

const bodySchema = z.object({
  entity: z.enum(['painting', 'event', 'settings']),
  id: uuidSchema.optional(),
  locales: z.array(z.enum(['en', 'es', 'de'])).max(3).optional(),
  fields: z.array(z.string().max(80)).max(30).optional(),
  force: z.boolean().optional().default(false),
  // Corrections manuelles : { langue: { champ: texte } } → statut « Corrigé
  // par vous », jamais écrasé par la suite.
  corrections: z
    .record(z.enum(['en', 'es', 'de']), z.record(z.string().max(80), z.string().max(20000)))
    .optional(),
})

interface Loaded {
  table: 'paintings' | 'events' | 'settings'
  id: string
  french: Record<string, string>
  translations: Translations
}

async function persist(entity: Loaded, translations: Translations) {
  if (entity.table === 'settings') {
    await pool.query('UPDATE settings SET translations=$1, updated_at=now() WHERE id=1', [
      JSON.stringify(translations),
    ])
  } else {
    await pool.query(`UPDATE ${entity.table} SET translations=$1 WHERE id=$2`, [
      JSON.stringify(translations),
      entity.id,
    ])
  }
}

const migrationNeeded = () =>
  NextResponse.json(
    {
      error: 'migration-needed',
      detail: 'Colonne translations absente — lancez npm run migrate.',
    },
    { status: 503 }
  )

async function loadEntity(
  entity: 'painting' | 'event' | 'settings',
  id?: string
): Promise<Loaded | null> {
  if (entity === 'painting') {
    if (!id) return null
    const { rows } = await pool.query(
      'SELECT title, description, translations FROM paintings WHERE id=$1',
      [id]
    )
    if (!rows.length) return null
    return {
      table: 'paintings',
      id,
      french: { title: rows[0].title || '', description: rows[0].description || '' },
      translations: rows[0].translations || {},
    }
  }
  if (entity === 'event') {
    if (!id) return null
    const { rows } = await pool.query(
      'SELECT title, description, location, translations FROM events WHERE id=$1',
      [id]
    )
    if (!rows.length) return null
    return {
      table: 'events',
      id,
      french: {
        title: rows[0].title || '',
        description: rows[0].description || '',
        location: rows[0].location || '',
      },
      translations: rows[0].translations || {},
    }
  }
  const { rows } = await pool.query('SELECT data, translations FROM settings WHERE id = 1')
  const settings = {
    ...DEFAULT_SETTINGS,
    ...((rows[0]?.data || {}) as Partial<GallerySettings>),
  }
  return {
    table: 'settings',
    id: '1',
    french: settingsFrenchFields(settings),
    translations: (rows[0]?.translations as Translations) || {},
  }
}

// Traduction automatique des contenus — réservée à l'admin, serveur uniquement.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = bodySchema.parse(await req.json())
    const locales = (b.locales?.length ? b.locales : TARGET_LOCALES) as TargetLocale[]

    // Correction manuelle seule : pas besoin de clé API.
    if (b.corrections) {
      const entity = await loadEntity(b.entity, b.id)
      if (!entity) return notFound('Contenu introuvable')
      let translations = entity.translations || {}
      for (const locale of locales) {
        const corr = b.corrections[locale]
        if (!corr) continue
        for (const [field, text] of Object.entries(corr)) {
          translations = markCorrected(
            translations,
            field,
            locale,
            text,
            entity.french[field] ?? ''
          )
        }
      }
      try {
        await persist(entity, translations)
      } catch (err) {
        if ((err as { code?: string })?.code === '42703') return migrationNeeded()
        throw err
      }
      return NextResponse.json({ ok: true, translations })
    }

    if (!isTranslationConfigured()) {
      return NextResponse.json(
        { error: 'Traduction non configurée (clé API manquante).' },
        { status: 503 }
      )
    }

    const entity = await loadEntity(b.entity, b.id)
    if (!entity) return notFound('Contenu introuvable')

    const report = await translateFields(
      entity.french,
      entity.translations,
      locales,
      getTranslator(),
      { force: b.force, fields: b.fields }
    )

    try {
      await persist(entity, report.translations)
    } catch (err) {
      if ((err as { code?: string })?.code === '42703') return migrationNeeded()
      throw err
    }

    return NextResponse.json({
      ok: report.errors === 0,
      translated: report.translated,
      skipped: report.skipped,
      stale: report.stale,
      errors: report.errors,
      translations: report.translations,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
