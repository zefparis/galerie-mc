import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedEventById } from '@/lib/data'
import { EventMedia } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import { formatEventDate } from '@/components/gallery/EventCard'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getPublishedEventById(params.id)
  if (!event) return { title: 'Événement introuvable' }

  const description = event.description?.slice(0, 160) ||
    [event.location, event.eventDate && formatEventDate(event.eventDate)]
      .filter(Boolean)
      .join(' — ')

  return {
    title: event.title,
    description,
    openGraph: {
      title: `${event.title} — Marie-Claire Scandella`,
      description,
      images: event.coverUrl ? [event.coverUrl] : undefined,
      type: 'article',
    },
  }
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

function MediaItem({ media }: { media: EventMedia }) {
  if (media.type === 'video') {
    const ytId = getYouTubeId(media.url)
    if (!ytId) return null
    return (
      <figure>
        <div className="aspect-[16/9] overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={media.caption || 'Vidéo'}
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
        alt={media.caption || 'Photo de l\u2019événement'}
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

export default async function ExpositionDetailPage({ params }: Props) {
  const event = await getPublishedEventById(params.id)
  if (!event) notFound()

  const photos = event.media.filter((m) => m.type === 'photo')
  const videos = event.media.filter((m) => m.type === 'video')

  return (
    <div className="pt-16 md:pt-20">
      <div className="max-w-4xl mx-auto px-5 md:px-8 pt-6 md:pt-10">
        <Link
          href="/expositions"
          className="inline-flex items-center min-h-[44px] font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
        >
          ← Expositions
        </Link>
      </div>

      <header className="max-w-4xl mx-auto px-5 md:px-8 pt-6 md:pt-10 pb-10">
        <Reveal>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {event.eventDate && (
              <p className="eyebrow">{formatEventDate(event.eventDate)}</p>
            )}
            {event.location && (
              <p className="font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                {event.location}
              </p>
            )}
          </div>
          <h1 className="font-display text-4xl md:text-6xl text-[var(--ink)] mt-3 leading-[1.05] text-balance">
            {event.title}
          </h1>
        </Reveal>
      </header>

      {event.coverUrl && (
        <Reveal className="max-w-5xl mx-auto px-5 md:px-8 pb-10 md:pb-14">
          <div className="relative aspect-[16/9] overflow-hidden bg-[var(--line)]">
            <Image
              src={event.coverUrl}
              alt={event.title}
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

      {event.description && (
        <Reveal className="max-w-3xl mx-auto px-5 md:px-8 pb-12 md:pb-16">
          <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </Reveal>
      )}

      {photos.length > 0 && (
        <section className="max-w-5xl mx-auto px-5 md:px-8 pb-12 md:pb-16">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)] mb-8">
              Photos
            </h2>
          </Reveal>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
            {photos.map((m, i) => (
              <MediaItem key={i} media={m} />
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 md:px-8 pb-12 md:pb-16">
          <Reveal>
            <h2 className="font-display text-3xl md:text-4xl text-[var(--ink)] mb-8">
              Vidéos
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {videos.map((m, i) => (
              <MediaItem key={i} media={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
