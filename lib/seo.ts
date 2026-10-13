import type { Metadata } from 'next'
import { routing, type Locale } from '@/i18n/routing'

export const OG_LOCALE: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_GB',
  es: 'es_ES',
  de: 'de_DE',
}

// Chemins relatifs — résolus contre metadataBase défini dans app/layout.tsx.
// Jamais de chaîne vide : la racine française est "/", sinon le resolver de
// métadonnées de Next plante (new URL('') → null → lecture de .pathname).
function prefixed(path: string, locale: Locale): string {
  return locale === 'fr' ? path || '/' : `/${locale}${path}`
}

/** canonical + hreflang (fr, en, es, de, x-default) pour une page donnée. */
export function alternatesFor(path: string, locale: Locale): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = prefixed(path, l)
  languages['x-default'] = path || '/'
  return { canonical: prefixed(path, locale), languages }
}
