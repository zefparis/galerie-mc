import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import LocaleBanner from '@/components/ui/LocaleBanner'
import HtmlLang from '@/components/ui/HtmlLang'
import InstallBanner from '@/components/pwa/InstallBanner'
import InstallHelpDialog from '@/components/pwa/InstallHelpDialog'
import { getGallerySettings, hasDrawings } from '@/lib/data'
import { localizeSettings } from '@/lib/i18n'
import { routing, type Locale } from '@/i18n/routing'

// Titre par défaut du sous-arbre localisé (nom propre, valable dans toutes
// les langues) — utilisé par la 404 localisée ; chaque page pose le sien.
export const metadata: Metadata = {
  title: { absolute: 'Marie-Claire Scandella' },
}

// Provider + navigation publique ICI (segment [locale]) : ce layout
// re-rend à chaque changement de langue en navigation client, contrairement
// au layout racine dont le rendu est réutilisé par le routeur — c'est ce
// qui figeait la locale et provoquait les préfixes empilés (/en/en…).
export default async function LocaleLayout(
  props: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  if (!routing.locales.includes(params.locale as Locale)) notFound()
  const locale = params.locale as Locale
  const [messages, settings, drawings] = await Promise.all([
    getMessages({ locale }),
    Promise.all([
      getGallerySettings(),
      getTranslations({ locale, namespace: 'defaults' }),
    ]).then(([s, td]) =>
      localizeSettings(s, locale, { bio: td('bio'), bioShort: td('bioShort') })
    ),
    // L'onglet « Dessins » (header + pied de page) n'existe que s'il y a
    // au moins un dessin en ligne.
    hasDrawings(),
  ])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLang locale={locale} />
      <Navbar artistName={settings.artistName} locale={locale} hasDrawings={drawings} />
      {/* .site-texture active la texture « lin » en fond (globals.css,
          body:has) — absente de l'admin, qui garde un fond uni. */}
      <main className="site-texture flex-1">{children}</main>
      <Footer settings={settings} locale={locale} hasDrawings={drawings} />
      <LocaleBanner />
      {/* Invitation d'installation : bannière mobile différée + aide
          partagée (tiroir, pied de page, bannière). */}
      <InstallBanner />
      <InstallHelpDialog />
    </NextIntlClientProvider>
  )
}
