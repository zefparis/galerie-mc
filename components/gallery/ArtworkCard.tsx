'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Painting } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import StatusBadge from './StatusBadge'

const STATUS_TEXT: Record<string, string> = {
  sur_demande: 'Prix sur demande',
  non_a_vendre: 'Non à vendre',
}

export default function ArtworkCard({
  painting: p,
  category,
}: {
  painting: Painting
  category?: string
}) {
  const href =
    category && category !== 'toutes'
      ? `/oeuvre/${p.id}?categorie=${category}`
      : `/oeuvre/${p.id}`
  // Ratio connu en base → zéro saut de mise en page ; sinon mesuré au chargement.
  const [size, setSize] = useState<[number, number] | null>(
    p.imageWidth && p.imageHeight ? [p.imageWidth, p.imageHeight] : null
  )

  const meta = [p.technique, p.dimensions, p.year].filter(Boolean).join(' · ')
  const info =
    p.priceStatus === 'visible' && p.price
      ? `${p.price.toLocaleString('fr-FR')} €`
      : STATUS_TEXT[p.priceStatus] || ''

  const img = (
    <Image
      src={p.imageUrl}
      alt={`${p.title} — ${p.technique || 'œuvre'}${p.year ? `, ${p.year}` : ''}`}
      {...(size
        ? { fill: true as const }
        : { width: 0 as const, height: 0 as const })}
      onLoadingComplete={(el) => {
        if (!size && el.naturalWidth > 0) setSize([el.naturalWidth, el.naturalHeight])
      }}
      className={
        size
          ? 'object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-focus-visible:scale-105'
          : 'w-full h-auto transition-transform duration-700 ease-out group-hover:scale-105 group-focus-visible:scale-105'
      }
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
      placeholder="blur"
      blurDataURL={blurDataUrl(p.imageUrl)}
    />
  )

  return (
    <Link
      href={href}
      className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      aria-label={`Voir l'œuvre « ${p.title} »${meta ? ` — ${meta}` : ''}`}
    >
      <div
        className="relative overflow-hidden rounded-md bg-[var(--surface)]"
        style={size ? { aspectRatio: `${size[0]} / ${size[1]}` } : undefined}
      >
        {img}
        <StatusBadge status={p.priceStatus} />
        {/* Voile + infos au survol / focus clavier (écrans avec hover) */}
        <div className="pointer-events-none absolute inset-0 hidden md:block bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden md:block p-5 opacity-0 translate-y-3 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">
          <h3 className="font-serif text-lg font-normal leading-snug text-white">{p.title}</h3>
          <p className="mt-1 font-body text-xs tracking-wide text-white/85">{meta}</p>
          {info && (
            <p className="mt-1.5 font-body text-xs font-medium uppercase tracking-[0.14em] text-white/90">
              {info}
            </p>
          )}
        </div>
      </div>
      {/* Légende toujours visible sur tactile (pas de survol) */}
      <div className="mt-3 md:hidden">
        <p className="font-serif text-base leading-snug text-[var(--ink)]">
          {p.title}
          {p.year && <span className="text-[var(--muted)]"> · {p.year}</span>}
        </p>
        {p.technique && (
          <p className="mt-0.5 font-body text-xs text-[var(--ink-soft)]">{p.technique}</p>
        )}
        {info && (
          <p className="mt-0.5 font-body text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
            {info}
          </p>
        )}
      </div>
    </Link>
  )
}
