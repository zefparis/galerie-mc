import { getTranslations } from 'next-intl/server'
import { routing, type Locale } from '@/i18n/routing'
import { brandOg } from '@/lib/brand-image'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = "Scandell'Art — Marie-Claire Scandella"

// Image de partage par langue : la tagline suit la locale du segment.
export default async function OgImage({ params }: { params: { locale: string } }) {
  const locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : routing.defaultLocale
  const t = await getTranslations({ locale, namespace: 'brand' })
  return brandOg(t('tagline'))
}
