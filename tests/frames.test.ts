import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import FramedArt from '../components/frames/FramedArt'
import {
  DEFAULT_FRAME,
  FRAME_IDS,
  FRAME_LABEL_FR,
  FRAME_ROWS,
  isFrameId,
  mapFrameId,
  mapHeroFrameId,
  resolveFrame,
} from '../lib/frames'
import { mergeSettings } from '../lib/storage'
import { paintingBodySchema, settingsBodySchema } from '../lib/validation'

const ROOT = process.cwd()

describe('gamme de cadres', () => {
  it('exactement 11 cadres, regroupés en 5 lignes', () => {
    expect(FRAME_IDS).toHaveLength(11)
    expect(FRAME_IDS).toContain('gold-classic')
    expect(FRAME_IDS).toContain('none')
    expect(FRAME_ROWS).toHaveLength(5)
    expect(FRAME_ROWS[4]).toEqual(['none'])
    expect([...FRAME_ROWS.flat()].sort()).toEqual([...FRAME_IDS].sort())
    for (const id of FRAME_ROWS.flat()) expect(isFrameId(id)).toBe(true)
  })

  it('convertit les anciens identifiants vers la nouvelle gamme', () => {
    expect(mapFrameId('mat-black')).toBe('black-thin')
    expect(mapFrameId('floater')).toBe('black-medium')
    expect(mapFrameId('oak')).toBe('wood-medium')
    expect(mapFrameId('walnut')).toBe('wood-wide')
    expect(mapFrameId('white-gallery')).toBe('white-medium')
    expect(mapFrameId('gold-baroque')).toBe('gold-classic')
    expect(mapFrameId('silver')).toBe('gold-classic')
    expect(mapFrameId('rococo')).toBeNull()
    // 'none' est un cadre valide : conservé tel quel partout.
    expect(mapFrameId('none')).toBe('none')
    expect(mapHeroFrameId('none')).toBe('none')
    // Repli du cadre général : inconnu → gold-classic (jamais null).
    expect(mapHeroFrameId('silver')).toBe('gold-classic')
    expect(mapHeroFrameId('oak')).toBe('wood-medium')
  })
})

describe('resolveFrame (règle d’affichage unique)', () => {
  it('le cadre propre à la toile prime sur le cadre général', () => {
    expect(resolveFrame({ frame: 'oak' }, { heroFrame: 'white-thin' })).toBe('wood-medium')
    expect(resolveFrame({ frame: 'black-wide' }, { heroFrame: 'wood-thin' })).toBe('black-wide')
  })

  it('repli sur le cadre général quand la toile n’en a pas', () => {
    expect(resolveFrame({ frame: null }, { heroFrame: 'walnut' })).toBe('wood-wide')
    expect(resolveFrame({ frame: undefined }, { heroFrame: 'white-wide' })).toBe('white-wide')
    expect(resolveFrame({}, { heroFrame: 'black-thin' })).toBe('black-thin')
  })

  it('repli « gold-classic » sur valeurs absentes ou inconnues', () => {
    expect(resolveFrame({ frame: null }, { heroFrame: undefined })).toBe(DEFAULT_FRAME)
    expect(resolveFrame({ frame: 'bogus' }, { heroFrame: 'bogus2' })).toBe(DEFAULT_FRAME)
    expect(resolveFrame({}, undefined)).toBe(DEFAULT_FRAME)
    expect(resolveFrame({ frame: 'none' }, { heroFrame: 'wood-thin' })).toBe('none')
  })
})

