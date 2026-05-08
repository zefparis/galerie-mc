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
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          <button
            onClick={() => setFilter('all')}
            className={`font-body text-xs uppercase tracking-[0.12em] px-4 py-2 border transition-all duration-300 ${
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
              className={`font-body text-xs uppercase tracking-[0.12em] px-4 py-2 border transition-all duration-300 ${
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

      <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
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
