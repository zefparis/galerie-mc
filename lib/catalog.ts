import { PaintingCategory, Technique } from './types'

// Source unique des deux galeries et de leurs techniques —
// utilisée par l'admin (wizard, liste) et le site public (/galerie).

export const CATEGORIES: {
  value: PaintingCategory
  label: string
  short: string
}[] = [
  { value: 'peintures', label: 'Peintures contemporaines', short: 'Peintures' },
  { value: 'collages', label: 'Collages sur papier', short: 'Collages' },
]

export const CATEGORY_LABEL: Record<PaintingCategory, string> = {
  peintures: 'Peintures contemporaines',
  collages: 'Collages sur papier',
}

export const CATEGORY_SHORT: Record<PaintingCategory, string> = {
  peintures: 'Peintures',
  collages: 'Collages',
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
}

export function isCategory(v: string | null | undefined): v is PaintingCategory {
  return v === 'peintures' || v === 'collages'
}
