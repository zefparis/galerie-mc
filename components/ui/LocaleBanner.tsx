'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, usePathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

const COOKIE = 'mc_lang_choice'
const MAX_AGE = 60 * 60 * 24 * 365

// Texte du bandeau dans la langue proposée (jamais traduit via les messages :
// il s'adresse à un visiteur dont le navigateur parle une autre langue).
const SUGGESTIONS: Record<Exclude<Locale, 'fr'>, { text: string; yes: string; no: string }> = {
  en: { text: 'View this site in English?', yes: 'Yes', no: 'No, thanks' },
  es: { text: '¿Ver este sitio en español?', yes: 'Sí', no: 'No, gracias' },
  de: { text: 'Diese Seite auf Deutsch ansehen?', yes: 'Ja', no: 'Nein, danke' },
}

function readChoice(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeChoice(value: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; samesite=lax`
}

// Première visite : propose la langue du navigateur si elle diffère de la
// langue affichée. Aucune redirection forcée — le choix (oui ou non) est
// mémorisé dans un cookie et toujours prioritaire.
export default function LocaleBanner() {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [suggested, setSuggested] = useState<Exclude<Locale, 'fr'> | null>(null)

  useEffect(() => {
    if (pathname.startsWith('/admin')) return
    if (readChoice()) return
    const nav = (navigator.language || '').toLowerCase()
    const guess = (['en', 'es', 'de'] as const).find((l) => nav === l || nav.startsWith(`${l}-`))
    if (guess && guess !== locale) setSuggested(guess)
    else writeChoice(locale) // rien à proposer : ne plus redemander
  }, [locale, pathname])

  if (!suggested || pathname.startsWith('/admin')) return null

  const dismiss = () => {
    writeChoice(locale)
    setSuggested(null)
  }

  const s = SUGGESTIONS[suggested]
  const query = Object.fromEntries(searchParams.entries())

  return (
    <div
      role="region"
      aria-label={s.text}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-[var(--surface)] border border-[var(--line)] shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap"
    >
      <p className="font-body text-sm text-[var(--ink)] flex-1 min-w-[12rem]">{s.text}</p>
      <Link
        href={{ pathname, query }}
        locale={suggested}
        onClick={() => writeChoice(suggested)}
        className="font-body text-xs font-medium uppercase tracking-[0.12em] text-[var(--accent)] hover:text-[var(--accent-hover)] min-h-[44px] inline-flex items-center"
      >
        {s.yes}
      </Link>
      <button
        onClick={dismiss}
        className="font-body text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--ink)] min-h-[44px] px-2 transition-colors"
      >
        {s.no}
      </button>
    </div>
  )
}
