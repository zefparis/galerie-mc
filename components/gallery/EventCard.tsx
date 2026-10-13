import Image from 'next/image'
import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { GalleryEvent } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import { formatDate, type Locale } from '@/lib/i18n'

export function formatEventDate(
  dateStr: string,
  style: 'short' | 'long' = 'long',
  locale: Locale = 'fr'
): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const formatted = formatDate(
    d,
    locale,
    style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { month: 'long', year: 'numeric' }
  )
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default async function EventCard({ event }: { event: GalleryEvent }) {
  const locale = (await getLocale()) as Locale
  return (
    <Link href={`/expositions/${event.id}`} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--line)]">
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={blurDataUrl(event.coverUrl)}
            className="object-cover transition-transform duration-500 ease-gallery group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-2xl text-[var(--muted)] italic">
              {event.title}
            </span>
          </div>
        )}
      </div>
      <div className="mt-4">
        {event.eventDate && (
          <p className="eyebrow">{formatEventDate(event.eventDate, 'short', locale)}</p>
        )}
        <h3 className="font-display text-2xl text-[var(--ink)] mt-1 leading-tight group-hover:text-[var(--accent)] transition-colors duration-200">
          {event.title}
        </h3>
        {event.location && (
          <p className="font-body text-sm text-[var(--muted)] mt-1">
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="font-body text-sm text-[var(--ink-soft)] mt-2 line-clamp-2">
            {event.description}
          </p>
        )}
      </div>
    </Link>
  )
}
