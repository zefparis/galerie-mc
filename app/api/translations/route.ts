import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import {
  TARGET_LOCALES,
  eventFrenchFields,
  fieldMeta,
  markRelu,
  paintingFrenchFields,
  settingsFrenchFields,
} from '@/lib/translations-core'
import { DEFAULT_SETTINGS } from '@/lib/storage'
import type { GallerySettings, TargetLocale, Translations } from '@/lib/types'

// Import/export manuel des traductions — réservé à l'admin.
// L'export fige tous les textes français ; l'import n'écrit que des
// traductions faites à la main (statut « relu », jamais écrasées ensuite).
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const FIELD_LABELS: Record<string, string> = {
  title: 'Titre',
  description: 'Description',
  location: 'Lieu',
  bioShort: 'Accroche (ligne sous le nom)',
  bio: 'Présentation de l’artiste',
  processText: 'Démarche picturale',
  tagline: 'Phrase d’accroche (accueil)',
  presentation: 'Texte de présentation (accueil)',
  notice_accroche: 'Accroche de la fiche œuvre',
  notice_texte: 'Texte de la fiche œuvre',
  notice_ambiance: 'Ambiance et intérieur',
  notice_matiere: 'Matière et technique',
}

const TYPE_LABELS: Record<string, string> = {
  toile: 'Toile',
  evenement: 'Événement',
  reglages: 'Réglages',
}

const fieldLabel = (f: string) =>
  FIELD_LABELS[f] || (f.startsWith('photo:') ? `Légende photo ${f.slice(6)}` : f)

// ─── Chargement des contenus ───────────────────────────────────────────────

interface EntityRow {
  type: 'toile' | 'evenement' | 'reglages'
  table: 'paintings' | 'events' | 'settings'
  id: string
  label: string
  french: Record<string, string>
  translations: Translations
}

async function loadCatalog(): Promise<Map<string, EntityRow>> {
  const [{ rows: paintings }, { rows: events }, { rows: settingsRows }] =
    await Promise.all([
      pool.query(
        'SELECT id, title, description, notice, translations FROM paintings ORDER BY "order" ASC, created_at ASC'
      ),
      pool.query(
        'SELECT id, title, description, location, images, translations FROM events ORDER BY event_date DESC NULLS LAST, "order" ASC'
      ),
      pool.query('SELECT data, translations FROM settings WHERE id = 1'),
    ])

  const map = new Map<string, EntityRow>()
  for (const p of paintings) {
    map.set(`toile:${p.id}`, {
      type: 'toile',
      table: 'paintings',
      id: p.id,
      label: p.title || '(sans titre)',
      french: paintingFrenchFields(p),
      translations: p.translations || {},
    })
  }
  for (const e of events) {
    map.set(`evenement:${e.id}`, {
      type: 'evenement',
      table: 'events',
      id: e.id,
      label: e.title || '(sans titre)',
      french: eventFrenchFields(e),
      translations: e.translations || {},
    })
  }
  const settings = {
    ...DEFAULT_SETTINGS,
    ...((settingsRows[0]?.data || {}) as Partial<GallerySettings>),
  }
  map.set('reglages:1', {
    type: 'reglages',
    table: 'settings',
    id: '1',
    label: 'Réglages du site',
    french: settingsFrenchFields(settings),
    translations: (settingsRows[0]?.translations as Translations) || {},
  })
  return map
}

// ─── Export ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const catalog = await loadCatalog()
    const contenus = Array.from(catalog.values())
      .map((e) => ({
        type: e.type,
        id: e.id,
        label: e.label,
        champs: (Object.entries(e.french) as [string, string][])
          .filter(([, fr]) => fr.trim())
          .map(([champ, fr]) => ({
            champ,
            nom: fieldLabel(champ),
            fr,
            en: '',
            es: '',
            de: '',
          })),
      }))
      .filter((e) => e.champs.length > 0)

    const payload = {
      version: 1,
      genereLe: new Date().toISOString(),
      mode_emploi:
        'Traduisez chaque texte français (fr) dans les cases en, es et de. ' +
        'Laissez vide ce que vous ne voulez pas traduire. Ne modifiez ni ' +
        '« type », ni « id », ni « champ » : ils permettent de ranger chaque ' +
        'traduction au bon endroit. Puis importez ce fichier dans l’admin.',
      contenus,
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="textes-a-traduire.json"',
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}

