import type {
  FieldTranslationMeta,
  GallerySettings,
  TargetLocale,
  Translations,
  TranslationStatus,
} from './types'

export const TARGET_LOCALES: TargetLocale[] = ['en', 'es', 'de']

// Clé de traduction d'une légende de photo de l'artiste : stable par image
// (le publicId Cloudinary survit à un réordonnancement).
export const photoCaptionKey = (publicId: string) => `photo:${publicId}`

/** Champs français traduisibles des réglages (accroche, présentation,
 *  démarche picturale, légendes des photos). */
export function settingsFrenchFields(s: GallerySettings): Record<string, string> {
  const fields: Record<string, string> = {
    bioShort: s.bioShort || '',
    bio: s.bio || '',
    processText: s.processText || '',
  }
  for (const p of s.photos || []) {
    if (p.publicId) fields[photoCaptionKey(p.publicId)] = p.caption || ''
  }
  return fields
}

// Hash stable et sans dépendance (FNV-1a) : sert uniquement à détecter que
// le texte français a changé depuis la dernière traduction — pas de crypto.
export function hashSource(text: string): string {
  let h = 0x811c9dc5
  const s = text.trim()
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function clone(t: Translations | undefined | null): Translations {
  return t ? JSON.parse(JSON.stringify(t)) : {}
}

export function fieldMeta(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale
): FieldTranslationMeta | undefined {
  return t?._meta?.[field]?.[locale]
}

export type FieldPlan = 'translate' | 'skip' | 'mark-stale'

/**
 * Décide quoi faire pour un champ/langue :
 * - 'translate' : pas de traduction, ou auto dont le français a changé ;
 * - 'mark-stale' : corrigée à la main mais le français a changé — on garde
 *   le texte corrigé et on le signale « À mettre à jour » ;
 * - 'skip' : à jour, corrigée et toujours valide, ou français vide.
 * force = vrai → tout retraduit (bouton « Retraduire » explicite).
 */
export function planField(
  t: Translations | undefined | null,
  field: string,
  french: string,
  locale: TargetLocale,
  force = false
): FieldPlan {
  if (!french.trim()) return 'skip'
  const meta = fieldMeta(t, field, locale)
  const hasText = !!t?.[locale]?.[field]
  // 'relu' (traduit à la main et importé) n'est jamais retraduit, même avec
  // force : si le français a changé on le signale sans rien effacer.
  if (meta?.statut === 'relu') {
    return meta.sourceHash === hashSource(french) ? 'skip' : 'mark-stale'
  }
  if (force) return 'translate'
  if (!meta && !hasText) return 'translate'
  if (!meta && hasText) return 'skip' // texte sans méta : origine inconnue, on n'écrase pas
  if (meta!.statut === 'corrige') {
    return meta!.sourceHash === hashSource(french) ? 'skip' : 'mark-stale'
  }
  if (meta!.statut === 'a_mettre_a_jour') return 'skip' // attend un « Retraduire » manuel
  if (meta!.statut === 'echec') return 'translate' // on retente à la prochaine passe
  return meta!.sourceHash === hashSource(french) ? 'skip' : 'translate'
}

export function setFieldTranslation(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale,
  text: string,
  french: string
): Translations {
  const next = clone(t)
  next[locale] = { ...(next[locale] || {}), [field]: text }
  next._meta = { ...(next._meta || {}) }
  next._meta[field] = {
    ...(next._meta[field] || {}),
    [locale]: { sourceHash: hashSource(french), statut: 'auto' },
  }
  return next
}

/** Correction manuelle de l'artiste : statut 'corrige', jamais écrasée ensuite. */
export function markCorrected(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale,
  text: string,
  french: string
): Translations {
  const next = clone(t)
  if (!text.trim()) {
    if (next[locale]) delete next[locale][field]
    if (next._meta?.[field]) delete next._meta[field][locale]
    return next
  }
  next[locale] = { ...(next[locale] || {}), [field]: text }
  next._meta = { ...(next._meta || {}) }
  next._meta[field] = {
    ...(next._meta[field] || {}),
    [locale]: { sourceHash: hashSource(french), statut: 'corrige' },
  }
  return next
}

/**
 * Traduction en échec : statut 'echec' + raison courte affichée dans l'admin.
 * Le texte déjà présent est conservé — mieux vaut une traduction ancienne
 * qu'une case vide côté public.
 */
export function markEchec(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale,
  raison: string,
  french = ''
): Translations {
  const next = clone(t)
  const meta = fieldMeta(next, field, locale)
  next._meta = { ...(next._meta || {}) }
  next._meta[field] = {
    ...(next._meta[field] || {}),
    [locale]: {
      sourceHash: meta?.sourceHash || hashSource(french),
      statut: 'echec',
      erreur: raison.slice(0, 160),
    },
  }
  return next
}

/** Traduction faite à la main et importée : statut 'relu', jamais écrasée
 *  par la traduction automatique ni par « Retraduire ». */
export function markRelu(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale,
  text: string,
  french: string
): Translations {
  const next = clone(t)
  next[locale] = { ...(next[locale] || {}), [field]: text }
  next._meta = { ...(next._meta || {}) }
  next._meta[field] = {
    ...(next._meta[field] || {}),
    [locale]: { sourceHash: hashSource(french), statut: 'relu' },
  }
  return next
}

/** Le français a bougé alors que la langue était corrigée : on signale sans rien effacer. */
export function markStale(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale
): Translations {
  const next = clone(t)
  const meta = next._meta?.[field]?.[locale]
  if (!meta) return next
  next._meta![field] = { ...next._meta![field], [locale]: { ...meta, statut: 'a_mettre_a_jour' } }
  return next
}

/**
 * À chaque enregistrement : pour les champs dont le français a changé, les
 * traductions corrigées à la main passent en « À mettre à jour » (le texte
 * corrigé est conservé).
 */
export function withStaleMarks(
  t: Translations | undefined | null,
  oldFrench: Record<string, string>,
  newFrench: Record<string, string>
): Translations {
  let next = t
  for (const field of Object.keys(newFrench)) {
    if ((oldFrench[field] || '') === (newFrench[field] || '')) continue
    for (const locale of TARGET_LOCALES) {
      const meta = fieldMeta(next, field, locale)
      if (
        (meta?.statut === 'corrige' || meta?.statut === 'relu') &&
        meta.sourceHash !== hashSource(newFrench[field])
      ) {
        next = markStale(next, field, locale)
      }
    }
  }
  return next || {}
}

export function fieldStatus(
  t: Translations | undefined | null,
  field: string,
  locale: TargetLocale,
  french: string
): TranslationStatus | 'non_traduit' {
  const meta = fieldMeta(t, field, locale)
  const hasText = !!t?.[locale]?.[field]
  if (!french.trim()) return 'non_traduit'
  if (!meta) return hasText ? 'corrige' : 'non_traduit'
  if (
    (meta.statut === 'corrige' || meta.statut === 'relu') &&
    meta.sourceHash !== hashSource(french)
  ) {
    return 'a_mettre_a_jour'
  }
  return meta.statut
}

// ─── Orchestration (testable : le traducteur est injecté) ───────────────────

/**
 * Résultat d'un fournisseur : les champs traduits d'un côté, les champs en
 * échec de l'autre (raison courte en français, pensée pour l'admin — jamais
 * de texte source complet).
 */
export interface TranslateOutcome {
  ok: Record<string, string>
  failed: Record<string, string>
}

export type TranslateFn = (
  texts: Record<string, string>,
  locale: TargetLocale
) => Promise<TranslateOutcome>

export interface TranslateReport {
  translations: Translations
  translated: number
  skipped: number
  stale: number
  errors: number
}

/**
 * Traduit les champs français d'un contenu dans les langues demandées.
 * Idempotent : ne retraduit ni ce qui est à jour ni ce qui a été corrigé.
 */
export async function translateFields(
  frenchFields: Record<string, string>,
  existing: Translations | undefined | null,
  locales: TargetLocale[],
  translate: TranslateFn,
  opts: { force?: boolean; fields?: string[] } = {}
): Promise<TranslateReport> {
  let translations: Translations = existing ? JSON.parse(JSON.stringify(existing)) : {}
  const report: TranslateReport = { translations, translated: 0, skipped: 0, stale: 0, errors: 0 }
  const wanted = opts.fields ? new Set(opts.fields) : null

  for (const locale of locales) {
    const toTranslate: Record<string, string> = {}
    for (const [field, french] of Object.entries(frenchFields)) {
      if (wanted && !wanted.has(field)) continue
      const plan = planField(translations, field, french, locale, opts.force)
      if (plan === 'translate' && french.trim()) toTranslate[field] = french
      else if (plan === 'mark-stale') {
        translations = markStale(translations, field, locale)
        report.stale++
      } else report.skipped++
    }
    if (Object.keys(toTranslate).length === 0) continue
    let outcome: TranslateOutcome
    try {
      outcome = await translate(toTranslate, locale)
    } catch {
      outcome = { ok: {}, failed: {} }
    }
    for (const field of Object.keys(toTranslate)) {
      const text = outcome.ok[field]
      if (typeof text === 'string' && text.trim()) {
        translations = setFieldTranslation(translations, field, locale, text, toTranslate[field])
        report.translated++
      } else {
        const raison = outcome.failed[field] || 'Le service de traduction ne répond pas'
        translations = markEchec(translations, field, locale, raison, toTranslate[field])
        report.errors++
      }
    }
  }
  report.translations = translations
  return report
}
