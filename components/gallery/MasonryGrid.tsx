'use client'

import { Painting, Technique } from '@/lib/types'
import { useState } from 'react'
import PaintingCard from './PaintingCard'

interface Props {
  paintings: Painting[]
}

const TECHNIQUES: Technique[] = [
  'Huile sur toile',
  'Acrylique',
  'Aquarelle',
  'Pastel',
  'Fusain',
  'Technique mixte',
  'Autre',
]

export default function MasonryGrid({ paintings }: Props) {
  const [filter, setFilter] = useState<Technique | 'all'>('all')

  const filteredPaintings = filter === 'all'
    ? paintings
    : paintings.filter((p) => p.technique === filter)

  const availableTechniques = TECHNIQUES.filter((t) =>
    paintings.some((p) => p.technique === t)
  )

  return (
    <div>
      {availableTechniques.length > 1 && (
        <div className="flex gap-2 sm:gap-3 sm:justify-center mb-8 md:mb-12 overflow-x-auto pb-2 px-1 -mx-1 scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={`font-body text-xs uppercase tracking-[0.1em] px-4 py-2 h-9 border transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
              filter === 'all'
                ? 'border-gold text-gold'
                : 'border-[var(--border)] text-warm-gray hover:border-charcoal hover:text-charcoal'
            }`}
          >
            Toutes
          </button>
          {availableTechniques.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`font-body text-xs uppercase tracking-[0.1em] px-4 py-2 h-9 border transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                filter === t
                  ? 'border-gold text-gold'
                  : 'border-[var(--border)] text-warm-gray hover:border-charcoal hover:text-charcoal'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 1 col mobile, 2 col tablet grid, 3 col desktop masonry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
        {filteredPaintings.map((painting, index) => (
          <PaintingCard key={painting.id} painting={painting} index={index} />
        ))}
      </div>
      <div className="hidden lg:block columns-3 gap-4 space-y-4">
        {filteredPaintings.map((painting, index) => (
          <PaintingCard key={painting.id} painting={painting} index={index} />
        ))}
      </div>

      {filteredPaintings.length === 0 && (
        <p className="text-center text-warm-gray font-body py-20">
          Aucune œuvre dans cette catégorie.
        </p>
      )}
    </div>
  )
}
