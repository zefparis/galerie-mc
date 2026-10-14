import type { TargetLocale } from './types'

// « Traduire tout mon site » : le client pilote une boucle de petites
// requêtes — UNE par couple (contenu, langue) — au lieu d'une grosse
// requête par contenu. Chaque requête reste bien sous la limite Vercel ;
// les champs restants (budget serveur épuisé) déclenchent une relance de
// la même requête jusqu'à remaining = 0.

export type Entity = 'painting' | 'event' | 'settings'

export interface ContentJob {
  entity: Entity
  id?: string
  // Libellé affiché à l'artiste (titre de l'œuvre, nom de l'événement…).
  label: string
}

export interface LocaleJob extends ContentJob {
  locale: TargetLocale
}

export const TRANSLATE_LOCALES: TargetLocale[] = ['en', 'es', 'de']

export const LOCALE_LABEL: Record<TargetLocale, string> = {
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
}

export const FIELD_LABEL: Record<string, string> = {
  title: 'titre',
  description: 'description',
  location: 'lieu',
  bioShort: 'accroche',
  bio: 'présentation',
  processText: 'démarche picturale',
  tagline: 'phrase d’accroche (accueil)',
  presentation: 'présentation (accueil)',
  notice_accroche: 'accroche de la fiche',
  notice_texte: 'texte de la fiche',
  notice_ambiance: 'ambiance de la fiche',
  notice_matiere: 'matière et technique de la fiche',
}

export const fieldLabel = (f: string) =>
  f.startsWith('photo:') ? 'légende de photo' : FIELD_LABEL[f] || f

/** Contenus × 3 langues = la liste de travail (une requête par couple). */
export function buildJobs(contents: ContentJob[]): LocaleJob[] {
  const jobs: LocaleJob[] = []
  for (const c of contents) for (const locale of TRANSLATE_LOCALES) jobs.push({ ...c, locale })
  return jobs
}

export interface FieldFailure {
  field: string
  locale?: TargetLocale
  raison: string
}

export interface JobResult {
  job: LocaleJob
  /** Champs effectivement traduits pendant ce couple (contenu, langue). */
  translated: number
  failures: FieldFailure[]
  /** Détail technique pour le bloc repliable (code HTTP, erreur brute). */
  detail?: string
}

/** Une ligne claire par échec : « Éclat » — anglais, champ titre : raison. */
export function failureLine(r: JobResult): string[] {
  return r.failures.map(
    (f) =>
      `« ${r.job.label} » — ${LOCALE_LABEL[r.job.locale]}, ${fieldLabel(f.field)} : ${f.raison}`
  )
}

/** Résultats ayant au moins un échec (pour l'affichage des causes). */
export function failedResults(results: JobResult[]): JobResult[] {
  return results.filter((r) => r.failures.length > 0)
}

/** Les couples (contenu, langue) à relancer — rien d'autre n'est refait. */
export function jobsToRetry(results: JobResult[]): LocaleJob[] {
  return failedResults(results).map((r) => r.job)
}

/** Récapitulatif final en français simple. */
export function summaryText(results: JobResult[], translated: number): string {
  const failed = failedResults(results)
  const head =
    translated > 0
      ? `${translated} texte${translated > 1 ? 's' : ''} traduit${translated > 1 ? 's' : ''}.`
      : 'Aucun nouveau texte traduit.'
  if (failed.length === 0)
    return translated > 0 ? `C’est fait ✓ ${head}` : 'Tout était déjà à jour ✓'
  const n = failed.reduce((acc, r) => acc + r.failures.length, 0)
  return `${head} ${n} texte${n > 1 ? 's n’ont' : ' n’a'} pas pu être traduit${n > 1 ? 's' : ''} :`
}
