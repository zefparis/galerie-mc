import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intl = createMiddleware(routing, {
  localeDetection: false,
})

const LOCALE_SET = new Set<string>(routing.locales)

/**
 * Nettoie les adresses cassées produites par l'ancien sélecteur de langue
 * (préfixes empilés : /en/en, /es/de/es/es) et le préfixe /fr interdit :
 *  - /fr/...            → sans préfixe (le français n'en a pas)
 *  - /es/de/es/es       → garde la DERNIÈRE langue valide : /es
 *  - /en/en/galerie     → /en/galerie
 * Query string et reste du chemin conservés. Pas de boucle : la cible n'a
 * qu'un seul préfixe, jamais /fr.
 */
export default function middleware(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean)
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
  // Tout sauf API, admin, fichiers internes Next et fichiers statiques.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
