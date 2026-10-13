'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Painting } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import Reveal from '@/components/ui/Reveal'
import Lightbox from './Lightbox'

interface Props {
  painting: Painting
  prevId?: string
  nextId?: string
  category?: string
}

const STATUS_LABEL: Partial<Record<Painting['priceStatus'], string>> = {
  sur_demande: 'Prix sur demande',
  vendu: 'Vendu',
  non_a_vendre: 'Non à vendre',
}

export default function PaintingDetail({ painting, prevId, nextId, category }: Props) {
  const router = useRouter()
  const [lightbox, setLightbox] = useState(false)
  const qs = category ? `?categorie=${category}` : ''

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price)

  const statusLabel = STATUS_LABEL[painting.priceStatus]
  const contactable = painting.priceStatus !== 'vendu' && painting.priceStatus !== 'non_a_vendre'

  return (
    <div className="pt-16 md:pt-20">
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-6 md:pt-10">
        <Link
          href={`/galerie${qs}`}
          className="inline-flex items-center min-h-[44px] font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
        >
          ← Galerie
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 md:flex md:gap-12 lg:gap-20 pb-10">
        {/* Image — cliquable vers la lightbox */}
        <Reveal className="md:w-[58%] md:flex-shrink-0 mt-4 md:mt-0">
          <button
            onClick={() => setLightbox(true)}
            aria-label={`Agrandir « ${painting.title} »`}
            className="block w-full bg-[var(--mat)] border border-[var(--line)] p-3 sm:p-5 md:sticky md:top-24 cursor-zoom-in"
          >
            <Image
              src={painting.imageUrl}
              alt={`${painting.title} — ${painting.technique}, ${painting.year}`}
              width={0}
              height={0}
              sizes="(max-width: 768px) 100vw, 58vw"
              priority
              placeholder="blur"
              blurDataURL={blurDataUrl(painting.imageUrl)}
              className="w-full h-auto max-h-[80svh] object-contain mx-auto"
            />
          </button>
          <p className="font-body text-[11px] text-[var(--muted)] text-center mt-3">
            Cliquer pour agrandir
          </p>
        </Reveal>

        {/* Informations */}
        <Reveal delay={120} className="flex-1 py-8 md:py-0">
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-[var(--ink)] leading-[1.05] text-balance">
            {painting.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 md:mt-6">
            <span className="font-body text-sm text-[var(--ink-soft)]">{painting.year}</span>
            <span className="text-[var(--line)]" aria-hidden="true">·</span>
            <span className="font-body text-sm text-[var(--ink-soft)]">{painting.technique}</span>
            {painting.dimensions && (
              <>
                <span className="text-[var(--line)]" aria-hidden="true">·</span>
                <span className="font-body text-sm text-[var(--ink-soft)]">{painting.dimensions}</span>
              </>
            )}
          </div>

          <div className="mt-6 md:mt-8">
            {painting.priceStatus === 'visible' && painting.price != null ? (
              <p className="font-body text-2xl text-[var(--ink)] font-medium">
                {formatPrice(painting.price)}
              </p>
            ) : statusLabel ? (
              <span
                className={`inline-block font-body text-[11px] font-medium uppercase tracking-[0.18em] px-4 py-2 border ${
                  painting.priceStatus === 'vendu'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--ink-soft)]'
                }`}
              >
                {statusLabel}
              </span>
            ) : null}
          </div>

          {painting.description && (
            <p className="font-body text-base text-[var(--ink-soft)] leading-relaxed mt-8 md:mt-10 whitespace-pre-line">
              {painting.description}
            </p>
          )}

          {contactable && (
            <Link
              href={`/contact?sujet=${encodeURIComponent(`Intérêt pour « ${painting.title} »`)}`}
              className="btn-accent mt-8 md:mt-10 w-full sm:w-auto"
            >
              Manifester son intérêt
            </Link>
          )}
        </Reveal>
      </div>

      {/* Navigation précédente / suivante */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-16 md:pb-24">
        <div className="flex gap-3 justify-between pt-8 border-t border-[var(--line)]">
          {prevId ? (
            <Link
              href={`/oeuvre/${prevId}${qs}`}
              className="inline-flex items-center justify-center min-h-[48px] px-5 sm:px-7 border border-[var(--line)] font-body text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink-soft)] transition-colors duration-200"
            >
              ← Précédente
            </Link>
          ) : <span />}
          {nextId ? (
            <Link
              href={`/oeuvre/${nextId}${qs}`}
              className="inline-flex items-center justify-center min-h-[48px] px-5 sm:px-7 border border-[var(--line)] font-body text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink-soft)] transition-colors duration-200"
            >
              Suivante →
            </Link>
          ) : <span />}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          src={painting.imageUrl}
          alt={`${painting.title} — ${painting.technique}, ${painting.year}`}
          onClose={() => setLightbox(false)}
          onPrev={prevId ? () => router.push(`/oeuvre/${prevId}${qs}`) : undefined}
          onNext={nextId ? () => router.push(`/oeuvre/${nextId}${qs}`) : undefined}
        />
      )}
    </div>
  )
}
