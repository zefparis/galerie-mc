import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intl = createMiddleware(routing, {
  localeDetection: false,
})

const LOCALE_SET = new Set<string>(routing.locales)
const CANONICAL_HOST = 'scandellart.fr'

// Hors périmètre i18n : atelier, API et routes de métadonnées générées
// (icon1, apple-icon, opengraph-image — celles sans extension de fichier).
const PASSTHROUGH = /^\/(api|admin|icon\d*|apple-icon|opengraph-image|twitter-image|manifest|sitemap|robots)(\/|$)/

/**
 * 1. Canonisation d'hôte (production uniquement) : tout accès à
 *    *.vercel.app (hors previews « -git- ») et à www.scandellart.fr
 *    redirige en 308 vers https://scandellart.fr, chemin et langue
 *    conservés. /api n'est pas redirigé.
 * 2. Nettoie les adresses cassées (préfixes empilés /en/en, /es/de/es/es)
 *    et le préfixe /fr interdit. Query string conservée, cible à un seul
 *    préfixe jamais /fr — pas de boucle.
 */
export default function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]
  const { pathname, search } = req.nextUrl

  const isPreview = host.includes('-git-')
  const needsCanonical =
    host === `www.${CANONICAL_HOST}` || (host.endsWith('.vercel.app') && !isPreview)
  if (needsCanonical && !pathname.startsWith('/api')) {
    return NextResponse.redirect(
      `https://${CANONICAL_HOST}${pathname}${search}`,
      308
    )
  }

  if (PASSTHROUGH.test(pathname)) return NextResponse.next()

  const segments = pathname.split('/').filter(Boolean)
  let i = 0
  while (i < segments.length && LOCALE_SET.has(segments[i])) i++

  if (i >= 2 || (i === 1 && segments[0] === 'fr')) {
    const last = segments[i - 1]
    const rest = '/' + segments.slice(i).join('/')
    const target =
      last === 'fr' ? rest : `/${last}${rest === '/' ? '' : rest}`
    const url = req.nextUrl.clone()
    url.pathname = target
    return NextResponse.redirect(url, 308)
  }

  return intl(req)
}

export const config = {
  // Tout sauf API (jamais redirigée ni localisée), fichiers internes Next
  // et fichiers statiques (avec extension). /admin passe pour la
  // canonisation d'hôte, puis sort avant la localisation.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
