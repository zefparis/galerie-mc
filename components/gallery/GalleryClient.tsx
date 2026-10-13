'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Painting } from '@/lib/types'
import { CATEGORIES, isCategory } from '@/lib/catalog'
import { useTechniqueLabel } from '@/lib/i18n'
import GalleryGrid from './GalleryGrid'
import GalleryFilters from './GalleryFilters'

const STATUS_VALUES = ['toutes', 'disponibles', 'vendues'] as const

const isAvailable = (p: Painting) =>
  p.priceStatus === 'visible' || p.priceStatus === 'sur_demande'

export default function GalleryClient({ paintings }: { paintings: Painting[] }) {
  const t = useTranslations()
  const techLabel = useTechniqueLabel()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawCat = searchParams.get('categorie') || 'toutes'
  const category =
    rawCat === 'toutes' || isCategory(rawCat) ? rawCat : ('toutes' as const)
  const rawFilter = searchParams.get('filtre') || 'toutes'
  const filter = STATUS_VALUES.some((v) => v === rawFilter) ? rawFilter : 'toutes'
  const rawTech = searchParams.get('technique') || ''
  const technique = rawTech ? decodeURIComponent(rawTech) : ''

  const setParams = useCallback(
    (next: { categorie?: string; filtre?: string; technique?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      const c = next.categorie ?? category
      const f = next.filtre ?? filter
      const tech = next.technique ?? technique
      if (c === 'toutes') params.delete('categorie')
      else params.set('categorie', c)
      if (f === 'toutes') params.delete('filtre')
      else params.set('filtre', f)
      if (tech) params.set('technique', tech)
      else params.delete('technique')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [category, filter, technique, pathname, router, searchParams]
  )

  const categoryOptions = [
    { value: 'toutes', label: t('categories.toutes') },
    ...CATEGORIES.map((c) => ({ value: c.value, label: t(`categories.${c.value}`) })),
  ]
  const statusOptions = STATUS_VALUES.map((v) => ({
    value: v,
    label: v === 'toutes' ? t('filters.all') : t(`filters.${v}`),
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

  const emptyKey =
    category === 'collages' ? 'emptyCollages' : category === 'peintures' ? 'emptyPeintures' : 'emptyAll'

  return (
    <>
      <GalleryFilters
        label={t('filters.aria')}
        options={categoryOptions}
        current={category}
        onChange={(v) => setParams({ categorie: v, technique: '' })}
      />

      <div className="mt-4">
        <GalleryFilters
          label={t('filters.aria')}
          options={statusOptions}
          current={filter}
          onChange={(v) => setParams({ filtre: v })}
        />
      </div>

      {techniques.length > 0 && (
        <div className="mt-6 -mx-1 overflow-x-auto">
          <ul className="flex items-center gap-6 md:gap-8" aria-label={t('filters.ariaTechnique')}>
            {techniques.map((tech) => (
              <li key={tech} className="shrink-0">
                <button
                  type="button"
                  className={`filter-link !normal-case !tracking-[0.04em] ${
                    technique === tech ? 'is-active' : ''
                  }`}
                  aria-pressed={technique === tech}
                  onClick={() => setParams({ technique: technique === tech ? '' : tech })}
                >
                  {techLabel(tech)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 font-body text-xs uppercase tracking-[0.18em] text-[var(--muted)]" aria-live="polite">
        {t('galerie.count', { count: visible.length })}
      </p>

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
