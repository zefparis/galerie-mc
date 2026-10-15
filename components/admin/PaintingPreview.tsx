'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { Painting, Translations } from '@/lib/types'
import type { Locale } from '@/lib/i18n'
import WallArtwork from '@/components/gallery/WallArtwork'
import ArtworkCard from '@/components/gallery/ArtworkCard'
import { useDebounced, NotTranslatedNote } from './PreviewShell'

interface FormState {
  title: string
  year: number
  technique: Painting['technique']
  dimensions: string
  description: string
  category: Painting['category']
  imageUrl: string
  imagePublicId: string
  imageWidth?: number
  imageHeight?: number
  price: number
  priceStatus: Painting['priceStatus']
  featured: boolean
}

interface Props {
  form: FormState
  translations?: Translations
  /** URL blob: locale pendant que l'envoi Cloudinary n'est pas fini. */
  localImage?: string
}

// Aperçu en direct de la toile : « Accueil » (cimaise + cartel) ou
// « Galerie » (vignette de la grille), avec les vrais composants publics
// alimentés par l'état du formulaire — jamais par la base.
export default function PaintingPreview({ form, translations, localImage }: Props) {
  const d = useDebounced(form, 150)
  const locale = useLocale() as Locale
  const [tab, setTab] = useState<'accueil' | 'galerie'>('accueil')

  const tr = (key: 'title' | 'description', fr: string) =>
    locale !== 'fr' && translations?.[locale]?.[key]?.trim()
      ? translations[locale]![key]!
      : fr
  const untranslated = locale !== 'fr' && !!d.title.trim() && !translations?.[locale]?.title?.trim()

  const titleEmpty = !d.title.trim()
  // Le fichier local prime pendant l'envoi ; l'URL Cloudinary prend le
  // relais dès qu'elle arrive (onLocalPreview repasse alors à '').
  const imageUrl = localImage || d.imageUrl || ''
  const blob = imageUrl.startsWith('blob:')

  const painting: Painting = {
    id: 'apercu',
    title: titleEmpty ? 'Titre de la toile' : tr('title', d.title.trim()),
    year: d.year,
    technique: d.technique,
    dimensions: d.dimensions,
    description: tr('description', d.description),
    imageUrl,
    imagePublicId: d.imagePublicId,
    imageWidth: d.imageWidth,
    imageHeight: d.imageHeight,
    price: d.priceStatus === 'visible' ? d.price : undefined,
    priceStatus: d.priceStatus,
    category: d.category,
    featured: d.featured,
    order: 0,
    createdAt: '',
  }

  const TABS = [
    { v: 'accueil' as const, label: 'Accueil' },
    { v: 'galerie' as const, label: 'Galerie' },
  ]

  return (
    <div>
      {/* Onglets de contexte */}
      <div role="tablist" aria-label="Vue de l’aperçu" className="flex gap-1.5 mb-4">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            role="tab"
            aria-selected={tab === t.v}
            onClick={() => setTab(t.v)}
            className={`min-h-[40px] px-4 font-body text-sm font-medium border transition-colors ${
              tab === t.v
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {untranslated && <NotTranslatedNote />}

      {!imageUrl ? (
        <p className="py-10 text-center font-body text-sm text-[var(--muted)]">
          Choisissez d’abord une photo — la toile apparaîtra ici.
        </p>
      ) : tab === 'accueil' ? (
        <div>
          {!d.featured && (
            <p className="mb-3 font-body text-xs text-[var(--muted)]">
              La case « Afficher en grand sur la page d’accueil » n’est pas
              cochée — la toile n’y apparaîtra pas. Voici à quoi elle
              ressemblerait :
            </p>
          )}
          <WallArtwork
            painting={painting}
            alt={painting.title}
            sizes="400px"
            cartel
            framed
            unoptimized={blob}
            titlePlaceholder={titleEmpty}
          />
        </div>
      ) : (
        <ArtworkCard
          painting={painting}
          category={d.category}
          unoptimized={blob}
          titlePlaceholder={titleEmpty}
        />
      )}
    </div>
  )
}
