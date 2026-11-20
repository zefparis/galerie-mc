import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// next/image n'est pas rendable côté serveur hérité dans vitest :
// on le remplace par une balise <img> triviale (src/alt suffisent pour
// vérifier le nombre de toiles et leur source).
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement('img', { src, alt, className }),
}))
import ShowcaseArtwork from '../components/gallery/ShowcaseArtwork'
import {
  computeShowcase,
  effectiveShowcase,
  heroCarouselList,
  sanitizeShowcase,
} from '../lib/showcase'
import { paintingBodySchema, showcaseSchema } from '../lib/validation'
import type { Painting, PaintingShowcase } from '../lib/types'

const ROOT = process.cwd()

// Photo valide de l'espace Cloudinary du site (cloud 'demo' dans les tests).
const photo = (id: string, w = 800, h = 600) => ({
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/${id}`,
  publicId: `galerie-mc/${id}`,
  width: w,
  height: h,
})

const painting = (over: Partial<Painting> = {}): Painting => ({
  id: 'p1',
  title: 'Triptyque du matin',
  year: 2024,
  technique: 'Huile sur toile',
  dimensions: '3 × 40 × 80 cm',
  description: '',
  imageUrl: photo('main').url,
  imagePublicId: 'galerie-mc/main',
  imageWidth: 800,
  imageHeight: 600,
  priceStatus: 'sur_demande',
  category: 'peintures',
  featured: true,
  order: 1,
  createdAt: '',
  ...over,
})

const prevCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
beforeEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo'
})
afterAll(() => {
  if (prevCloud === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = prevCloud
})

describe('zod — showcaseSchema', () => {

  it('« Une seule photo » exige exactement 1 photo', () => {
    expect(
      showcaseSchema.safeParse({ layout: 'single', photos: [photo('a')], gap: 'medium' }).success
    ).toBe(true)
    expect(
      showcaseSchema.safeParse({
        layout: 'single',
        photos: [photo('a'), photo('b')],
        gap: 'medium',
      }).success
    ).toBe(false)
  })

  it("'row' et 'column' exigent 2 ou 3 photos", () => {
    for (const layout of ['row', 'column'] as const) {
      expect(
        showcaseSchema.safeParse({ layout, photos: [photo('a')], gap: 'medium' }).success
      ).toBe(false)
      expect(
        showcaseSchema.safeParse({ layout, photos: [photo('a'), photo('b')], gap: 'small' })
          .success
      ).toBe(true)
      expect(
        showcaseSchema.safeParse({
          layout,
          photos: [photo('a'), photo('b'), photo('c')],
          gap: 'large',
        }).success
      ).toBe(true)
      expect(
        showcaseSchema.safeParse({
          layout,
          photos: [photo('a'), photo('b'), photo('c'), photo('d')],
          gap: 'large',
        }).success
      ).toBe(false)
    }
  })

  it("rejette une photo étrangère à l'espace du site", () => {
    expect(
      showcaseSchema.safeParse({
        layout: 'row',
        photos: [
          photo('a'),
          { url: 'https://res.cloudinary.com/autre/image/upload/x', publicId: 'x' },
        ],
        gap: 'medium',
      }).success
    ).toBe(false)
    // URL du site mais publicId incohérent avec l'URL.
    expect(
      showcaseSchema.safeParse({
        layout: 'row',
        photos: [photo('a'), { ...photo('b'), publicId: 'galerie-mc/autre' }],
        gap: 'medium',
      }).success
    ).toBe(false)
  })

  it('rejette un espacement ou une clé inconnue (strict)', () => {
    expect(
      showcaseSchema.safeParse({
        layout: 'row',
        photos: [photo('a'), photo('b')],
        gap: 'huge',
      }).success
    ).toBe(false)
    expect(
      showcaseSchema.safeParse({
        layout: 'row',
        photos: [photo('a'), photo('b')],
        gap: 'medium',
        extra: true,
      }).success
    ).toBe(false)
  })

  it('paintingBodySchema accepte showcase NULL et showcaseFirst', () => {
    const base = {
      title: 'Toile',
      imageUrl: photo('main').url,
      imagePublicId: 'galerie-mc/main',
    }
    expect(paintingBodySchema.safeParse({ ...base, showcase: null }).success).toBe(true)
    expect(paintingBodySchema.safeParse({ ...base, showcaseFirst: true }).success).toBe(true)
    const full = paintingBodySchema.safeParse({
      ...base,
      showcase: { layout: 'row', photos: [photo('a'), photo('b')], gap: 'medium' },
      showcaseFirst: true,
    })
    expect(full.success).toBe(true)
  })
})

describe('unicité de la première place', () => {
  it("la migration impose une œuvre unique en première place (index partiel)", () => {
    const sql = readFileSync(join(ROOT, 'scripts/migrate.mjs'), 'utf8')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS showcase JSONB')
    expect(sql).toContain('showcase_first BOOLEAN NOT NULL DEFAULT false')
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_paintings_showcase_first[\s\S]*WHERE showcase_first/)
  })

  it("activer la première place sur B retire le drapeau de A (transaction)", () => {
    for (const rel of ['app/api/paintings/route.ts', 'app/api/paintings/[id]/route.ts']) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(src, rel).toContain('SET showcase_first = false WHERE showcase_first = true')
      expect(src, rel).toMatch(/BEGIN[\s\S]*SET showcase_first = false[\s\S]*COMMIT/)
    }
  })

  it("heroCarouselList place l'œuvre marquée en première diapositive", () => {
    const p = (id: string, featured: boolean, showcaseFirst = false, order = 0) => ({
      id,
      featured,
      showcaseFirst,
      order,
    })
    const list = heroCarouselList([p('a', true), p('b', true), p('c', true)], 8)
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    // B en première place → B d'abord, le reste inchangé.
    const moved = heroCarouselList([p('a', true), p('b', true, true), p('c', true)], 8)
    expect(moved.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    // Première place sans featured : elle ouvre quand même le carrousel.
    const prepended = heroCarouselList([p('a', true), p('b', false, true), p('c', true)], 8)
    expect(prepended.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    // Le plafond de 8 est respecté après insertion.
    const many = heroCarouselList(
      [...Array.from({ length: 9 }, (_, i) => p(`f${i}`, true)), p('x', false, true)],
      8
    )
    expect(many).toHaveLength(8)
    expect(many[0].id).toBe('x')
    // Aucun featured : repli sur la première œuvre (comportement actuel).
    const empty = heroCarouselList([p('a', false), p('b', false)], 8)
    expect(empty.map((x) => x.id)).toEqual(['a'])
  })
})

describe('nettoyage et repli (effectiveShowcase / sanitizeShowcase)', () => {
  const s = (over: Partial<PaintingShowcase> = {}): PaintingShowcase => ({
    layout: 'row',
    photos: [photo('a'), photo('b')],
    gap: 'medium',
    ...over,
  })

  it('showcase NULL/absent → null : rendu identique à la photo principale', () => {
    expect(sanitizeShowcase(null)).toBeNull()
    expect(sanitizeShowcase(undefined)).toBeNull()
    expect(effectiveShowcase(null)).toBeNull()
    expect(effectiveShowcase(undefined)).toBeNull()
  })

  it('sanitizeShowcase rejette les formes inconnues', () => {
    expect(sanitizeShowcase({ layout: 'grid', photos: [], gap: 'small' })).toBeNull()
    expect(sanitizeShowcase({ layout: 'row', photos: [], gap: 'small' })).toBeNull()
    expect(sanitizeShowcase({ layout: 'row', photos: [{ url: 'u' }, { url: 'v' }], gap: 'xl' })).toBeNull()
    expect(
      sanitizeShowcase({ layout: 'row', photos: [{ url: 'u' }, { url: 'v' }], gap: 'small' })
    ).toEqual({ layout: 'row', photos: [{ url: 'u' }, { url: 'v' }], gap: 'small' })
  })

  it('photos référencées disparues : ignorées, repli si insuffisantes', () => {
    // Une photo sur deux sans URL → 'row' n'a plus assez de parties.
    expect(
      effectiveShowcase(s({ photos: [photo('a'), { url: '' }] }))
    ).toBeNull()
    // Deux valides sur trois → la composition se poursuit sans la morte.
    expect(
      effectiveShowcase(s({ photos: [photo('a'), { url: '  ' }, photo('c')] }))?.photos.length
    ).toBe(2)
    // 'single' avec une photo morte → repli.
    expect(effectiveShowcase(s({ layout: 'single', photos: [{ url: '' }] }))).toBeNull()
    // 'single' conserve exactement la première photo valide.
    expect(
      effectiveShowcase(s({ layout: 'single', photos: [photo('a'), photo('b')] }))?.photos
    ).toHaveLength(1)
  })
})

describe('computeShowcase — géométrie de la composition', () => {
  const W = 560
  const H = 500

  it("'single' : une partie bornée par la zone, ratio conservé", () => {
    const plan = computeShowcase({
      layout: 'single',
      ratios: [4 / 5],
      availW: W,
      availH: H,
      gap: 'medium',
      frame: 'none',
      mobile: false,
    })!
    expect(plan.orientation).toBe('row')
    expect(plan.parts).toHaveLength(1)
    expect(plan.parts[0].height).toBeLessThanOrEqual(H)
    expect(plan.parts[0].width).toBeLessThanOrEqual(W)
    // Cadre 'none' : hauteur = largeur / ratio exactement.
    expect(plan.parts[0].width / plan.parts[0].height).toBeCloseTo(4 / 5, 1)
  })

  it("'row' à 2 et 3 toiles : même hauteur, largeur totale dans la zone", () => {
    for (const ratios of [[1, 1], [1.5, 0.7, 1.1]] as number[][]) {
      const plan = computeShowcase({
        layout: 'row',
        ratios,
        availW: W,
        availH: H,
        gap: 'medium',
        frame: 'none',
        mobile: false,
      })!
      expect(plan.orientation).toBe('row')
      const heights = plan.parts.map((p) => p.height)
      for (const h of heights) expect(h).toBeCloseTo(heights[0], 6)
      const totalW = plan.parts.reduce((a, p) => a + p.width, 0) + plan.gapPx * (ratios.length - 1)
      expect(totalW).toBeLessThanOrEqual(W + 0.5)
      expect(heights[0]).toBeLessThanOrEqual(H)
    }
  })

  it("'column' : même largeur, hauteur totale bornée par la zone", () => {
    const plan = computeShowcase({
      layout: 'column',
      ratios: [0.8, 0.8, 0.8],
      availW: W,
      availH: H,
      gap: 'large',
      frame: 'black-medium',
      mobile: false,
    })!
    expect(plan.orientation).toBe('column')
    const widths = plan.parts.map((p) => p.width)
    for (const w of widths) expect(w).toBeCloseTo(widths[0], 6)
    const totalH = plan.parts.reduce((a, p) => a + p.height, 0) + plan.gapPx * 2
    expect(totalH).toBeLessThanOrEqual(H + 0.5)
  })

  it('mobile : « row » bascule en « column » si chaque toile < 28 % de la largeur', () => {
    // 3 toiles carrées + grand espacement sur téléphone → chaque
    // part < 28 % de la largeur disponible → bascule en colonne.
    const small = computeShowcase({
      layout: 'row',
      ratios: [1, 1, 1],
      availW: 320,
      availH: 380,
      gap: 'large',
      frame: 'none',
      mobile: true,
    })!
    expect(small.orientation).toBe('column')
    // 2 toiles larges restent côte à côte en mobile.
    const ok = computeShowcase({
      layout: 'row',
      ratios: [1.6, 1.6],
      availW: 320,
      availH: 380,
      gap: 'small',
      frame: 'none',
      mobile: true,
    })!
    expect(ok.orientation).toBe('row')
    // 'column' demandé reste 'column'.
    const col = computeShowcase({
      layout: 'column',
      ratios: [0.8, 0.8],
      availW: 320,
      availH: 380,
      gap: 'small',
      frame: 'none',
      mobile: true,
    })!
    expect(col.orientation).toBe('column')
  })
})

describe('rendu de la composition', () => {
  const wrap = (node: React.ReactElement) =>
    createElement(NextIntlClientProvider as React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>, { locale: 'fr', messages: {} }, node)

  const render = (showcase: PaintingShowcase) =>
    renderToStaticMarkup(
      wrap(
        createElement(ShowcaseArtwork, {
          painting: painting(),
          showcase,
          alt: 'Triptyque du matin',
          sizes: '300px',
          frame: 'none',
          containerWidth: 560,
          maxHeight: 500,
          mobile: false,
        })
      )
    )

  it("'row' : chaque toile dans son propre cadre, même hauteur", () => {
    const html = render({
      layout: 'row',
      photos: [photo('a'), photo('b'), photo('c')],
      gap: 'medium',
    })
    expect((html.match(/fx fx-none/g) || []).length).toBe(3)
    expect(html.match(/wall-art-img/g)?.length).toBe(3)
  })

  it("'column' : parties empilées, même largeur", () => {
    const html = render({
      layout: 'column',
      photos: [photo('a'), photo('b')],
      gap: 'small',
    })
    expect(html).toContain('flex-col')
    expect((html.match(/fx fx-none/g) || []).length).toBe(2)
  })

  it("'single' : la photo choisie seule dans son cadre", () => {
    const html = render({
      layout: 'single',
      photos: [photo('chosen', 600, 900)],
      gap: 'medium',
    })
    expect((html.match(/fx fx-none/g) || []).length).toBe(1)
    expect(html).toContain('galerie-mc/chosen')
    expect(html).not.toContain('galerie-mc/main')
  })
})
