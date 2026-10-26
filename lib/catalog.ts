import { Painting, PaintingCategory, Technique } from './types'

// Source unique des galeries et de leurs techniques — utilisée par
// l'admin (wizard, liste), le site public (/galerie, /dessins) et la nav.

export const CATEGORIES: {
  value: PaintingCategory
  label: string
  short: string
}[] = [
  { value: 'peintures', label: 'Peintures contemporaines', short: 'Peintures' },
  { value: 'collages', label: 'Collages sur papier', short: 'Collages' },
  { value: 'dessins', label: 'Dessins', short: 'Dessins' },
]

export const CATEGORY_LABEL: Record<PaintingCategory, string> = {
  peintures: 'Peintures contemporaines',
  collages: 'Collages sur papier',
  dessins: 'Dessins',
}

export const CATEGORY_SHORT: Record<PaintingCategory, string> = {
  peintures: 'Peintures',
  collages: 'Collages',
  dessins: 'Dessins',
}

export const TECHNIQUES_BY_CATEGORY: Record<PaintingCategory, Technique[]> = {
  peintures: [
    'Huile sur toile',
    'Acrylique',
    'Aquarelle',
    'Pastel',
    'Fusain',
    'Technique mixte',
    'Autre',
  ],
  collages: [
    'Collage',
    'Technique mixte sur papier',
    'Encre sur papier',
    'Aquarelle',
    'Autre',
  ],
  dessins: [
    'Fusain',
    'Crayon',
    'Encre sur papier',
    'Pastel',
    'Aquarelle',
    'Technique mixte sur papier',
    'Autre',
  ],
}

export function isCategory(v: string | null | undefined): v is PaintingCategory {
  return v === 'peintures' || v === 'collages' || v === 'dessins'
}

// ─── Galerie publique (/galerie) ─────────────────────────────────────────────
// La galerie ne montre QUE peintures et collages — les dessins vivent sur
// leur page dédiée /dessins et n'y apparaissent jamais, même via « Tout »
// ou ?categorie=dessins.

export const GALLERY_CATEGORIES: PaintingCategory[] = ['peintures', 'collages']

export function isGalleryCategory(v: string | null | undefined): v is PaintingCategory {
  return v === 'peintures' || v === 'collages'
}

/** Œuvres de la galerie publique pour un filtre donné ; 'toutes' = toute la
 *  galerie (peintures + collages), jamais les dessins. */
export function filterGalleryPaintings(
  paintings: Painting[],
  category: PaintingCategory | 'toutes'
): Painting[] {
  if (category === 'toutes') {
    return paintings.filter((p) => isGalleryCategory(p.category))
  }
  return paintings.filter((p) => p.category === category)
}

// ─── Dessins (/dessins) ──────────────────────────────────────────────────────

export function drawingsOf(paintings: Painting[]): Painting[] {
  return paintings.filter((p) => p.category === 'dessins')
}

/** L'onglet Dessins (nav, footer) et la page /dessins n'existent que s'il
 *  y a au moins un dessin — sinon la page répond 404 et l'onglet se cache. */
export function hasDrawingsIn(paintings: Painting[]): boolean {
  return paintings.some((p) => p.category === 'dessins')
}

/** Prochain rang d'affichage au sein d'une catégorie : les ordres sont
 *  indépendants par galerie, un changement de catégorie place l'œuvre en
 *  fin de liste dans sa nouvelle galerie. */
export function nextOrderInCategory(
  paintings: Painting[],
  category: PaintingCategory
): number {
  const siblings = paintings.filter((p) => (p.category || 'peintures') === category)
  if (siblings.length === 0) return 1
  return Math.max(...siblings.map((p) => p.order)) + 1
}

// ─── Navigation publique ─────────────────────────────────────────────────────
// Ordre : GALERIE · DESSINS · EXPOSITIONS · CONTACT — l'onglet Dessins
// n'apparaît que s'il existe au moins un dessin.

export interface NavItem {
  href: '/galerie' | '/dessins' | '/expositions' | '/contact'
  key: 'galerie' | 'dessins' | 'expositions' | 'contact'
}

export function navItems(hasDrawings: boolean): NavItem[] {
  return [
    { href: '/galerie', key: 'galerie' },
    ...(hasDrawings ? [{ href: '/dessins', key: 'dessins' } as NavItem] : []),
    { href: '/expositions', key: 'expositions' },
    { href: '/contact', key: 'contact' },
  ]
}
