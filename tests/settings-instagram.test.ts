import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { instagramInputValue, normalizeInstagramUrl } from '../lib/instagram'
import { settingsBodySchema } from '../lib/validation'
import { DEFAULT_SETTINGS, mergeSettings } from '../lib/storage'
import InstagramLink from '../components/ui/InstagramLink'

const ROOT = process.cwd()
const readSrc = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('normalizeInstagramUrl', () => {
  it.each([
    'https://www.instagram.com/marie.claire_art',
    'instagram.com/marie.claire_art',
    '@marie.claire_art',
    'marie.claire_art',
  ])('normalise %s en URL canonique', (input) => {
    expect(normalizeInstagramUrl(input)).toBe(
      'https://www.instagram.com/marie.claire_art/'
    )
  })

  it('accepte www. et le slash final dans l’URL complète', () => {
    expect(normalizeInstagramUrl('https://instagram.com/compte_1/')).toBe(
      'https://www.instagram.com/compte_1/'
    )
    expect(normalizeInstagramUrl('www.instagram.com/compte_1')).toBe(
      'https://www.instagram.com/compte_1/'
    )
  })

  it('rejette un autre domaine et les schémas non https', () => {
    expect(normalizeInstagramUrl('https://twitter.com/compte')).toBeNull()
    expect(normalizeInstagramUrl('https://instagr.am/compte')).toBeNull()
    expect(normalizeInstagramUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeInstagramUrl('data:text/html,<b>x</b>')).toBeNull()
    expect(normalizeInstagramUrl('http://instagram.com/compte')).toBeNull()
  })

  it('rejette les identifiants invalides ou trop longs', () => {
    expect(normalizeInstagramUrl('compte-invalide')).toBeNull()
    expect(normalizeInstagramUrl('x'.repeat(31))).toBeNull()
    expect(normalizeInstagramUrl('')).toBeNull()
    expect(normalizeInstagramUrl('   ')).toBeNull()
    expect(normalizeInstagramUrl(null)).toBeNull()
    expect(normalizeInstagramUrl(undefined)).toBeNull()
  })
})

describe('settingsBodySchema — instagramUrl / phone', () => {
  const base = { artistName: 'Marie-Claire Scandella' }

  it('normalise les formats acceptés et vide → null', () => {
    const r = settingsBodySchema.parse({ ...base, instagramUrl: '@compte.art' })
    expect(r.instagramUrl).toBe('https://www.instagram.com/compte.art/')
    const empty = settingsBodySchema.parse({ ...base, instagramUrl: '' })
    expect(empty.instagramUrl).toBeNull()
    const absent = settingsBodySchema.parse(base)
    expect(absent.instagramUrl).toBeNull()
  })

  it('rejette un lien Instagram invalide avec un message clair', () => {
    const r = settingsBodySchema.safeParse({
      ...base,
      instagramUrl: 'javascript:alert(1)',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toContain('Instagram')
    }
  })

  it('ignore un champ phone envoyé (retiré des réglages)', () => {
    const r = settingsBodySchema.parse({ ...base, phone: '0600000000' })
    expect('phone' in r).toBe(false)
  })
})

describe('mergeSettings — clés héritées', () => {
  it('convertit l’ancienne clé instagram en instagramUrl', () => {
    const s = mergeSettings({ instagram: '@marie.claire' })
    expect(s.instagramUrl).toBe('https://www.instagram.com/marie.claire/')
    expect('instagram' in s).toBe(false)
    expect('phone' in s).toBe(false)
  })

  it('instagramUrl existant a priorité, null par défaut', () => {
    const s = mergeSettings({
      instagramUrl: 'https://www.instagram.com/deja/',
      instagram: '@autre',
    })
    expect(s.instagramUrl).toBe('https://www.instagram.com/deja/')
    expect(mergeSettings({}).instagramUrl).toBeNull()
    expect(DEFAULT_SETTINGS.instagramUrl).toBeNull()
  })
})

describe('InstagramLink', () => {
  it('ne rend rien quand l’URL est absente', () => {
    expect(
      renderToStaticMarkup(
        createElement(InstagramLink, { url: null, ariaLabel: 'x' })
      )
    ).toBe('')
    expect(
      renderToStaticMarkup(
        createElement(InstagramLink, { url: undefined, ariaLabel: 'x' })
      )
    ).toBe('')
  })

  it('rend un lien sécurisé en nouvel onglet', () => {
    const html = renderToStaticMarkup(
      createElement(InstagramLink, {
        url: 'https://www.instagram.com/marie.claire_art/',
        ariaLabel: 'Instagram de Marie-Claire Scandella (nouvel onglet)',
      })
    )
    expect(html).toContain('href="https://www.instagram.com/marie.claire_art/"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer me"')
    expect(html).toContain('aria-label')
    expect(html).toContain('Instagram')
  })
})

describe('absence de téléphone (contrat de source)', () => {
  it.each([
    'components/ui/Footer.tsx',
    'app/[locale]/contact/page.tsx',
    'components/contact/ContactForm.tsx',
    'components/admin/AdminSettings.tsx',
    'app/layout.tsx',
  ])('%s ne contient ni tel: ni phone', (file) => {
    const src = readSrc(file)
    expect(src).not.toMatch(/tel:/)
    expect(src).not.toMatch(/\bphone\b/i)
    expect(src).not.toMatch(/telephone/i)
  })

  it('le pied de page et le JSON-LD exposent instagramUrl', () => {
    expect(readSrc('components/ui/Footer.tsx')).toContain('settings.instagramUrl')
    expect(readSrc('app/layout.tsx')).toContain('sameAs')
  })
})

describe('affichage admin', () => {
  it('affiche l’URL canonique sous forme @identifiant', () => {
    expect(
      instagramInputValue('https://www.instagram.com/marie.claire_art/')
    ).toBe('@marie.claire_art')
    expect(instagramInputValue(null)).toBe('')
    expect(instagramInputValue('saisie-libre')).toBe('saisie-libre')
  })
})
