'use client'

import { useState } from 'react'
import { Painting, Technique } from '@/lib/types'
import MasonryGrid from './MasonryGrid'

const TECHNIQUES: Technique[] = [
  'Huile sur toile',
  'Acrylique',
  'Aquarelle',
  'Pastel',
  'Fusain',
  'Technique mixte',
  'Autre',
]

type StatusFilter = 'all' | 'disponible' | 'vendu'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'disponible', label: 'Disponibles' },
  { value: 'vendu', label: 'Vendues' },
]

function matchStatus(p: Painting, f: StatusFilter): boolean {
  if (f === 'disponible') return p.priceStatus === 'visible' || p.priceStatus === 'sur_demande'
  if (f === 'vendu') return p.priceStatus === 'vendu'
  return true
}

const pill = (active: boolean) =>
  `font-body text-[11px] font-medium uppercase tracking-[0.14em] px-4 py-2.5 min-h-[40px] border transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
    active
      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
      : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]'
  }`

export default function GalleryClient({ paintings }: { paintings: Painting[] }) {
  const [technique, setTechnique] = useState<Technique | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')

  const availableTechniques = TECHNIQUES.filter((t) =>
    paintings.some((p) => p.technique === t)
  )

  const filtered = paintings.filter(
    (p) => (technique === 'all' || p.technique === technique) && matchStatus(p, status)
  )

  return (
    <div>
      {/* Filtres */}
      <div className="space-y-3 mb-10 md:mb-14">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-hide">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={pill(status === f.value)}
              aria-pressed={status === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
        {availableTechniques.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-hide">
            <button
              onClick={() => setTechnique('all')}
              className={pill(technique === 'all')}
              aria-pressed={technique === 'all'}
            >
              Toutes techniques
            </button>
            {availableTechniques.map((t) => (
              <button
                key={t}
                onClick={() => setTechnique(t)}
                className={pill(technique === t)}
                aria-pressed={technique === t}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grille */}
      {filtered.length > 0 ? (
        <MasonryGrid paintings={filtered} />
      ) : (
        <p className="text-center font-body text-[var(--muted)] py-24">
          Aucune œuvre dans cette sélection.
        </p>
      )}
    </div>
  )
}
