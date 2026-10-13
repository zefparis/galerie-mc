'use client'

import Image from 'next/image'
import { useState } from 'react'
import Lightbox from '@/components/gallery/Lightbox'
import { blurDataUrl } from '@/lib/images'
import { ArtistPhoto } from '@/lib/types'

interface Props {
  photos: ArtistPhoto[]
  artistName: string
}

// 2–3 photos de l'artiste dans la section Présentation.
// Toucher une photo l'ouvre en grand (lightbox avec navigation).
export default function ArtistPhotos({ photos, artistName }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  if (!photos.length) return null

  return (
    <>
      <div
        className={`grid gap-4 ${
          photos.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : 'grid-cols-2'
        } ${photos.length === 3 ? 'sm:grid-cols-3' : ''}`}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.publicId || photo.url}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-[3/4] overflow-hidden bg-[var(--line)] group cursor-zoom-in"
            aria-label={`Agrandir la photo ${i + 1} de ${artistName}`}
          >
            <Image
              src={photo.url}
              alt={`${artistName} — photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              placeholder="blur"
              blurDataURL={blurDataUrl(photo.url)}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          src={photos[openIndex].url}
          alt={`${artistName} — photo ${openIndex + 1}`}
          onClose={() => setOpenIndex(null)}
          onPrev={photos.length > 1 ? () => setOpenIndex((i) => (i! - 1 + photos.length) % photos.length) : undefined}
          onNext={photos.length > 1 ? () => setOpenIndex((i) => (i! + 1) % photos.length) : undefined}
        />
      )}
    </>
  )
}
