import { getLocale, getTranslations } from 'next-intl/server'
import NotFoundContent from '@/components/ui/NotFoundContent'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { getGallerySettings, hasDrawings } from '@/lib/data'
import { localizeSettings } from '@/lib/i18n'
import { routing, type Locale } from '@/i18n/routing'

// 404 racine : sert les URL non matchées (le catch-all de [locale] y renvoie)
// et les routes hors préfixe (admin). La langue vient de la requête — le
// middleware pose X-NEXT-INTL-LOCALE avant le routage ; repli français hors
// site public. La nav est présente pour que le sélecteur de langue reste
// utilisable depuis une page inexistante.
export default async function NotFound() {
  const requestLocale = await getLocale().catch(() => undefined)
  const locale: Locale = routing.locales.includes(requestLocale as Locale)
    ? (requestLocale as Locale)
    : routing.defaultLocale
  const [settings, td, drawings] = await Promise.all([
    getGallerySettings(),
    getTranslations({ locale, namespace: 'defaults' }),
    hasDrawings(),
  ])
  const localized = localizeSettings(settings, locale, {
    bio: td('bio'),
    bioShort: td('bioShort'),
  })
  return (
    <>
      <Navbar artistName={localized.artistName} locale={locale} hasDrawings={drawings} />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <Footer settings={localized} locale={locale} hasDrawings={drawings} />
    </>
  )
}
