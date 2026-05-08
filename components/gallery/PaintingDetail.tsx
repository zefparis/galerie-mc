'use client'

import { Painting } from '@/lib/types'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface Props {
  painting: Painting
  prevId?: string
  nextId?: string
}

export default function PaintingDetail({ painting, prevId, nextId }: Props) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="min-h-screen"
    >
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-5 md:px-6 pt-4 md:pt-8">
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] font-body text-xs uppercase tracking-[0.12em] text-warm-gray hover:text-charcoal transition-colors duration-300"
        >
          ← Retour à la galerie
        </Link>
      </div>

      {/* Tablet/Desktop: side by side layout */}
      <div className="max-w-7xl mx-auto md:px-6 md:py-10 md:flex md:gap-10 lg:gap-16">
        {/* Image */}
        <div className="md:w-[55%] md:flex-shrink-0">
          <div className="w-full aspect-[4/3] md:aspect-auto md:sticky md:top-24 overflow-hidden bg-[var(--border)]">
            <img
              src={painting.imageUrl}
              alt={painting.title}
              className="w-full h-full md:max-h-[70vh] object-cover md:object-contain md:shadow-lg"
            />
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 px-5 md:px-0 py-6 md:py-0">
          <h1 className="font-display text-2xl sm:text-3xl md:text-[42px] text-charcoal mb-3 md:mb-4">
            {painting.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6 md:mb-8">
            <span className="font-body text-sm text-warm-gray">{painting.year}</span>
            <span className="text-[var(--border)]">·</span>
            <span className="font-body text-sm text-warm-gray">{painting.technique}</span>
            {painting.dimensions && (
              <>
                <span className="text-[var(--border)]">·</span>
                <span className="font-body text-sm text-warm-gray">{painting.dimensions}</span>
              </>
            )}
          </div>

          {painting.description && (
            <p className="font-body text-sm md:text-base text-charcoal/80 leading-relaxed mb-8 md:mb-10">
              {painting.description}
            </p>
          )}

          {/* Price display */}
          <div className="mb-8 md:mb-10">
            {painting.priceStatus === 'visible' && painting.price && (
              <p className="font-body text-xl md:text-2xl text-charcoal font-medium">
                {formatPrice(painting.price)}
              </p>
            )}
            {painting.priceStatus === 'sur_demande' && (
              <p className="font-body text-sm md:text-base text-warm-gray italic">
                Prix sur demande — Contacter l&apos;artiste
              </p>
            )}
            {painting.priceStatus === 'vendu' && (
              <span className="inline-block font-body text-sm uppercase tracking-[0.12em] px-4 py-2 border border-gold text-gold">
                Vendu
              </span>
            )}
          </div>

          {/* CTA */}
          {painting.priceStatus !== 'vendu' && painting.priceStatus !== 'non_a_vendre' && (
            <Link
              href={`/contact?sujet=${encodeURIComponent(`Intérêt pour « ${painting.title} »`)}`}
              className="btn-gold w-full md:w-auto text-center"
            >
              Manifester son intérêt
            </Link>
          )}
        </div>
      </div>

      {/* Navigation prev/next */}
      <div className="max-w-7xl mx-auto px-5 md:px-6 pb-10 md:pb-16">
        {/* Mobile: full-width stacked buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between mt-8 md:mt-16 pt-6 md:pt-8 border-t border-[var(--border)]">
          {prevId ? (
            <Link
              href={`/oeuvre/${prevId}`}
              className="flex items-center justify-center min-h-[52px] sm:min-h-[44px] px-6 border border-[var(--border)] font-body text-sm text-warm-gray hover:text-charcoal hover:border-charcoal transition-colors duration-300 sm:w-auto"
            >
              ← Précédente
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {nextId ? (
            <Link
              href={`/oeuvre/${nextId}`}
              className="flex items-center justify-center min-h-[52px] sm:min-h-[44px] px-6 border border-[var(--border)] font-body text-sm text-warm-gray hover:text-charcoal hover:border-charcoal transition-colors duration-300 sm:w-auto"
            >
              Suivante →
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
        </div>
      </div>
    </motion.div>
  )
}
