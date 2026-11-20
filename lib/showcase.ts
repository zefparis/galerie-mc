// Composition de la vitrine de l'accueil : une œuvre peut y être
// présentée en plusieurs parties (diptyque, triptyque). Ce module
// regroupe la logique pure — nettoyage de la donnée, géométrie des
// parties, bascule mobile — partagée entre le rendu public, l'aperçu
// admin et les tests.

import { isFrameId, type FrameId } from './frames'
import type { PaintingShowcase, ShowcaseFrame, ShowcaseGap, ShowcasePhoto } from './types'

// Espacement entre les toiles, proportionnel à la hauteur d'affichage
// (fraction de la hauteur maximale de la zone du carrousel). Avec un
// cadre il se mesure entre les bords extérieurs des cadres, sans cadre
// entre les bords des toiles — le calcul est identique : c'est la
// distance entre les parties telles qu'elles sont placées.
export const SHOWCASE_GAP_RATIO: Record<ShowcaseGap, number> = {
  none: 0,
  small: 0.008,
  medium: 0.02,
  large: 0.04,
}

export const SHOWCASE_LAYOUTS = ['single', 'row', 'column'] as const
export const SHOWCASE_GAPS = ['none', 'small', 'medium', 'large'] as const

// Cadre par défaut selon la présentation : les compositions en plusieurs
// parties s'affichent sans cadre (simple ombre portée), « Une seule
// photo » et « Photo principale » gardent le cadre de l'œuvre.
export function defaultShowcaseFrame(
  layout: 'main' | 'single' | 'row' | 'column'
): ShowcaseFrame {
  return layout === 'row' || layout === 'column' ? 'none' : 'inherit'
}

/** Nettoie une valeur `showcase` lue en base : forme stricte, chaque
 *  photo avec une URL non vide ; toute valeur inconnue → null (rendu
 *  identique à la photo principale seule). */
export function sanitizeShowcase(raw: unknown): PaintingShowcase | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.layout !== 'single' && r.layout !== 'row' && r.layout !== 'column') return null
  if (r.gap !== 'none' && r.gap !== 'small' && r.gap !== 'medium' && r.gap !== 'large') return null
  if (!Array.isArray(r.photos)) return null
  const photos: ShowcasePhoto[] = []
  for (const p of r.photos) {
    if (!p || typeof p !== 'object' || typeof (p as ShowcasePhoto).url !== 'string') return null
    const ph = p as Record<string, unknown>
    if (!(ph.url as string).trim()) return null
    photos.push({
      url: (ph.url as string).trim(),
      publicId: typeof ph.publicId === 'string' ? ph.publicId : undefined,
      width: Number.isInteger(ph.width) && (ph.width as number) > 0 ? (ph.width as number) : undefined,
      height:
        Number.isInteger(ph.height) && (ph.height as number) > 0 ? (ph.height as number) : undefined,
    })
  }
  const need = r.layout === 'single' ? 1 : 2
  if (photos.length < need || photos.length > 3) return null
  // Cadre des toiles : absent ou inconnu → 'inherit' (les compositions
  // enregistrées sans ce champ gardent le cadre de l'œuvre).
  const frame: ShowcaseFrame =
    r.frame === 'inherit' || isFrameId(r.frame) ? (r.frame as ShowcaseFrame) : 'inherit'
  return { layout: r.layout, photos, gap: r.gap, frame }
}

/** Parts effectivement affichables : les photos sans URL (référence
 *  morte) sont ignorées ; s'il n'en reste pas assez pour le layout,
 *  retourne null → repli sur la photo principale. */
export function effectiveShowcase(
  s: PaintingShowcase | null | undefined
): PaintingShowcase | null {
  if (!s) return null
  const photos = s.photos.filter((p) => p && typeof p.url === 'string' && p.url.trim())
  const need = s.layout === 'single' ? 1 : 2
  if (photos.length < need) return null
  return {
    layout: s.layout,
    gap: s.gap,
    frame: s.frame,
    photos: s.layout === 'single' ? photos.slice(0, 1) : photos.slice(0, 3),
  }
}

/** Cadre appliqué aux toiles de la composition : `frame` de la vitrine,
 *  ou le cadre résolu de l'œuvre quand la valeur est 'inherit'/absente. */
export function resolveShowcaseFrame(
  showcase: PaintingShowcase | null | undefined,
  artworkFrame: FrameId
): FrameId {
  const f = showcase?.frame
  return f && f !== 'inherit' && isFrameId(f) ? f : artworkFrame
}

// ─── Géométrie ────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Épaisseur de baguette affichée : même règle que globals.css
// (.gf / .fx-* — --fx-t, --gf-t en fonction de --art-mh et du seuil 768 px).
function frameThickness(frame: FrameId, artMh: number, mobile: boolean): number {
  if (frame === 'gold-classic') {
    return mobile ? clamp(artMh * 0.05, 16, 30) : clamp(artMh * 0.07, 24, 44)
  }
  if (frame === 'none') return 0
  if (frame.endsWith('-thin')) return clamp(artMh * 0.016, 4, 14)
  if (frame.endsWith('-medium')) return clamp(artMh * 0.032, 9, 28)
  return clamp(artMh * 0.056, 16, 48)
}

