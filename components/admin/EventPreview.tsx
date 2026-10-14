'use client'

import { useLocale } from 'next-intl'
import type { EventImage, GalleryEvent, Translations } from '@/lib/types'
import { formatEventDate, getLocalizedField, type Locale } from '@/lib/i18n'
import { photoCaptionKey } from '@/lib/translations-core'
import EventCardView from '@/components/gallery/EventCardView'
import EventGallery from '@/components/gallery/EventGallery'
import { useDebounced, NotTranslatedNote } from './PreviewShell'

interface FormState {
  title: string
  description: string
  location: string
  eventDate: string
  coverUrl: string
  coverPublicId: string
  published: boolean
}

interface Props {
  form: FormState
  images: EventImage[]
  translations?: Translations
  /** URL blob: locale de la couverture pendant l'envoi Cloudinary. */
  localCover?: string
}

// Aperçu en direct de l'exposition : carte telle que sur /expositions
// (couverture = première photo) + statut calculé comme le site +
// galerie de miniatures. Pur affichage — aucune lecture/écriture.
export default function EventPreview({ form, images, translations, localCover }: Props) {
  const d = useDebounced(form, 150)
  const dImages = useDebounced(images, 150)
  const locale = useLocale() as Locale

  const titleEmpty = !d.title.trim()
  const rec = locale !== 'fr' ? translations?.[locale] : undefined
  const untranslated = locale !== 'fr' && !rec?.title?.trim()

  // La première photo sert de couverture — même règle que l'écriture ;
  // sinon le champ couverture, sinon l'aperçu local en cours d'envoi.
  const coverUrl = dImages[0]?.url || d.coverUrl || localCover || ''

  const previewEvent: GalleryEvent = {
    id: 'apercu',
    title: titleEmpty ? 'Titre de l’exposition' : d.title.trim(),
    description: d.description,
    location: d.location,
    eventDate: d.eventDate,
    coverUrl,
    coverPublicId: dImages[0]?.publicId || d.coverPublicId,
    media: [],
    images: dImages,
    published: d.published,
    order: 0,
    createdAt: '',
    translations,
  }

  // Traductions des champs (titre, description, lieu, alt des photos) —
  // même repli français que le site.
  const le = {
    ...previewEvent,
    title: titleEmpty
      ? previewEvent.title
      : getLocalizedField(previewEvent, 'title', locale),
    description: getLocalizedField(previewEvent, 'description', locale),
    location: getLocalizedField(previewEvent, 'location', locale),
    images: dImages.map((img) =>
      img.publicId && img.alt
        ? {
            ...img,
            alt: rec?.[photoCaptionKey(img.publicId)]?.trim() || img.alt,
          }
        : img
    ),
  }

  // Statut affiché comme sur la page d'accueil : date ≥ aujourd'hui → à venir.
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = !!d.eventDate && d.eventDate >= today
  const blob = coverUrl.startsWith('blob:')

  return (
    <div>
      {/* Statut calculé comme sur le site + avertissement brouillon */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className={`inline-block px-2.5 py-1 font-body text-xs font-medium border ${
            d.eventDate
              ? upcoming
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--muted)]'
              : 'border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          {d.eventDate ? (upcoming ? 'À venir' : 'Passée') : 'Sans date'}
        </span>
        {!d.published && (
          <span className="inline-block px-2.5 py-1 font-body text-xs font-medium border border-[var(--line)] text-[var(--muted)]">
            Brouillon — invisible sur le site
          </span>
        )}
      </div>

      {untranslated && <NotTranslatedNote />}

      <EventCardView
        event={le}
        dateLabel={formatEventDate(d.eventDate, 'short', locale)}
        unoptimized={blob}
        titlePlaceholder={titleEmpty}
      />

      {le.images.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--line)]">
          <p className="eyebrow mb-4">Photos de l’exposition</p>
          <EventGallery images={le.images} title={le.title} unoptimized />
        </div>
      )}
    </div>
  )
}
