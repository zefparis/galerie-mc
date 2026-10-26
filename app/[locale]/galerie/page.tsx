import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getPaintings } from '@/lib/data'
import { localizePainting } from '@/lib/i18n'
import { isGalleryCategory } from '@/lib/catalog'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import GalleryClient from '@/components/gallery/GalleryClient'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ categorie?: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations({ locale })
  // ?categorie=dessins est ignoré ici : les dessins ont leur page dédiée.
  const cat = isGalleryCategory(searchParams.categorie) ? searchParams.categorie : null
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

export default async function GaleriePage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslations()
  const paintings = (await getPaintings()).map((p) => localizePainting(p, params.locale as Locale))
  const cat = isGalleryCategory(searchParams.categorie) ? searchParams.categorie : null
  const title = cat ? t(`categories.${cat}`) : t('galerie.title')
  const introKey = cat === 'collages' ? 'introCollages' : cat === 'peintures' ? 'introPeintures' : 'introAll'

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto gutter-x pt-10 md:pt-20 pb-8 md:pb-12">
        <Reveal>
          <p className="eyebrow">{t('galerie.eyebrow')}</p>
          <h1 className="font-display title-page text-[var(--ink)] mt-3">
            {title}
          </h1>
          <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-lg">
            {t(`galerie.${introKey}`)}
          </p>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto gutter-x pb-20 md:pb-32">
        <Suspense>
          <GalleryClient paintings={paintings} />
        </Suspense>
      </section>
    </div>
  )
}