describe('validation zod des cadres', () => {
  const base = {
    title: 'Lumière',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/x',
    imagePublicId: 'galerie-mc/x',
  }

  it('frame : identifiant valide accepté, NULL accepté, ancien/inconnu rejeté', () => {
    for (const id of FRAME_IDS) {
      expect(paintingBodySchema.safeParse({ ...base, frame: id }).success).toBe(true)
    }
    expect(paintingBodySchema.safeParse({ ...base, frame: null }).success).toBe(true)
    for (const old of ['oak', 'walnut', 'silver', 'floater', 'mat-black', 'white-gallery', 'gold-baroque']) {
      expect(paintingBodySchema.safeParse({ ...base, frame: old }).success, old).toBe(false)
    }
  })

  it('heroFrame : identifiant valide accepté, inconnu rejeté, défaut gold-classic', () => {
    expect(settingsBodySchema.safeParse({ artistName: 'Marie-Claire', heroFrame: 'wood-thin' }).success).toBe(true)
    expect(settingsBodySchema.safeParse({ artistName: 'M', heroFrame: 'oak' }).success).toBe(false)
    expect(settingsBodySchema.parse({ artistName: 'Marie-Claire' }).heroFrame).toBe('gold-classic')
  })
})

describe('mergeSettings : cadre général tolérant', () => {
  it('anciens ids et valeurs inconnues retombent sur l’équivalent ou le défaut', () => {
    expect(mergeSettings({ heroFrame: 'oak' }).heroFrame).toBe('wood-medium')
    expect(mergeSettings({ heroFrame: 'rococo' }).heroFrame).toBe('gold-classic')
    expect(mergeSettings({}).heroFrame).toBe('gold-classic')
    expect(mergeSettings({ heroFrame: 'black-wide' }).heroFrame).toBe('black-wide')
  })

  it('les libellés français admin suivent la référence messages/fr.json', () => {
    const fr = JSON.parse(readFileSync(join(ROOT, 'messages/fr.json'), 'utf8'))
    for (const id of FRAME_IDS) {
      expect(FRAME_LABEL_FR[id]).toBe(fr.frames[id])
      expect(isFrameId(id)).toBe(true)
    }
  })
})

describe('rendu des cadres (FramedArt)', () => {
  const img = createElement('img', { className: 'wall-art-img', src: 'x', alt: '' })

  it('gold-classic garde la maquette historique .gf avec ses pièces', () => {
    const html = renderToStaticMarkup(
      createElement(FramedArt, { frame: 'gold-classic', w: 4, h: 5, children: img })
    )
    expect(html).toContain('class="gf"')
    expect(html).toContain('gf-art')
    expect(html).toContain('gf-ctl')
    expect(html).toContain('gf-cbr')
  })

  it('« Sans cadre » rend la toile nue : pas de baguette, ombre conservée', () => {
    const html = renderToStaticMarkup(
      createElement(FramedArt, { frame: 'none', w: 4, h: 5, children: img })
    )
    expect(html).toContain('fx fx-none')
    const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
    expect(css).toContain('.fx-none')
    expect(css).toMatch(/\.fx-none\s*\{[^}]*--fx-t:\s*0px/)
    expect(css).toMatch(/\.fx-none \.fx-art\s*\{[^}]*box-shadow:\s*var\(--art-shadow\)/)
  })

  it('chaque cadre CSS rend sa variante .fx-* avec mat + art', () => {
    for (const id of FRAME_IDS.filter((f) => f !== 'gold-classic')) {
      const html = renderToStaticMarkup(
        createElement(FramedArt, { frame: id, w: 16, h: 9, children: img })
      )
      expect(html, id).toContain(`fx fx-${id}`)
      expect(html, id).toContain('fx-mat')
      expect(html, id).toContain('fx-art')
    }
  })
})

describe('contrats API cadres', () => {
  it('la réinitialisation globale est protégée par requireAdmin et remet frame à NULL', () => {
    const src = readFileSync(join(ROOT, 'app/api/paintings/reset-frames/route.ts'), 'utf8')
    expect(src).toContain('requireAdmin(req)')
    expect(src).toContain('frame = NULL')
  })

  it('frame est dans les projections publiques, analysis jamais', () => {
    for (const rel of [
      'lib/data.ts',
      'app/api/paintings/route.ts',
      'app/api/paintings/[id]/route.ts',
    ]) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      for (const m of src.matchAll(/(?:PUBLIC_COLS|PAINTING_PUBLIC_COLS)\s*=\s*`([^`]*)`/g)) {
        expect(m[1], `${rel} : frame manquant de la projection`).toContain('frame')
        expect(m[1], `${rel} : la projection publique contient analysis`).not.toContain('analysis')
      }
    }
  })
})
