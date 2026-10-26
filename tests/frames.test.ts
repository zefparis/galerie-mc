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
  isFrameId,
  resolveFrame,
} from '../lib/frames'
import { mergeSettings } from '../lib/storage'
import { paintingBodySchema, settingsBodySchema } from '../lib/validation'

const ROOT = process.cwd()

describe('resolveFrame (règle d’affichage unique)', () => {
  it('le cadre propre à la toile prime sur le cadre général', () => {
    expect(resolveFrame({ frame: 'oak' }, { heroFrame: 'silver' })).toBe('oak')
    expect(resolveFrame({ frame: 'none' }, { heroFrame: 'gold-baroque' })).toBe('none')
  })

  it('repli sur le cadre général quand la toile n’en a pas', () => {
    expect(resolveFrame({ frame: null }, { heroFrame: 'walnut' })).toBe('walnut')
    expect(resolveFrame({ frame: undefined }, { heroFrame: 'floater' })).toBe('floater')
    expect(resolveFrame({}, { heroFrame: 'mat-black' })).toBe('mat-black')
  })

  it('repli « gold-classic » sur valeurs absentes ou inconnues', () => {
    expect(resolveFrame({ frame: null }, { heroFrame: undefined })).toBe(DEFAULT_FRAME)
    expect(resolveFrame({ frame: 'baroque-x' }, { heroFrame: 'silver' })).toBe('silver')
    expect(resolveFrame({ frame: 'bogus' }, { heroFrame: 'bogus2' })).toBe(DEFAULT_FRAME)
    expect(resolveFrame({}, undefined)).toBe(DEFAULT_FRAME)
    expect(resolveFrame({ frame: 42 as unknown as string }, {})).toBe(DEFAULT_FRAME)
  })
})

describe('validation zod des cadres', () => {
  const base = {
    title: 'Lumière',
    imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/x',
    imagePublicId: 'galerie-mc/x',
  }

  it('frame : identifiant valide accepté, NULL accepté, inconnu rejeté', () => {
    for (const id of FRAME_IDS) {
      expect(paintingBodySchema.safeParse({ ...base, frame: id }).success).toBe(true)
    }
    expect(paintingBodySchema.safeParse({ ...base, frame: null }).success).toBe(true)
    expect(paintingBodySchema.safeParse({ ...base, frame: 'dore-louis-xv' }).success).toBe(false)
    expect(paintingBodySchema.safeParse({ ...base, frame: 5 }).success).toBe(false)
  })

  it('heroFrame : identifiant valide accepté, inconnu rejeté, défaut gold-classic', () => {
    const ok = settingsBodySchema.safeParse({ artistName: 'Marie-Claire', heroFrame: 'oak' })
    expect(ok.success).toBe(true)
    expect(settingsBodySchema.safeParse({ artistName: 'M', heroFrame: 'pas-un-cadre' }).success).toBe(false)
    const def = settingsBodySchema.parse({ artistName: 'Marie-Claire' })
    expect(def.heroFrame).toBe('gold-classic')
  })
})

describe('mergeSettings : cadre général tolérant', () => {
  it('une valeur inconnue en base retombe sur gold-classic', () => {
    expect(mergeSettings({ heroFrame: 'rococo' }).heroFrame).toBe('gold-classic')
    expect(mergeSettings({}).heroFrame).toBe('gold-classic')
    expect(mergeSettings({ heroFrame: 'walnut' }).heroFrame).toBe('walnut')
    expect(mergeSettings({ heroFrame: null }).heroFrame).toBe('gold-classic')
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
    expect(src).toContain("export const dynamic = 'force-dynamic'")
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
