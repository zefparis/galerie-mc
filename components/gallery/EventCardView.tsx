'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { GalleryEvent } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'

interface Props {
  event: GalleryEvent
  /** Date déjà formatée par l'appelant (formatEventDate) — le composant
      reste pur : pas de lecture de locale ni de base ici. */
  dateLabel: string
  /** next/image sans optimisation (aperçu admin sur fichiers locaux). */
  unoptimized?: boolean
  /** Titre affiché comme exemple (champ vide) → atténué, italique. */
  titlePlaceholder?: boolean
}

// Affichage pur de la carte d'exposition — utilisé par EventCard
// (serveur) et par l'aperçu admin en direct.
export default function EventCardView({ event, dateLabel, unoptimized, titlePlaceholder }: Props) {
  const cover = event.coverUrl || event.images?.[0]?.url || ''
  return (
    <Link href={`/expositions/${event.id}`} className="group block">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--line)]">
        {cover ? (
          <Image
            src={cover}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            placeholder="blur"
            blurDataURL={blurDataUrl(cover)}
            unoptimized={unoptimized}
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
        {dateLabel && (
          <p className="eyebrow">{dateLabel}</p>
        )}
        <h3
          className={`font-display text-2xl mt-1 leading-tight group-hover:text-[var(--accent)] transition-colors duration-200 ${
            titlePlaceholder ? 'text-[var(--muted)] italic' : 'text-[var(--ink)]'
          }`}
        >
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