// ─── Import ────────────────────────────────────────────────────────────────

const champSchema = z.object({
  champ: z.string().max(80),
  nom: z.string().max(200).optional(),
  fr: z.string().max(20000).optional(),
  en: z.string().max(20000).optional(),
  es: z.string().max(20000).optional(),
  de: z.string().max(20000).optional(),
})

const importSchema = z.object({
  action: z.enum(['preview', 'apply', 'undo']),
  contenus: z
    .array(
      z.object({
        type: z.enum(['toile', 'evenement', 'reglages']),
        id: z.string().max(80),
        label: z.string().max(200).optional(),
        champs: z.array(champSchema).max(60),
      })
    )
    .max(500)
    .optional(),
})

interface ImportPlan {
  entity: EntityRow
  writes: { field: string; locale: TargetLocale; text: string }[]
}

interface ImportReview {
  plans: ImportPlan[]
  erreurs: string[]
  avertissements: string[]
  total: number
  parLangue: Record<TargetLocale, number>
  conserves: number
}

/** Valide le fichier et prépare les écritures — aucune écriture ici. */
function reviewImport(
  contenus: z.infer<typeof importSchema>['contenus'],
  catalog: Map<string, EntityRow>
): ImportReview {
  const review: ImportReview = {
    plans: [],
    erreurs: [],
    avertissements: [],
    total: 0,
    parLangue: { en: 0, es: 0, de: 0 },
    conserves: 0,
  }

  for (const item of contenus || []) {
    const key = `${item.type}:${item.id}`
    const entity = catalog.get(key)
    const nom = `${TYPE_LABELS[item.type]} « ${item.label || item.id} »`
    if (!entity) {
      review.erreurs.push(`${nom} : élément introuvable sur le site.`)
      continue
    }
    const allowed = new Set(Object.keys(entity.french))
    const plan: ImportPlan = { entity, writes: [] }
    for (const c of item.champs) {
      if (!allowed.has(c.champ)) {
        review.erreurs.push(`${nom} : champ « ${c.champ} » inconnu (attendus : ${Array.from(allowed).map(fieldLabel).join(', ')}).`)
        continue
      }
      if (!(entity.french[c.champ] || '').trim()) {
        review.avertissements.push(
          `${nom} : le champ « ${fieldLabel(c.champ)} » est vide en français — ignoré.`
        )
        continue
      }
      let wrote = false
      for (const locale of TARGET_LOCALES) {
        const text = (c[locale] || '').trim()
        if (!text) continue
        // Jamais au-dessus d'une correction saisie à la main dans l'admin.
        if (fieldMeta(entity.translations, c.champ, locale)?.statut === 'corrige') {
          review.conserves++
          continue
        }
        plan.writes.push({ field: c.champ, locale, text })
        review.parLangue[locale]++
        review.total++
        wrote = true
      }
      if (!wrote) {
        const toutesCorrigees = TARGET_LOCALES.every(
          (l) => fieldMeta(entity.translations, c.champ, l)?.statut === 'corrige'
        )
        if (!toutesCorrigees) {
          review.avertissements.push(
            `${nom} : « ${fieldLabel(c.champ)} » sans traduction remplie — ignoré.`
          )
        }
      }
    }
    if (plan.writes.length > 0) review.plans.push(plan)
  }
  return review
}

/** Restaure un backup sans perdre les corrections faites après l'import. */
function mergePreserveCorrige(backup: Translations, current: Translations): Translations {
  const restored: Translations = backup ? JSON.parse(JSON.stringify(backup)) : {}
  for (const locale of TARGET_LOCALES) {
    const texts = current?.[locale] || {}
    for (const field of Object.keys(texts)) {
      const meta = fieldMeta(current, field, locale)
      if (meta?.statut !== 'corrige') continue
      restored[locale] = { ...(restored[locale] || {}), [field]: texts[field] }
      restored._meta = { ...(restored._meta || {}) }
      restored._meta![field] = { ...(restored._meta![field] || {}), [locale]: meta }
    }
  }
  return restored
}

