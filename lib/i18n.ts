import { useMessages } from 'next-intl'
import type { Locale } from '@/i18n/routing'

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

/**
 * Repli pour les contenus localisés en base à venir : cherche `${field}_${locale}`
 * puis retombe sur le champ français d'origine.
 */
export function getLocalizedField<T extends Record<string, unknown>>(
  item: T,
  field: keyof T & string,
  locale: Locale
): string {
  if (locale !== 'fr') {
    const localized = item[`${field}_${locale}`]
    if (typeof localized === 'string' && localized.trim() !== '') return localized
  }
  const base = item[field]
  return typeof base === 'string' ? base : ''
}
