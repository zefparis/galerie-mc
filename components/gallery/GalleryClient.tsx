'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Painting } from '@/lib/types'
import { CATEGORIES, isCategory } from '@/lib/catalog'
import GalleryGrid from './GalleryGrid'
import GalleryFilters from './GalleryFilters'

const CATEGORY_OPTIONS = [
  { value: 'toutes', label: 'Toutes' },
  ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
]

const STATUS_OPTIONS = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'disponibles', label: 'Disponibles' },
  { value: 'vendues', label: 'Vendues' },
]

const EMPTY_TEXT: Record<string, string> = {
  collages: 'Les collages arrivent bientôt.',
  peintures: 'Aucune peinture ne correspond à cette sélection pour le moment.',
  toutes: 'Aucune œuvre ne correspond à cette sélection pour le moment.',
}

const isAvailable = (p: Painting) =>
  p.priceStatus === 'visible' || p.priceStatus === 'sur_demande'

export default function GalleryClient({ paintings }: { paintings: Painting[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawCat = searchParams.get('categorie') || 'toutes'
  const category =
    rawCat === 'toutes' || isCategory(rawCat) ? rawCat : ('toutes' as const)
  const rawFilter = searchParams.get('filtre') || 'toutes'
  const filter = STATUS_OPTIONS.some((o) => o.value === rawFilter) ? rawFilter : 'toutes'
  const rawTech = searchParams.get('technique') || ''
  const technique = rawTech ? decodeURIComponent(rawTech) : ''

  const setParams = useCallback(
    (next: { categorie?: string; filtre?: string; technique?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      const c = next.categorie ?? category
      const f = next.filtre ?? filter
      const t = next.technique ?? technique
      if (c === 'toutes') params.delete('categorie')
      else params.set('categorie', c)
      if (f === 'toutes') params.delete('filtre')
      else params.set('filtre', f)
      if (t) params.set('technique', t)
      else params.delete('technique')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [category, filter, technique, pathname, router, searchParams]
  )

  // Les techniques proposées correspondent à la galerie affichée.
  const inCategory = useMemo(
    () => paintings.filter((p) => category === 'toutes' || p.category === category),
    [paintings, category]
  )

  const techniques = useMemo(
    () => Array.from(new Set(inCategory.map((p) => p.technique).filter(Boolean) as string[])),
    [inCategory]
  )

  const visible = useMemo(
    () =>
      inCategory.filter((p) => {
        if (filter === 'disponibles' && !isAvailable(p)) return false
        if (filter === 'vendues' && p.priceStatus !== 'vendu') return false
        if (technique && p.technique !== technique) return false
        return true
      }),
    [inCategory, filter, technique]
  )

  return (
    <>
      <GalleryFilters
        options={CATEGORY_OPTIONS}
        current={category}
        onChange={(v) => setParams({ categorie: v, technique: '' })}
      />

      <div className="mt-4">
        <GalleryFilters
          options={STATUS_OPTIONS}
          current={filter}
          onChange={(v) => setParams({ filtre: v })}
        />
      </div>

      {techniques.length > 0 && (
        <div className="mt-6 -mx-1 overflow-x-auto">
          <ul className="flex items-center gap-6 md:gap-8" aria-label="Filtrer par technique">
            {techniques.map((t) => (
              <li key={t} className="shrink-0">
                <button
                  type="button"
                  className={`filter-link !normal-case !tracking-[0.04em] ${
                    technique === t ? 'is-active' : ''
                  }`}
                  aria-pressed={technique === t}
                  onClick={() => setParams({ technique: technique === t ? '' : t })}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 font-body text-xs uppercase tracking-[0.18em] text-[var(--muted)]" aria-live="polite">
        {visible.length} {visible.length > 1 ? 'œuvres' : 'œuvre'}
      </p>

      <div key={`${category}|${filter}|${technique}`} className="gallery-fade mt-8">
        {visible.length === 0 ? (
          <p className="py-24 text-center font-serif text-xl italic text-[var(--muted)]">
            {EMPTY_TEXT[category]}
          </p>
        ) : (
          <GalleryGrid paintings={visible} category={category} />
        )}
      </div>
    </>
  )
}
