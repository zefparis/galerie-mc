'use client'

import { usePathname } from 'next/navigation'
import { routing, type Locale } from './routing'

// Chemin brut et langue lus directement dans l'URL — indépendants du provider.
// usePathname() de next-intl dépend de la locale du NextIntlClientProvider :
// quand celle-ci est périmée (layout racine mis en cache côté routeur après
// une navigation client), le préfixe n'est plus retiré et Link locale=…
// empile les préfixes (/en/en, /es/de/es/es). Ces helpers lisent l'URL
// réelle, donc restent corrects même dans ce cas — et sur les 404.
// (Import next/navigation autorisé ici : ce fichier est le point d'entrée
// unique pour le chemin brut — interdit ailleurs par ESLint/i18n:check.)

/** Retire TOUS les segments de langue en tête de chemin (/es/de/x → /x). */
export function stripLocalePrefixes(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  while (segments.length && (routing.locales as readonly string[]).includes(segments[0])) {
    segments.shift()
  }
  const rest = '/' + segments.join('/')
  return rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/'
}

/** Langue du premier segment d'URL si c'en est une (/en/galerie → 'en'). */
export function urlLocale(pathname: string): Locale | undefined {
  const first = pathname.split('/').filter(Boolean)[0]
  return (routing.locales as readonly string[]).includes(first)
    ? (first as Locale)
    : undefined
}

/** Chemin courant sans aucun préfixe de langue — à passer à Link/router. */
export function useCleanPathname(): string {
  const raw = usePathname()
  return raw ? stripLocalePrefixes(raw) : '/'
}

/** Langue réelle d'après l'URL ; undefined sur une adresse non préfixée
 *  (français ou route hors site public). */
export function useUrlLocale(): Locale | undefined {
  const raw = usePathname()
  return raw ? urlLocale(raw) : undefined
}
