// Bibliothèque des cadres du carrousel d'accueil — source unique des
// identifiants (zod, admin, rendu). 'gold-classic' = le cadre doré
// historique du site ; les 9 autres sont rendus en CSS pur (.fx-*).

export const FRAME_IDS = [
  'gold-classic',
  'gold-baroque',
  'silver',
  'black-thin',
  'white-gallery',
  'oak',
  'walnut',
  'floater',
  'mat-black',
  'none',
] as const

export type FrameId = (typeof FRAME_IDS)[number]

export const DEFAULT_FRAME: FrameId = 'gold-classic'

export function isFrameId(v: unknown): v is FrameId {
  return typeof v === 'string' && (FRAME_IDS as readonly string[]).includes(v)
}

// Libellés français — utilisés par l'admin (l'admin n'est pas localisé ;
// les traductions publiques vivent dans messages/*.json, namespace frames).
export const FRAME_LABEL_FR: Record<FrameId, string> = {
  'gold-classic': 'Doré classique',
  'gold-baroque': 'Doré baroque',
  silver: 'Argent patiné',
  'black-thin': 'Noir fin moderne',
  'white-gallery': 'Blanc galerie',
  oak: 'Chêne naturel',
  walnut: 'Noyer foncé',
  floater: 'Caisse américaine',
  'mat-black': 'Passe-partout blanc et baguette noire',
  none: 'Sans cadre',
}

// Règle d'affichage unique : le cadre propre à la toile prime, sinon le
// cadre général des réglages, sinon le doré classique. Toute valeur
// inconnue (base en retard, saisie ancienne) retombe sur le défaut.
export function resolveFrame(
  painting: { frame?: string | null },
  settings?: { heroFrame?: string | null }
): FrameId {
  if (isFrameId(painting.frame)) return painting.frame
  if (settings && isFrameId(settings.heroFrame)) return settings.heroFrame
  return DEFAULT_FRAME
}
