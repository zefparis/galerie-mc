import { useMessages } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { photoCaptionKey } from './translations-core'
import { DEFAULT_SETTINGS } from './storage'
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

/**
 * Normalise les dimensions d'une œuvre : « 100 × 120 cm », toujours avec
 * espaces et unité (unité du texte source si présente, cm par défaut).
 * Texte non déchiffrable → retourné tel quel.
 */
export function formatDimensions(raw: string): string {
  const nums = raw.match(/\d+(?:[.,]\d+)?/g)
  if (!nums || nums.length < 2) return raw
  const unit = raw.match(/[a-zA-Z]+\s*$/)?.[0].trim() || 'cm'
  return `${nums.join(' × ')} ${unit}`
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

// Suffixes de support tolérés : « Acrylique sur toile » retombe sur la clé
// « acrylique » si la variante exacte n'est pas dans le dictionnaire.
const SUPPORT_SUFFIXES = ['-sur-toile', '-sur-papier', '-on-canvas', '-on-paper']

/** Libellé traduit d'une technique ; repli sur le texte saisi si inconnu. */
export function techniqueLabel(dict: Record<string, string> | undefined, value: string): string {
  if (!dict) return value
  const key = techniqueKey(value)
  if (dict[key]) return dict[key]
  for (const suffix of SUPPORT_SUFFIXES) {
    if (key.endsWith(suffix)) {
      const base = key.slice(0, -suffix.length)
      if (dict[base]) return dict[base]
    }
  }
  return value
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
    images: (e.images || []).map((img) =>
      img.publicId && img.alt
        ? {
            ...img,
            alt:
              e.translations?.[locale]?.[photoCaptionKey(img.publicId)]?.trim() ||
              img.alt,
          }
        : img
    ),
    titleOriginal: title !== e.title ? e.title : undefined,
  }
}

const normText = (s: string) => (s || '').replace(/\s+/g, ' ').trim()

/** Défauts localisés des réglages — messages[locale].defaults. */
export interface SettingsDefaults {
  bio?: string
  bioShort?: string
}

/**
 * Règle de lecture des réglages :
 * - champ vide OU inchangé par rapport au défaut français d'origine
 *   (comparaison tolérante aux espaces) → le défaut localisé des messages ;
 * - champ personnalisé → sa traduction (translations), repli français.
 */
export function localizeSettings(
  s: GallerySettings,
  locale: Locale,
  defaults: SettingsDefaults = {}
): GallerySettings {
  const resolveField = (field: 'bio' | 'bioShort' | 'processText'): string => {
    const raw = (s[field] as string | undefined) || ''
    const frDefault = (DEFAULT_SETTINGS[field] as string | undefined) || ''
    if (!normText(raw) || normText(raw) === normText(frDefault))
      return defaults[field as keyof SettingsDefaults] ?? raw
    return getLocalizedField(s, field, locale)
  }
  return {
    ...s,
    bio: resolveField('bio'),
    bioShort: resolveField('bioShort'),
    processText: resolveField('processText'),
    // Accroche et présentation de l'accueil : éditables, traduits via le
    // pipeline ; vides → rien n'est affiché (pas de défaut forcé).
    tagline: getLocalizedField(s, 'tagline', locale),
    presentation: getLocalizedField(s, 'presentation', locale),
    photos:
      locale === 'fr' || !s.translations
        ? s.photos
        : (s.photos || []).map((p) =>
            p.publicId && p.caption
              ? {
                  ...p,
                  caption:
                    s.translations?.[locale]?.[photoCaptionKey(p.publicId)]?.trim() ||
                    p.caption,
                }
              : p
          ),
  }
}
