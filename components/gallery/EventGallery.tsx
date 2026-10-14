'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { EventImage } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import Lightbox from './Lightbox'

interface Props {
  images: EventImage[]
  // Titre de l'exposition, utilisé pour les alt par défaut.
  title: string
  /** next/image sans optimisation (aperçu admin sur fichiers locaux blob:). */
  unoptimized?: boolean
}

// Galerie de miniatures : chaque vignette réserve son ratio exact (pas de
// décalage de mise en page), le clic ouvre la visionneuse plein écran
// (flèches, Échap, balayage tactile, compteur « n / total »).
export default function EventGallery({ images, title, unoptimized }: Props) {
  const t = useTranslations('events')
  const [open, setOpen] = useState<number | null>(null)

  if (images.length === 0) return null

  const altAt = (i: number) =>
    images[i].alt?.trim() || t('photoN', { title, n: i + 1 })

  const current = open !== null ? images[open] : null

  return (
    <>
      {images.length === 1 ? (
        // Une seule photo : présentation large plutôt qu'une miniature seule.
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="block w-full max-w-3xl mx-auto cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label={t('zoomAria', { alt: altAt(0) })}
        >
          <span
            className="relative block w-full overflow-hidden bg-[var(--line)]"
            style={{ aspectRatio: `${images[0].width || 16} / ${images[0].height || 9}` }}
          >
            <Image
              src={images[0].url}
              alt={altAt(0)}
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              unoptimized={unoptimized}
              placeholder="blur"
              blurDataURL={blurDataUrl(images[0].url)}
              className="object-cover"
              loading="lazy"
            />
          </span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {images.map((img, i) => (
            <li key={img.publicId || img.url}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block w-full cursor-zoom-in group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label={t('zoomAria', { alt: altAt(i) })}
              >
                <span
                  className="relative block w-full overflow-hidden bg-[var(--line)]"
                  style={{ aspectRatio: `${img.width || 4} / ${img.height || 3}` }}
                >
                  <Image
                    src={img.url}
                    alt={altAt(i)}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    unoptimized={unoptimized}
                    placeholder="blur"
                    blurDataURL={blurDataUrl(img.url)}
                    className="object-cover transition-transform duration-500 ease-gallery group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && open !== null && (
        <Lightbox
          src={current.url}
          alt={altAt(open)}
          unoptimized={unoptimized}
          counter={`${open + 1} / ${images.length}`}
          onClose={() => setOpen(null)}
          onPrev={() => setOpen((open + images.length - 1) % images.length)}
          onNext={() => setOpen((open + 1) % images.length)}
        />
      )}
    </>
  )
}
