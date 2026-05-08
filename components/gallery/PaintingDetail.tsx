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
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="font-body text-xs uppercase tracking-[0.12em] text-warm-gray hover:text-charcoal transition-colors duration-300"
        >
          ← Retour à la galerie
        </Link>
      </div>

      {/* Main image */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-center">
          <img
            src={painting.imageUrl}
            alt={painting.title}
            className="max-h-[70vh] w-auto object-contain shadow-lg"
          />
        </div>
      </div>

      {/* Info section */}
      <div className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="font-display text-3xl md:text-[42px] text-charcoal mb-4">
          {painting.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 mb-8">
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
          <p className="font-body text-base text-charcoal/80 leading-relaxed mb-10">
            {painting.description}
          </p>
        )}

        {/* Price display */}
        <div className="mb-10">
          {painting.priceStatus === 'visible' && painting.price && (
            <p className="font-body text-2xl text-charcoal font-medium">
              {formatPrice(painting.price)}
            </p>
          )}
          {painting.priceStatus === 'sur_demande' && (
            <p className="font-body text-base text-warm-gray italic">
              Prix sur demande — Contacter l&apos;artiste
            </p>
          )}
          {painting.priceStatus === 'vendu' && (
            <span className="inline-block font-body text-sm uppercase tracking-[0.12em] px-4 py-2 border border-gold text-gold line-through">
              Vendu
            </span>
          )}
        </div>

        {/* CTA */}
        {painting.priceStatus !== 'vendu' && painting.priceStatus !== 'non_a_vendre' && (
          <Link
            href={`/contact?sujet=${encodeURIComponent(`Intérêt pour « ${painting.title} »`)}`}
            className="btn-gold"
          >
            Manifester son intérêt
          </Link>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-16 pt-8 border-t border-[var(--border)]">
          {prevId ? (
            <Link
              href={`/oeuvre/${prevId}`}
              className="font-body text-xs uppercase tracking-[0.12em] text-warm-gray hover:text-charcoal transition-colors duration-300"
            >
              ← Œuvre précédente
            </Link>
          ) : (
            <span />
          )}
          {nextId ? (
            <Link
              href={`/oeuvre/${nextId}`}
              className="font-body text-xs uppercase tracking-[0.12em] text-warm-gray hover:text-charcoal transition-colors duration-300"
            >
              Œuvre suivante →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </motion.div>
  )
}
