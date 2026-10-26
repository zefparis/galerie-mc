import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPaintings } from '@/lib/data'
import { localizePainting } from '@/lib/i18n'
import { drawingsOf } from '@/lib/catalog'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import GalleryClient from '@/components/gallery/GalleryClient'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'dessins' })
  const description = t('metaDesc')
  return {
    title: t('title'),
    description,
    alternates: alternatesFor('/dessins', locale),
    openGraph: {
      title: `${t('title')} — Marie-Claire Scandella`,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

// Page dédiée aux dessins : même rendu que la galerie (grille, filtres
// secondaires, fiche détail), alimentée uniquement par category='dessins'.
// Jamais de page vide : sans dessin, l'onglet est masqué et l'URL répond 404.
export default async function DessinsPage(props: Props) {
  const params = await props.params;
  const t = await getTranslations('dessins')
  const paintings = drawingsOf(await getPaintings()).map((p) =>
    localizePainting(p, params.locale as Locale)
  )
  if (paintings.length === 0) notFound()

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto gutter-x pt-10 md:pt-20 pb-8 md:pb-12">
        <Reveal>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display title-page text-[var(--ink)] mt-3">
            {t('title')}
          </h1>
          <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-lg">
            {t('intro')}
          </p>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto gutter-x pb-20 md:pb-32">
        <Suspense>
          <GalleryClient paintings={paintings} fixedCategory="dessins" />
        </Suspense>
      </section>
    </div>
  )
}
