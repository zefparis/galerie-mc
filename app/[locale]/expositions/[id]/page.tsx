import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getPublishedEventById } from '@/lib/data'
import { localizeEvent } from '@/lib/i18n'
import { EventMedia } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import { formatEventDate } from '@/components/gallery/EventCard'
import EventGallery from '@/components/gallery/EventGallery'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'events' })
  const event = await getPublishedEventById(params.id)
  if (!event) return { title: t('notFound') }
  const le = localizeEvent(event, locale)

  const description = le.description?.slice(0, 160) ||
    [le.location, event.eventDate && formatEventDate(event.eventDate, 'long', locale)]
      .filter(Boolean)
      .join(' — ')

  return {
    title: le.title,
    description,
    alternates: alternatesFor(`/expositions/${params.id}`, locale),
    openGraph: {
      title: `${le.title} — Marie-Claire Scandella`,
      description,
      images: event.coverUrl ? [event.coverUrl] : undefined,
      type: 'article',
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

function MediaItem({ media, videoTitle }: { media: EventMedia; videoTitle: string }) {
  if (media.type === 'video') {
    const ytId = getYouTubeId(media.url)
    if (!ytId) return null
    return (
      <figure>
        <div className="aspect-[16/9] overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={media.caption || videoTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
          />
        </div>
        {media.caption && (
          <figcaption className="font-body text-xs text-[var(--muted)] mt-2 italic">
            {media.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  return (
    <figure className="break-inside-avoid mb-5">
      <Image
        src={media.url}
        alt={media.caption || ''}
        width={0}
        height={0}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        placeholder="blur"
        blurDataURL={blurDataUrl(media.url)}
        className="w-full h-auto"
        loading="lazy"
      />
      {media.caption && (
        <figcaption className="font-body text-xs text-[var(--muted)] mt-2 italic">
          {media.caption}
        </figcaption>
      )}
    </figure>
  )
}

export default async function ExpositionDetailPage(props: Props) {
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations('events')
  const event = await getPublishedEventById(params.id)
  if (!event) notFound()
  const le = localizeEvent(event, locale)

  const videos = event.media.filter((m) => m.type === 'video')
  const videoTitle = t('videoTitle')

  return (
    <div className="pt-16 md:pt-20">
      <div className="max-w-4xl mx-auto gutter-x pt-6 md:pt-10">
        <Link
          href="/expositions"
          className="inline-flex items-center min-h-[44px] font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
        >
          {t('backList')}
        </Link>
      </div>

      <header className="max-w-4xl mx-auto gutter-x pt-6 md:pt-10 pb-10">
        <Reveal>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {event.eventDate && (
              <p className="eyebrow">{formatEventDate(event.eventDate, 'long', locale)}</p>
            )}
            {le.location && (
              <p className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                {le.location}
              </p>
            )}
          </div>
          <h1 className="font-display title-page text-[var(--ink)] mt-3 leading-[1.05] text-balance">
            {le.title}
          </h1>
          {le.titleOriginal && (
            <p className="font-body text-xs text-[var(--muted)] mt-2 italic">{le.titleOriginal}</p>
          )}
        </Reveal>
      </header>

      {/* Bandeau 16/9 seulement sans photos (la 1re photo joue le rôle de
          couverture et s'affiche dans la galerie ci-dessous). */}
      {event.coverUrl && le.images.length === 0 && (
        <Reveal className="max-w-5xl mx-auto gutter-x pb-10 md:pb-14">
          <div className="relative aspect-[16/9] overflow-hidden bg-[var(--line)]">
            <Image
              src={event.coverUrl}
              alt={le.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              placeholder="blur"
              blurDataURL={blurDataUrl(event.coverUrl)}
              className="object-cover"
            />
          </div>
        </Reveal>
      )}

      {le.description && (
        <Reveal className="max-w-3xl mx-auto gutter-x pb-12 md:pb-16">
          <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">
            {le.description}
          </p>
        </Reveal>
      )}

      {le.images.length > 0 && (
        <section className="max-w-5xl mx-auto gutter-x pb-12 md:pb-16">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)] mb-8">
              {t('photos')}
            </h2>
          </Reveal>
          <EventGallery images={le.images} title={le.title} />
        </section>
      )}

      {videos.length > 0 && (
        <section className="max-w-4xl mx-auto gutter-x pb-12 md:pb-16">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)] mb-8">
              {t('videos')}
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {videos.map((m, i) => (
              <MediaItem key={i} media={m} videoTitle={videoTitle} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
