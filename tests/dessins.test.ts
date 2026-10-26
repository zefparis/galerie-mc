import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  drawingsOf,
  filterGalleryPaintings,
  hasDrawingsIn,
  isCategory,
  isGalleryCategory,
  navItems,
  nextOrderInCategory,
} from '../lib/catalog'
import { mapPaintingRow } from '../lib/mappers'
import { paintingBodySchema } from '../lib/validation'
import type { Painting } from '../lib/types'

const ROOT = process.cwd()

const paint = (id: string, category: Painting['category'], order: number): Painting => ({
  id,
  title: `Œuvre ${id}`,
  year: 2024,
  technique: 'Fusain',
  dimensions: '',
  description: '',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/x',
  imagePublicId: 'galerie-mc/x',
  priceStatus: 'sur_demande',
  category,
  featured: false,
  order,
  createdAt: '',
})

const LIST = [
  paint('p1', 'peintures', 1),
  paint('p2', 'peintures', 2),
  paint('c1', 'collages', 5),
  paint('d1', 'dessins', 3),
  paint('d2', 'dessins', 7),
]

describe('galerie vs dessins (périmètres de catégories)', () => {
  it('la galerie « Toutes » ne renvoie que peintures et collages — jamais de dessin', () => {
    const all = filterGalleryPaintings(LIST, 'toutes')
    expect(all.map((p) => p.id)).toEqual(['p1', 'p2', 'c1'])
    expect(all.some((p) => p.category === 'dessins')).toBe(false)
  })

  it('les filtres de galerie restent cantonnés à leur catégorie', () => {
    expect(filterGalleryPaintings(LIST, 'peintures').map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(filterGalleryPaintings(LIST, 'collages').map((p) => p.id)).toEqual(['c1'])
  })

  it('la page dessins ne contient que des dessins', () => {
    expect(drawingsOf(LIST).map((p) => p.id)).toEqual(['d1', 'd2'])
    expect(drawingsOf(filterGalleryPaintings(LIST, 'toutes'))).toEqual([])
  })

  it('isCategory accepte dessins, isGalleryCategory le refuse', () => {
    expect(isCategory('dessins')).toBe(true)
    expect(isGalleryCategory('dessins')).toBe(false)
    expect(isGalleryCategory('peintures')).toBe(true)
  })
})

describe('ordre indépendant par catégorie', () => {
  it('le prochain rang d’une galerie ignore les autres catégories', () => {
    expect(nextOrderInCategory(LIST, 'dessins')).toBe(8)
    expect(nextOrderInCategory(LIST, 'peintures')).toBe(3)
    expect(nextOrderInCategory(LIST, 'collages')).toBe(6)
  })

  it('une œuvre déplacée vers une nouvelle galerie arrive en fin de liste', () => {
    // Comportement SQL : "order" = max+1 de la catégorie cible — testé ici
    // via le même calcul, plus le garde-fou contractuel sur la route PUT.
    const moved = { ...LIST[0], category: 'dessins' as const }
    const next = [...LIST.slice(1), moved]
    expect(nextOrderInCategory(next, 'dessins')).toBe(8)
    // L'ordre des peintures restantes n'est pas touché.
    expect(nextOrderInCategory(next, 'peintures')).toBe(3)
  })

  it('la route PUT passe l’œuvre en fin de liste au changement de catégorie', () => {
    const src = readFileSync(join(ROOT, 'app/api/paintings/[id]/route.ts'), 'utf8')
    expect(src).toContain('IS DISTINCT FROM')
    expect(src).toContain('COALESCE(MAX("order")')
  })
})

describe('onglet Dessins et page /dessins', () => {
  it('l’onglet est masqué sans dessin, visible avec au moins un', () => {
    expect(hasDrawingsIn([])).toBe(false)
    expect(hasDrawingsIn(LIST.filter((p) => p.category !== 'dessins'))).toBe(false)
    expect(hasDrawingsIn(LIST)).toBe(true)

    const sansDessins = navItems(false).map((i) => i.href)
    expect(sansDessins).toEqual(['/galerie', '/expositions', '/contact'])

    const avecDessins = navItems(true).map((i) => i.href)
    expect(avecDessins).toEqual(['/galerie', '/dessins', '/expositions', '/contact'])
  })

  it('la page /dessins répond 404 quand aucun dessin n’existe', () => {
    expect(drawingsOf([])).toEqual([])
    // Garde-fou contractuel : la page appelle bien notFound() sur liste vide.
    const src = readFileSync(join(ROOT, 'app/[locale]/dessins/page.tsx'), 'utf8')
    expect(src).toContain('drawingsOf')
    expect(src).toContain('notFound()')
  })
})

describe('validation zod de la catégorie', () => {
  const base = {
    title: 'Fusain sur papier',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/x',
    imagePublicId: 'galerie-mc/x',
  }

  it('rejette une catégorie invalide, accepte dessins', () => {
    expect(paintingBodySchema.safeParse({ ...base, category: 'drawing' }).success).toBe(false)
    expect(paintingBodySchema.safeParse({ ...base, category: 'gravures' }).success).toBe(false)
    expect(paintingBodySchema.safeParse({ ...base, category: 'dessins' }).success).toBe(true)
  })

  it('la catégorie par défaut reste « peintures »', () => {
    const parsed = paintingBodySchema.parse(base)
    expect(parsed.category).toBe('peintures')
  })
})

describe('projection publique : analysis jamais exposée, dessins compris', () => {
  it('mapPaintingRow conserve la catégorie dessins sans jamais faire fuiter analysis', () => {
    const p = mapPaintingRow({
      id: 'x',
      title: 'Fusain',
      category: 'dessins',
      image_url: 'u',
      analysis: { notes_artiste: ['secret'], repere_prix: '500' },
      notice: { accroche: 'a', texte_client: 't', ambiance: 'b', matiere_technique: ['p'] },
    } as never)
    expect(p.category).toBe('dessins')
    const s = JSON.stringify(p)
    expect(s).not.toContain('notes_artiste')
    expect(s).not.toContain('repere')
    expect(s).not.toContain('secret')
  })

  it('les listes de colonnes publiques des toiles ne lisent jamais analysis', () => {
    for (const rel of [
      'lib/data.ts',
      'app/api/paintings/route.ts',
      'app/api/paintings/[id]/route.ts',
    ]) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      for (const m of src.matchAll(/(?:PUBLIC_COLS|PAINTING_PUBLIC_COLS)\s*=\s*`([^`]*)`/g)) {
        expect(m[1], `${rel} : la projection publique contient analysis`).not.toContain('analysis')
      }
      // Repli « legacy » (42703) : mêmes colonnes, jamais analysis non plus.
      for (const m of src.matchAll(/SELECT\s+(id, title, year[\s\S]*?)\s+FROM paintings/g)) {
        expect(m[1], `${rel} : un SELECT public lit analysis`).not.toContain('analysis')
      }
    }
  })
})
