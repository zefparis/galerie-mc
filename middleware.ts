import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Pas de redirection forcée : le français reste servi sur /, le bandeau
// de langue côté client propose la langue du navigateur.
export default createMiddleware(routing, {
  localeDetection: false,
})

export const config = {
  // Tout sauf API, admin, fichiers internes Next et fichiers statiques.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