const migrationNeeded = () =>
  NextResponse.json(
    {
      error:
        'La sauvegarde des traductions n’est pas encore prête côté base de données — ' +
        'prévenez la personne qui s’occupe du site (migration à lancer).',
    },
    { status: 503 }
  )

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsed = importSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Le fichier n’est pas lisible — vérifiez que c’est bien le fichier ' +
            'exporté depuis cet écran, avec les traductions remplies.',
        },
        { status: 422 }
      )
    }
    const { action, contenus } = parsed.data

    // ── Annuler le dernier import ──
    if (action === 'undo') {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const { rows: batches } = await client.query(
          `SELECT batch_id, max(created_at) AS dernier
           FROM translation_backups WHERE source='import' GROUP BY batch_id
           ORDER BY dernier DESC LIMIT 1`
        )
        if (batches.length === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({
            ok: false,
            error: 'Il n’y a aucun import à annuler.',
          })
        }
        const batchId = batches[0].batch_id
        const { rows } = await client.query(
          'SELECT table_name, entity_id, translations FROM translation_backups WHERE batch_id=$1',
          [batchId]
        )
        let restored = 0
        for (const row of rows) {
          // Liste blanche : le nom de table ne vient jamais du client, mais
          // on le contrôle quand même avant de l'injecter dans le SQL.
          if (!['paintings', 'events', 'settings'].includes(row.table_name)) continue
          const id = row.table_name === 'settings' ? 1 : row.entity_id
          const { rows: cur } = await client.query(
            `SELECT translations FROM ${row.table_name} WHERE id=$1`,
            [id]
          )
          if (!cur.length) continue
          const merged = mergePreserveCorrige(row.translations, cur[0].translations || {})
          await client.query(`UPDATE ${row.table_name} SET translations=$1 WHERE id=$2`, [
            JSON.stringify(merged),
            id,
          ])
          restored++
        }
        await client.query('DELETE FROM translation_backups WHERE batch_id=$1', [batchId])
        await client.query('COMMIT')
        return NextResponse.json({
          ok: true,
          restored,
          message: `Dernier import annulé — ${restored} contenu${restored > 1 ? 's' : ''} restauré${restored > 1 ? 's' : ''}. Vos corrections à la main sont conservées.`,
        })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        if ((err as { code?: string })?.code === '42P01') return migrationNeeded()
        throw err
      } finally {
        client.release()
      }
    }

    // ── preview / apply ──
    if (!contenus || contenus.length === 0) {
      return NextResponse.json(
        { error: 'Le fichier ne contient aucun texte à importer.' },
        { status: 422 }
      )
    }

    const catalog = await loadCatalog()
    const review = reviewImport(contenus, catalog)

    if (action === 'preview' || review.erreurs.length > 0) {
      return NextResponse.json({
        ok: review.erreurs.length === 0,
        total: review.total,
        parLangue: review.parLangue,
        conserves: review.conserves,
        erreurs: review.erreurs,
        avertissements: review.avertissements,
      })
    }

    // apply : sauvegarde de l'existant puis écriture, le tout en transaction.
    const batchId = crypto.randomUUID()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const { entity, writes } of review.plans) {
        await client.query(
          'INSERT INTO translation_backups (batch_id, table_name, entity_id, translations) VALUES ($1,$2,$3,$4)',
          [batchId, entity.table, entity.id, JSON.stringify(entity.translations || {})]
        )
        let translations = entity.translations
        for (const w of writes) {
          translations = markRelu(translations, w.field, w.locale, w.text, entity.french[w.field])
        }
        await client.query(
          `UPDATE ${entity.table} SET translations=$1 WHERE id=$2`,
          [JSON.stringify(translations), entity.table === 'settings' ? 1 : entity.id]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      if ((err as { code?: string })?.code === '42P01') return migrationNeeded()
      throw err
    } finally {
      client.release()
    }

    return NextResponse.json({
      ok: true,
      total: review.total,
      parLangue: review.parLangue,
      conserves: review.conserves,
      avertissements: review.avertissements,
      message: `${review.total} traduction${review.total > 1 ? 's' : ''} enregistrée${review.total > 1 ? 's' : ''} ✓ Marquées « Traduit et relu » — elles ne seront jamais écrasées.`,
    })
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') return migrationNeeded()
    return handleRouteError(err)
  }
}
