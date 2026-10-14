import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError, notFound } from '@/lib/api'
import { uuidSchema } from '@/lib/validation'
import {
  TARGET_LOCALES,
  fieldStatus,
  markCorrected,
  planField,
  settingsFrenchFields,
  translateFields,
} from '@/lib/translations-core'
import { getTranslator, isTranslationConfigured } from '@/lib/translate'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import type { GallerySettings, TargetLocale, Translations } from '@/lib/types'

// Une requête = un contenu (éventuellement une seule langue/quelques
// champs, côté « Traduire tout » le client envoie UNE langue par requête).
// Le budget interne arrête de lancer de nouveaux champs avant la limite :
// les champs restants sont signalés et le client relance — chaque champ
// réussi est écrit au fil de l'eau, rien n'est perdu sur une coupure.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const TIME_BUDGET_MS = 45_000

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

// Sauvegarde de l'état translations avant la première écriture de la
// requête (source 'auto' — distincte des sauvegardes d'import manuel).
// Best-effort : si la table n'existe pas encore (migration en retard),
// on continue sans bloquer la traduction.
async function backupBeforeWrite(entity: Loaded) {
  try {
    await pool.query(
      'INSERT INTO translation_backups (batch_id, table_name, entity_id, translations, source) VALUES ($1,$2,$3,$4,$5)',
      [
        crypto.randomUUID(),
        entity.table,
        entity.id,
        JSON.stringify(entity.translations || {}),
        'auto',
      ]
    )
  } catch (err) {
    if ((err as { code?: string })?.code !== '42P01') throw err
  }
}

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

// État des traductions pour l'accueil admin : nombre de contenus ayant au
// moins un champ à traduire ou à mettre à jour + présence de la clé API.
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const needsWork = (french: Record<string, string>, translations: Translations) =>
      TARGET_LOCALES.some((locale) =>
        Object.entries(french).some(
          ([field, text]) =>
            planField(translations, field, text, locale) !== 'skip' ||
            fieldStatus(translations, field, locale, text) === 'a_mettre_a_jour'
        )
      )

    const [{ rows: paintings }, { rows: events }, { rows: settingsRows }] =
      await Promise.all([
        pool.query('SELECT title, description, translations FROM paintings'),
        pool.query('SELECT title, description, location, translations FROM events'),
        pool.query('SELECT data, translations FROM settings WHERE id = 1'),
      ])

    let pending = 0
    for (const p of paintings)
      if (
        needsWork(
          { title: p.title || '', description: p.description || '' },
          p.translations || {}
        )
      )
        pending++
    for (const e of events)
      if (
        needsWork(
          {
            title: e.title || '',
            description: e.description || '',
            location: e.location || '',
          },
          e.translations || {}
        )
      )
        pending++
    const settings = {
      ...DEFAULT_SETTINGS,
      ...((settingsRows[0]?.data || {}) as Partial<GallerySettings>),
    }
    if (needsWork(settingsFrenchFields(settings), settingsRows[0]?.translations || {}))
      pending++

    return NextResponse.json({ ok: true, configured: isTranslationConfigured(), pending })
  } catch (err) {
    // Colonne translations absente : l'admin reste utilisable, on signale
    // simplement qu'on ne connaît pas l'état.
    if ((err as { code?: string })?.code === '42703')
      return NextResponse.json({
        ok: true,
        configured: isTranslationConfigured(),
        pending: null,
      })
    return handleRouteError(err)
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

    const startedAt = Date.now()
    let backedUp = false
    const persistStep = async (t: Translations) => {
      // Un champ vient d'être écrit : sauvegarde initiale une seule fois,
      // puis écriture au fil de l'eau — une coupure ne perd rien.
      if (!backedUp) {
        backedUp = true
        await backupBeforeWrite(entity)
      }
      await persist(entity, t)
    }

    const report = await translateFields(
      entity.french,
      entity.translations,
      locales,
      getTranslator(),
      { force: b.force, fields: b.fields, budgetMs: TIME_BUDGET_MS, onProgress: persistStep }
    )

    try {
      await persist(entity, report.translations)
    } catch (err) {
      if ((err as { code?: string })?.code === '42703') return migrationNeeded()
      throw err
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(
      `[translate] ${b.entity}${b.id ? ` ${b.id.slice(0, 8)}` : ''} ` +
        `[${locales.join(',')}] — ${seconds}s, ${report.translated} traduit(s), ` +
        `${report.errors} échec(s), ${report.remaining} restant(s)`
    )

    return NextResponse.json({
      ok: report.errors === 0 && report.remaining === 0,
      translated: report.translated,
      skipped: report.skipped,
      stale: report.stale,
      errors: report.errors,
      remaining: report.remaining,
      failures: report.failures,
      translations: report.translations,
    })
  } catch (err) {
    // Écriture incrémentale : la colonne peut manquer sur un ancien schéma.
    if ((err as { code?: string })?.code === '42703') return migrationNeeded()
    return handleRouteError(err)
  }
}
