import { useMessages } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { photoCaptionKey } from './translations-core'
import type { GalleryEvent, GallerySettings, Painting, Translations } from './types'

export type { Locale }

export const BCP47: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
}

export function formatDate(date: Date, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(BCP47[locale] || 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(date)
}

export function formatPrice(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(BCP47[locale] || 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Normalise une valeur saisie en français (« Huile sur toile ») en clé de dictionnaire (« huile-sur-toile »). */
export function techniqueKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Libellé traduit d'une technique ; repli sur le texte saisi si inconnu. */
export function techniqueLabel(dict: Record<string, string> | undefined, value: string): string {
  return dict?.[techniqueKey(value)] ?? value
}

/** Côté client : retourne un traducteur de techniques (repli : texte d'origine). */
export function useTechniqueLabel(): (value: string) => string {
  const messages = useMessages() as { techniques?: Record<string, string> } | undefined
  return (value: string) => techniqueLabel(messages?.techniques, value)
}

type WithTranslations = { translations?: Translations }

/**
 * Repli pour les contenus localisés : traduction en base
 * (translations[locale][champ]) → champ `${field}_${locale}` → français.
 * Jamais de texte vide affiché.
 */
export function getLocalizedField<T extends WithTranslations>(
  item: T,
  field: keyof T & string,
  locale: Locale
): string {
  const rec = item as Record<string, unknown>
  if (locale !== 'fr') {
    const translated = item.translations?.[locale]?.[field]
    if (typeof translated === 'string' && translated.trim() !== '') return translated
    const localized = rec[`${field}_${locale}`]
    if (typeof localized === 'string' && localized.trim() !== '') return localized
  }
  const base = rec[field]
  return typeof base === 'string' ? base : ''
}

/** Titre + description d'une toile dans la langue, repli français. */
export function localizePainting(p: Painting, locale: Locale): Painting {
  if (locale === 'fr' || !p.translations) return p
  const title = getLocalizedField(p, 'title', locale)
  const description = getLocalizedField(p, 'description', locale)
  return {
    ...p,
    title,
    description,
    titleOriginal: title !== p.title ? p.title : undefined,
  }
}

export function localizeEvent(e: GalleryEvent, locale: Locale): GalleryEvent {
  if (locale === 'fr' || !e.translations) return e
  const title = getLocalizedField(e, 'title', locale)
  return {
    ...e,
    title,
    description: getLocalizedField(e, 'description', locale),
    location: getLocalizedField(e, 'location', locale),
    titleOriginal: title !== e.title ? e.title : undefined,
  }
}

export function localizeSettings(s: GallerySettings, locale: Locale): GallerySettings {
  if (locale === 'fr' || !s.translations) return s
  return {
    ...s,
    bio: getLocalizedField(s, 'bio', locale),
    bioShort: getLocalizedField(s, 'bioShort', locale),
    processText: getLocalizedField(s, 'processText', locale),
    photos: (s.photos || []).map((p) =>
      p.publicId && p.caption
        ? {
            ...p,
            caption:
              s.translations?.[locale]?.[photoCaptionKey(p.publicId)]?.trim() || p.caption,
          }
        : p
    ),
  }
}
