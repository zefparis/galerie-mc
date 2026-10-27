// Bibliothèque des cadres du carrousel d'accueil — source unique des
// identifiants (zod, admin, rendu). 'gold-classic' = le cadre doré
// historique du site ; les 9 autres sont des baguettes sobres en CSS
// pur (.fx-*), collées à la toile — aucun passe-partout ni espace.

export const FRAME_IDS = [
  'gold-classic',
  'black-thin',
  'black-medium',
  'black-wide',
  'wood-thin',
  'wood-medium',
  'wood-wide',
  'white-thin',
  'white-medium',
  'white-wide',
  'none',
] as const

export type FrameId = (typeof FRAME_IDS)[number]

export const DEFAULT_FRAME: FrameId = 'gold-classic'

export function isFrameId(v: unknown): v is FrameId {
  return typeof v === 'string' && (FRAME_IDS as readonly string[]).includes(v)
}

// Cadres de la première gamme, retirés : conversion vers la nouvelle —
// identique à la migration SQL de scripts/migrate.mjs. Toute valeur
// inconnue → null (une toile revient au cadre général ; le cadre général
// retombe lui-même sur 'gold-classic').
export const LEGACY_FRAME_MAP: Record<string, FrameId | null> = {
  'mat-black': 'black-thin',
  floater: 'black-medium',
  oak: 'wood-medium',
  walnut: 'wood-wide',
  'white-gallery': 'white-medium',
  'gold-baroque': 'gold-classic',
  silver: 'gold-classic',
}

/** Ramène un identifiant enregistré (nouvelle ou ancienne gamme) vers un
 *  cadre actuel : ancien id → équivalent, inconnu → null. */
export function mapFrameId(v: unknown): FrameId | null {
  if (isFrameId(v)) return v
  if (typeof v !== 'string' || !v) return null
  return LEGACY_FRAME_MAP[v] ?? null
}

/** Idem pour le cadre général : inconnu → défaut plutôt que null. */
export function mapHeroFrameId(v: unknown): FrameId {
  return mapFrameId(v) ?? DEFAULT_FRAME
}

// Vignettes admin organisées en lignes : Noir · Bois naturel · Blanc ·
// Doré · Sans cadre.
export const FRAME_ROWS: FrameId[][] = [
  ['black-thin', 'black-medium', 'black-wide'],
  ['wood-thin', 'wood-medium', 'wood-wide'],
  ['white-thin', 'white-medium', 'white-wide'],
  ['gold-classic'],
  ['none'],
]

// Libellés français — utilisés par l'admin (l'admin n'est pas localisé ;
// les traductions publiques vivent dans messages/*.json, namespace frames).
export const FRAME_LABEL_FR: Record<FrameId, string> = {
  'gold-classic': "Doré (d'origine)",
  'black-thin': 'Noir — fin',
  'black-medium': 'Noir — moyen',
  'black-wide': 'Noir — large',
  'wood-thin': 'Bois naturel — fin',
  'wood-medium': 'Bois naturel — moyen',
  'wood-wide': 'Bois naturel — large',
  'white-thin': 'Blanc — fin',
  'white-medium': 'Blanc — moyen',
  'white-wide': 'Blanc — large',
  none: 'Sans cadre',
}

// Règle d'affichage unique : le cadre propre à la toile prime, sinon le
// cadre général des réglages, sinon le doré classique. Toute valeur
// inconnue (base en retard, saisie ancienne) retombe sur le défaut.
export function resolveFrame(
  painting: { frame?: string | null },
  settings?: { heroFrame?: string | null }
): FrameId {
  const own = mapFrameId(painting.frame)
  if (own) return own
  if (settings) return mapHeroFrameId(settings.heroFrame)
  return DEFAULT_FRAME
}