/** Chrome total du cadre (baguette + mat + gap des deux côtés), en px,
 *  pour une hauteur d'affichage artMh donnée — miroir de --gf-px/--gf-py
 *  et --fx-px/--fx-py dans globals.css. */
export function frameChrome(
  frame: FrameId,
  artMh: number,
  mobile: boolean
): { px: number; py: number } {
  const t = frameThickness(frame, artMh, mobile)
  if (frame === 'gold-classic') {
    return { px: (t * 317) / 162, py: (t * 331) / 162 }
  }
  return { px: 2 * t, py: 2 * t }
}

// Seuil de bascule mobile → colonne : une toile côte à côte plus étroite
// que ~28 % de la largeur disponible devient illisible.
const ROW_MIN_PART_RATIO = 0.28

export interface ShowcasePart {
  /** Largeur extérieure de la partie encadrée (px). */
  width: number
  /** Hauteur extérieure de la partie encadrée (px). */
  height: number
  /** Valeur de --art-mh à passer à FramedArt (échelle l'épaisseur du cadre). */
  artMh: number
}

export interface ShowcasePlan {
  /** 'row' = côte à côte ; 'column' = l'une au-dessus de l'autre. */
  orientation: 'row' | 'column'
  gapPx: number
  parts: ShowcasePart[]
}

interface ComputeShowcaseInput {
  layout: 'single' | 'row' | 'column'
  /** Ratio largeur/hauteur de chaque photo, dans l'ordre d'affichage. */
  ratios: number[]
  /** Largeur disponible pour la composition (px). */
  availW: number
  /** Hauteur maximale de la zone d'art (--art-mh du carrousel, px). */
  availH: number
  gap: ShowcaseGap
  frame: FrameId
  /** Viewport < 768 px : la règle de bascule mobile s'applique. */
  mobile: boolean
}

/** Calcule le placement des parties encadrées : même hauteur en 'row',
 *  même largeur en 'column', ratio réel conservé, jamais rognées. La
 *  hauteur totale reste bornée par availH et la largeur par availW.
 *  En mobile, 'row' bascule en 'column' si chaque toile ferait moins de
 *  ~28 % de la largeur disponible. Retourne null si la zone est nulle. */
export function computeShowcase(input: ComputeShowcaseInput): ShowcasePlan | null {
  const { layout, ratios, availW, availH, gap, frame, mobile } = input
  const n = ratios.length
  if (n < 1 || availW <= 0 || availH <= 0) return null
  const gapPx = SHOWCASE_GAP_RATIO[gap] * availH
  const gaps = (n - 1) * gapPx
  const sumR = ratios.reduce((a, r) => a + r, 0)

  if (layout !== 'column') {
    // 'single' et 'row' : même hauteur extérieure H pour toutes les
    // parties — (H - py) × r_i + px = largeur extérieure de la partie i.
    let H = availH
    let chrome = frameChrome(frame, H, mobile)
    for (let i = 0; i < 3; i++) {
      chrome = frameChrome(frame, H, mobile)
      H = Math.min(availH, chrome.py + (availW - n * chrome.px - gaps) / sumR)
    }
    chrome = frameChrome(frame, H, mobile)
    const parts = ratios.map((r) => ({
      width: (H - chrome.py) * r + chrome.px,
      height: H,
      artMh: H,
    }))
    const minPartW = Math.min(...parts.map((p) => p.width))
    if (H > 0 && !(mobile && layout === 'row' && minPartW < ROW_MIN_PART_RATIO * availW)) {
      return { orientation: 'row', gapPx, parts }
    }
    // Trop étroit en mobile : bascule en colonne (même largeur).
  }

  // 'column' : même largeur extérieure W pour toutes les parties —
  // hauteur de la partie i : py_i + (W - px_i) / r_i. W est réduit
  // jusqu'à ce que la pile tienne dans availH (itération multiplicative,
  // convergence géométrique — 24 passages suffisent largement).
  let W = availW
  let parts: ShowcasePart[] = []
  for (let iter = 0; iter < 24; iter++) {
    let total = gaps
    parts = ratios.map((r) => {
      // Point fixe : artMh dépend du chrome, qui dépend de artMh.
      let artMh = W / r
      for (let k = 0; k < 3; k++) {
        const c = frameChrome(frame, artMh, mobile)
        artMh = c.py + (W - c.px) / r
      }
      total += artMh
      return { width: W, height: artMh, artMh }
    })
    if (total <= availH + 0.001) break
    W *= availH / total
  }
  return { orientation: 'column', gapPx, parts }
}

/** Liste ordonnée des œuvres du carrousel : les œuvres `featured` dans
 *  l'ordre habituel (≤ max), avec l'œuvre marquée `showcaseFirst` en
 *  première diapositive — le reste de l'ordre est inchangé, y compris
 *  quand elle n'est pas `featured`. */
export function heroCarouselList<
  T extends { id: string; featured: boolean; showcaseFirst?: boolean },
>(paintings: T[], max = 8): T[] {
  const first = paintings.find((p) => p.showcaseFirst)
  let list = paintings.filter((p) => p.featured).slice(0, max)
  if (first) {
    list = [first, ...list.filter((p) => p.id !== first.id)].slice(0, max)
  }
  if (list.length === 0 && paintings.length > 0) list = [paintings[0]]
  return list
}
