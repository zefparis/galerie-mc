import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getPaintings } from '@/lib/data'
import { isCategory } from '@/lib/catalog'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import GalleryClient from '@/components/gallery/GalleryClient'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: { locale: string }
  searchParams: { categorie?: string }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = params.locale as Locale
  const t = await getTranslations({ locale })
  const cat = isCategory(searchParams.categorie) ? searchParams.categorie : null
  const label = cat ? t(`categories.${cat}`) : t('galerie.title')
  const description = t(
    cat === 'collages'
      ? 'galerie.metaDescCollages'
      : cat === 'peintures'
        ? 'galerie.metaDescPeintures'
        : 'galerie.metaDescAll'
  )
  const qs = cat ? `?categorie=${cat}` : ''
  return {
    title: label,
    description,
    alternates: alternatesFor(`/galerie${qs}`, locale),
    openGraph: {
      title: `${label} — Marie-Claire Scandella`,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

export default async function GaleriePage({ searchParams }: Props) {
  const t = await getTranslations()
  const paintings = await getPaintings()
  const cat = isCategory(searchParams.categorie) ? searchParams.categorie : null
  const title = cat ? t(`categories.${cat}`) : t('galerie.title')
  const introKey = cat === 'collages' ? 'introCollages' : cat === 'peintures' ? 'introPeintures' : 'introAll'

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-8 md:pb-12">
        <Reveal>
          <p className="eyebrow">{t('galerie.eyebrow')}</p>
          <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
            {title}
          </h1>
          <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-lg">
            {t(`galerie.${introKey}`)}
          </p>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-20 md:pb-32">
        <Suspense>
          <GalleryClient paintings={paintings} />
        </Suspense>
      </section>
    </div>
  )
}
