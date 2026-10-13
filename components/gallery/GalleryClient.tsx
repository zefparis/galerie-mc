'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Painting } from '@/lib/types'
import GalleryGrid from './GalleryGrid'
import GalleryFilters from './GalleryFilters'

const STATUS_OPTIONS = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'disponibles', label: 'Disponibles' },
  { value: 'vendues', label: 'Vendues' },
]

const isAvailable = (p: Painting) =>
  p.priceStatus === 'visible' || p.priceStatus === 'sur_demande'

export default function GalleryClient({ paintings }: { paintings: Painting[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawFilter = searchParams.get('filtre') || 'toutes'
  const filter = STATUS_OPTIONS.some((o) => o.value === rawFilter) ? rawFilter : 'toutes'
  const rawTech = searchParams.get('technique') || ''
  const technique = rawTech ? decodeURIComponent(rawTech) : ''

  const setParams = useCallback(
    (next: { filtre?: string; technique?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      const f = next.filtre ?? filter
      const t = next.technique ?? technique
      if (f === 'toutes') params.delete('filtre')
      else params.set('filtre', f)
      if (t) params.set('technique', t)
      else params.delete('technique')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [filter, technique, pathname, router, searchParams]
  )

  const techniques = useMemo(
    () => Array.from(new Set(paintings.map((p) => p.technique).filter(Boolean) as string[])),
    [paintings]
  )

  const visible = useMemo(
    () =>
      paintings.filter((p) => {
        if (filter === 'disponibles' && !isAvailable(p)) return false
        if (filter === 'vendues' && p.priceStatus !== 'vendu') return false
        if (technique && p.technique !== technique) return false
        return true
      }),
    [paintings, filter, technique]
  )

  return (
    <>
      <GalleryFilters
        options={STATUS_OPTIONS}
        current={filter}
        onChange={(v) => setParams({ filtre: v })}
      />

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

      <div key={`${filter}|${technique}`} className="gallery-fade mt-8">
        {visible.length === 0 ? (
          <p className="py-24 text-center font-serif text-xl italic text-[var(--muted)]">
            Aucune œuvre ne correspond à cette sélection pour le moment.
          </p>
        ) : (
          <GalleryGrid paintings={visible} />
        )}
      </div>
    </>
  )
}
