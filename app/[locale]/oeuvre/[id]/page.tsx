import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMessages, getTranslations } from 'next-intl/server'
import { getPaintingById, getPaintings, getGallerySettings } from '@/lib/data'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import { localizePainting, techniqueLabel } from '@/lib/i18n'
import PaintingDetail from '@/components/gallery/PaintingDetail'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string; locale: string }
  searchParams: { categorie?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale as Locale
  const t = await getTranslations({ locale })
  const messages = (await getMessages({ locale })) as { techniques?: Record<string, string> }
  const painting = await getPaintingById(params.id)
  if (!painting) return { title: t('detail.notFound') }
  const lp = localizePainting(painting, locale)

  // L'accroche publiée par l'artiste devient la meta description ; repli
  // sur la description composite habituelle sinon.
  const description =
    lp.notice?.accroche ||
    [
      `${techniqueLabel(messages.techniques, painting.technique || '')}, ${painting.year}`,
      painting.dimensions,
      lp.description?.slice(0, 140),
    ]
      .filter(Boolean)
      .join(' — ')

  return {
    title: lp.title,
    description,
    alternates: alternatesFor(`/oeuvre/${params.id}`, locale),
    openGraph: {
      title: `${lp.title} — Marie-Claire Scandella`,
      description,
      images: [painting.imageUrl],
      type: 'article',
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

export default async function OeuvrePage({ params, searchParams }: Props) {
  const locale = params.locale as Locale
  const [painting, all, settings] = await Promise.all([
    getPaintingById(params.id),
    getPaintings(),
    getGallerySettings(),
  ])
  if (!painting) notFound()

  // Précédente/suivante dans la galerie affichée (?categorie=collages),
  // sinon toute la galerie.
  const cat = searchParams.categorie
  const siblings =
    cat === 'peintures' || cat === 'collages'
      ? all.filter((p) => p.category === cat)
      : all
  const index = siblings.findIndex((p) => p.id === painting.id)
  const prevId = index > 0 ? siblings[index - 1].id : undefined
  const nextId = index >= 0 && index < siblings.length - 1 ? siblings[index + 1].id : undefined

  return (
    <PaintingDetail
      painting={localizePainting(painting, locale)}
      artistName={settings.artistName}
      prevId={prevId}
      nextId={nextId}
      category={cat === 'peintures' || cat === 'collages' ? cat : undefined}
    />
  )
}
