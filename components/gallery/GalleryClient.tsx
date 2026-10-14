'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Painting } from '@/lib/types'
import { CATEGORIES, isCategory } from '@/lib/catalog'
import { useTechniqueLabel } from '@/lib/i18n'
import GalleryGrid from './GalleryGrid'

const STATUS_VALUES = ['toutes', 'disponibles', 'vendues'] as const
type StatusValue = (typeof STATUS_VALUES)[number]

const isAvailable = (p: Painting) =>
  p.priceStatus === 'visible' || p.priceStatus === 'sur_demande'

// Galerie : une seule rangée de pilules (galeries), compteur + « Filtrer »
// à droite. Les filtres secondaires (disponibilité, technique) vivent dans
// un panneau — popover sur desktop, tiroir bas sur mobile — et les filtres
// actifs apparaissent en pastilles retirables. L'état est dans l'URL
// (?categorie=…&dispo=…&technique=…) : partageable et navigable.
export default function GalleryClient({ paintings }: { paintings: Painting[] }) {
  const t = useTranslations()
  const techLabel = useTechniqueLabel()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawCat = searchParams.get('categorie') || 'toutes'
  const category =
    rawCat === 'toutes' || isCategory(rawCat) ? rawCat : ('toutes' as const)
  // 'dispo' est le nom courant ; 'filtre' (anciens liens partagés) est lu aussi.
  const rawFilter = searchParams.get('dispo') || searchParams.get('filtre') || 'toutes'
  const filter: StatusValue = STATUS_VALUES.some((v) => v === rawFilter)
    ? (rawFilter as StatusValue)
    : 'toutes'
  const technique = searchParams.get('technique') || ''

  const setParams = useCallback(
    (next: { categorie?: string; dispo?: string; technique?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      const c = next.categorie ?? category
      const f = next.dispo ?? filter
      const tech = next.technique ?? technique
      if (c === 'toutes') params.delete('categorie')
      else params.set('categorie', c)
      if (f === 'toutes') params.delete('dispo')
      else params.set('dispo', f)
      params.delete('filtre') // nettoie l'ancien nom s'il traîne
      if (tech) params.set('technique', tech)
      else params.delete('technique')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [category, filter, technique, pathname, router, searchParams]
  )

  const categoryOptions = [
    { value: 'toutes', label: t('categories.toutes') },
    ...CATEGORIES.map((c) => ({ value: c.value, label: t(`categories.${c.value}`) })),
  ]
  const FILTER_KEYS = { toutes: 'all', disponibles: 'available', vendues: 'sold' } as const
  const statusOptions = STATUS_VALUES.map((v) => ({
    value: v,
    label: t(`filters.${FILTER_KEYS[v]}`),
  }))

  // Les techniques proposées correspondent à la galerie affichée.
  const inCategory = useMemo(
    () => paintings.filter((p) => category === 'toutes' || p.category === category),
    [paintings, category]
  )
  const techniques = useMemo(
    () => Array.from(new Set(inCategory.map((p) => p.technique).filter(Boolean) as string[])),
    [inCategory]
  )
  // Le filtre technique n'a de sens que pour une vraie collection.
  const showTechniques = techniques.length >= 2 && inCategory.length > 12

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

  // ── Panneau de filtres ──
  const [panelOpen, setPanelOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !toggleRef.current?.contains(e.target as Node)
      )
        setPanelOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [panelOpen])

  // Flèches ← → entre les pilules de la rangée.
  const onPillKeys = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const pills = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('.filter-pill')
    )
    const i = pills.indexOf(document.activeElement as HTMLButtonElement)
    if (i === -1) return
    e.preventDefault()
    pills[(i + (e.key === 'ArrowRight' ? 1 : pills.length - 1)) % pills.length]?.focus()
  }

  const hasSecondary = filter !== 'toutes' || !!technique
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (filter !== 'toutes')
    chips.push({
      key: 'dispo',
      label: statusOptions.find((o) => o.value === filter)?.label || filter,
      clear: () => setParams({ dispo: 'toutes' }),
    })
  if (technique)
    chips.push({
      key: 'technique',
      label: techLabel(technique),
      clear: () => setParams({ technique: '' }),
    })

  const emptyKey =
    category === 'collages' ? 'emptyCollages' : category === 'peintures' ? 'emptyPeintures' : 'emptyAll'

  return (
    <>
      {/* Rangée unique : pilules des galeries + compteur + « Filtrer » */}
      <div className="relative flex items-center gap-3">
        <nav
          aria-label={t('filters.aria')}
          onKeyDown={onPillKeys}
          className="-mx-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide scroll-fade-x"
        >
          <ul className="flex items-center gap-2 md:gap-3 px-1 snap-x">
            {categoryOptions.map((o) => (
              <li key={o.value} className="shrink-0">
                <button
                  type="button"
                  className={`filter-pill ${category === o.value ? 'is-active' : ''}`}
                  aria-pressed={category === o.value}
                  onClick={() => setParams({ categorie: o.value, technique: '' })}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <p
            className="font-body text-xs text-[var(--muted)] whitespace-nowrap"
            aria-live="polite"
          >
            {t('galerie.count', { count: visible.length })}
          </p>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            className={`filter-toggle ${hasSecondary ? 'is-active' : ''}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
            {t('filters.toggle')}
          </button>
        </div>

        {/* Panneau : tiroir bas sur mobile, popover sur desktop */}
        {panelOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              aria-hidden="true"
              onClick={() => setPanelOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t('filters.panelTitle')}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] p-5 pb-8 shadow-[0_-12px_40px_-12px_var(--shadow)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-[70vh] md:w-72 md:rounded-md md:border md:p-4 md:shadow-lg"
            >
              <div className="flex items-center justify-between md:hidden mb-2">
                <p className="eyebrow">{t('filters.panelTitle')}</p>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label={t('filters.close')}
                  className="p-3 -m-2 text-[var(--muted)]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="eyebrow !text-[10px] mb-1">{t('filters.availability')}</p>
              <div role="group" aria-label={t('filters.availability')}>
                {statusOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`filter-option ${filter === o.value ? 'is-active' : ''}`}
                    aria-pressed={filter === o.value}
                    onClick={() => setParams({ dispo: o.value })}
                  >
                    {o.label}
                    {filter === o.value && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>

              {showTechniques && (
                <>
                  <p className="eyebrow !text-[10px] mt-4 mb-1">
                    {t('filters.techniqueTitle')}
                  </p>
                  <div role="group" aria-label={t('filters.ariaTechnique')}>
                    {techniques.map((tech) => (
                      <button
                        key={tech}
                        type="button"
                        className={`filter-option ${technique === tech ? 'is-active' : ''}`}
                        aria-pressed={technique === tech}
                        onClick={() =>
                          setParams({ technique: technique === tech ? '' : tech })
                        }
                      >
                        {techLabel(tech)}
                        {technique === tech && <span aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Pastilles des filtres actifs */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="filter-chip"
              aria-label={t('filters.remove', { name: chip.label })}
              onClick={chip.clear}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            className="font-body text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)] transition-colors min-h-[44px] px-2"
            onClick={() => setParams({ dispo: 'toutes', technique: '' })}
          >
            {t('filters.clearAll')}
          </button>
        </div>
      )}

      <div key={`${category}|${filter}|${technique}`} className="gallery-fade mt-8">
        {visible.length === 0 ? (
          <p className="py-24 text-center font-serif text-xl italic text-[var(--muted)]">
            {t(`galerie.${emptyKey}`)}
          </p>
        ) : (
          <GalleryGrid paintings={visible} category={category} />
        )}
      </div>
    </>
  )
}
