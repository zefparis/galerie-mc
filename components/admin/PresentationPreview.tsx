'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { Translations } from '@/lib/types'
import type { Locale } from '@/lib/i18n'
import HeroHeading from '@/components/gallery/HeroHeading'
import PresentationParagraphs from '@/components/gallery/PresentationParagraphs'
import { useDebounced, NotTranslatedNote } from './PreviewShell'

interface Props {
  tagline: string
  presentation: string
  /** Nom de l'artiste et sur-titre réels (passés par props — jamais
      lus depuis la base dans l'aperçu). */
  artistName: string
  eyebrow: string
  translations?: Translations
}

// Aperçu en direct des textes d'accueil : le hero (accroche sous le
// titre) puis la section « Présentation », avec les vrais composants
// publics et leur typographie.
export default function PresentationPreview({
  tagline,
  presentation,
  artistName,
  eyebrow,
  translations,
}: Props) {
  const dTagline = useDebounced(tagline, 150)
  const dPres = useDebounced(presentation, 150)
  const locale = useLocale() as Locale
  const th = useTranslations('hero')
  const rec = locale !== 'fr' ? translations?.[locale] : undefined
  // Sur-titre : le vrai (bioShort) ou le défaut localisé des messages.
  const shownEyebrow = eyebrow.trim() || th('defaultEyebrow')

  const tTagline = (dTagline || '').trim().slice(0, 160)
  const shownTagline = rec?.tagline?.trim() || tTagline
  const taglineUntranslated =
    locale !== 'fr' && !!tTagline && !rec?.tagline?.trim()

  const frParas = (dPres || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const trParas = (rec?.presentation || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const shownParas = locale !== 'fr' && trParas.length > 0 ? trParas : frParas
  const presUntranslated =
    locale !== 'fr' && frParas.length > 0 && trParas.length === 0

  return (
    <div>
      {/* Bloc hero — mêmes classes que la page d'accueil */}
      <p className="eyebrow mb-4">Haut de la page d’accueil</p>
      {taglineUntranslated && <NotTranslatedNote />}
      {shownTagline ? (
        <HeroHeading eyebrow={shownEyebrow} name={artistName} tagline={shownTagline} />
      ) : (
        <>
          <HeroHeading eyebrow={shownEyebrow} name={artistName} />
          <p className="mt-4 font-body text-sm text-[var(--muted)] italic">
            (Accroche vide — rien ne s’affichera sous le titre.)
          </p>
        </>
      )}

      {/* Section présentation */}
      <div className="mt-10 pt-8 border-t border-[var(--line)]">
        <p className="eyebrow mb-4">Section « Présentation »</p>
        {presUntranslated && <NotTranslatedNote />}
        {shownParas.length > 0 ? (
          <PresentationParagraphs paragraphs={shownParas} />
        ) : (
          <p className="font-body text-sm text-[var(--muted)] italic">
            (Présentation vide — la section restera sans texte.)
          </p>
        )}
      </div>
    </div>
  )
}
