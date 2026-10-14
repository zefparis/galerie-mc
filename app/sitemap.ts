import type { MetadataRoute } from 'next'
import { getPaintings, getPublishedEvents } from '@/lib/data'
import { routing, type Locale } from '@/i18n/routing'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://scandellart.fr'

const url = (path: string, locale: Locale) =>
  `${BASE}${locale === 'fr' ? path : `/${locale}${path}`}`

function entry(path: string): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) languages[l] = url(path, l)
  languages['x-default'] = url(path, 'fr')
  return { url: url(path, 'fr'), alternates: { languages } }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = [
    '',
    '/galerie',
    '/expositions',
    '/contact',
    '/informations-legales',
  ].map(entry)

  // Contenus dynamiques — repli sur les seules pages fixes si la base
  // est injoignable pendant le build.
  try {
    const [paintings, events] = await Promise.all([getPaintings(), getPublishedEvents()])
    return [
      ...staticEntries,
      ...paintings.map((p) => entry(`/oeuvre/${p.id}`)),
      ...events.map((e) => entry(`/expositions/${e.id}`)),
    ]
  } catch {
    return staticEntries
  }
}
