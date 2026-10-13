import type { Metadata } from "next"
import localFont from "next/font/local"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import "./globals.css"
import Navbar from "@/components/ui/Navbar"
import Footer from "@/components/ui/Footer"
import LocaleBanner from "@/components/ui/LocaleBanner"
import { getGallerySettings } from "@/lib/data"
import { localizeSettings } from "@/lib/i18n"
import { routing, type Locale } from "@/i18n/routing"

// Fonts auto-hébergées : aucun appel réseau au build, rendu instantané.
const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-garamond.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-garamond-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
})

const inter = localFont({
  src: [
    { path: "./fonts/inter.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://galerie-marie-claire.vercel.app"
  ),
  title: {
    // Nom propre seul : valable dans les 4 langues (utilisé par la 404
    // racine et l'admin ; chaque page publique pose son propre titre).
    default: "Marie-Claire Scandella",
    template: "%s — Marie-Claire Scandella",
  },
  description:
    "Galerie en ligne de Marie-Claire Scandella, artiste peintre abstraite à Montreuil-aux-Lions. Œuvres originales : huile, acrylique, aquarelle.",
  openGraph: {
    title: "Marie-Claire Scandella — Artiste Peintre",
    description:
      "Galerie en ligne de Marie-Claire Scandella, artiste peintre abstraite à Montreuil-aux-Lions.",
    images: ["/og-image.jpg"],
    locale: "fr_FR",
    type: "website",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Le layout racine est au-dessus du segment [locale] : params.locale n'y
  // arrive jamais. La locale réelle vient du header X-NEXT-INTL-LOCALE posé
  // par le middleware (getLocale le lit) ; repli fr pour /admin et la 404.
  const requestLocale = await getLocale().catch(() => undefined)
  const locale: Locale = routing.locales.includes(requestLocale as Locale)
    ? (requestLocale as Locale)
    : routing.defaultLocale
  const [settings, messages] = await Promise.all([
    Promise.all([getGallerySettings(), getTranslations({ locale, namespace: 'defaults' })]).then(
      ([s, td]) => localizeSettings(s, locale, { bio: td('bio'), bioShort: td('bioShort') })
    ),
    // Messages explicites : garantis quelle que soit la stratégie de rendu
    // (statique ou dynamique), l'héritage implicite n'étant pas fiable.
    getMessages({ locale }).catch(() => undefined),
  ])
  return (
    <html lang={locale} suppressHydrationWarning className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        {/* Applique le thème avant le premier rendu — évite tout flash.
            Choix mémorisé en localStorage ; par défaut : suit l'appareil
            sur le site public, reste clair dans l'admin. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mc-theme'),s=window.matchMedia('(prefers-color-scheme: dark)').matches,a=location.pathname.indexOf('/admin')===0,d=t==='dark'||(t!=='light'&&s&&(t==='auto'||!a));if(d)document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Navbar artistName={settings.artistName} />
          <main className="flex-1">{children}</main>
          <Footer settings={settings} />
          <LocaleBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
