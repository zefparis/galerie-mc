import { describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import middleware from '../middleware'

// Régression open redirect (CVE next-intl 3.x corrigée en 4.x) : aucune
// URL ne doit produire de redirection vers un hôte externe. On vérifie
// aussi les comportements attendus du middleware (canonisation, /fr).

function req(path: string, host = 'scandellart.fr'): NextRequest {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host },
  })
}

function locationOf(res: NextResponse | Response): string | null {
  return res.headers.get('location')
}

function assertStaysOnSite(res: NextResponse | Response) {
  const loc = locationOf(res)
  if (!loc) return // pas de redirection : rien à vérifier
  // Soit chemin relatif, soit https://scandellart.fr — jamais d'autre hôte.
  if (!loc.startsWith('/')) {
    expect(loc.startsWith('https://scandellart.fr')).toBe(true)
  }
  // Une location commençant par // ou \\ serait interprétée comme
  // externe par le navigateur.
  expect(loc.startsWith('//')).toBe(false)
  expect(loc.startsWith('\\\\')).toBe(false)
}

describe('middleware — open redirect : aucune sortie du domaine', () => {
  it.each([
    '//evil.com',
    '/\\/evil.com',
    '\\\\evil.com',
    '/%2f%2fevil.com',
    '/en//evil.com',
    '/en/\\/evil.com',
    '/galerie//evil.com',
    '//evil.com/galerie',
    '/%5c%5cevil.com',
  ])('%s ne redirige jamais hors de scandellart.fr', async (path) => {
    const res = middleware(req(path))
    assertStaysOnSite(res)
  })
})

describe('middleware — canonisation d’hôte (comportement conservé)', () => {
  it('www.scandellart.fr redirige en 308 vers l’apex', () => {
    const res = middleware(req('/galerie?x=1', 'www.scandellart.fr'))
    expect(locationOf(res)).toBe('https://scandellart.fr/galerie?x=1')
  })

  it('un domaine vercel.app redirige vers l’apex, sauf preview -git-', () => {
    const res = middleware(req('/galerie', 'galerie-mc.vercel.app'))
    expect(locationOf(res)).toBe('https://scandellart.fr/galerie')
    const preview = middleware(req('/galerie', 'galerie-mc-git-main.vercel.app'))
    expect(locationOf(preview)).toBeNull()
  })

  it('un hôte étranger manipulé ne produit pas de redirection externe', () => {
    const res = middleware(req('/galerie', 'evil.com'))
    assertStaysOnSite(res)
  })
})

describe('middleware — préfixes de langue', () => {
  it('/fr est interdit : redirige vers le chemin sans préfixe', () => {
    const res = middleware(req('/fr/galerie'))
    const loc = locationOf(res)
    expect(loc).toBeTruthy()
    expect(loc).not.toContain('/fr/')
    assertStaysOnSite(res)
  })

  it('les préfixes empilés /en/de/… sont nettoyés sur un seul préfixe', () => {
    const res = middleware(req('/en/de/galerie'))
    assertStaysOnSite(res)
    const loc = locationOf(res)
    expect(loc).toBeTruthy()
    // un seul préfixe de langue au plus dans la cible
    const target = new URL(loc!, 'https://scandellart.fr')
    const segs = target.pathname.split('/').filter(Boolean)
    const localeCount = segs.filter((s) => ['fr', 'en', 'es', 'de'].includes(s)).length
    expect(localeCount).toBeLessThanOrEqual(1)
  })

  it('/api n’est jamais redirigée ni localisée', () => {
    const res = middleware(req('/api/paintings', 'www.scandellart.fr'))
    // canonisation sautée pour /api → pas de redirection externe
    expect(locationOf(res)).toBeNull()
  })
})
