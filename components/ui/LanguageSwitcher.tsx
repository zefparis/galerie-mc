'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, usePathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'

// Sélecteur de langue : menu déroulant dans la navbar, liste pleine largeur
// dans le tiroir mobile (variant="dark"). Chaque langue est écrite dans sa
// propre langue et le lien conserve la page et les filtres courants.
export default function LanguageSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' | 'list' }) {
  const t = useTranslations('lang')
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const query = Object.fromEntries(searchParams.entries())

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = routing.locales.map((l) => (
    <Link
      key={l}
      href={{ pathname, query }}
      locale={l}
      role="menuitemradio"
      aria-checked={locale === l}
      onClick={() => setOpen(false)}
      className={`w-full flex items-center font-body text-sm transition-colors duration-150 ${
        variant === 'list'
          ? `py-1 ${locale === l ? 'text-[var(--accent)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`
          : `px-4 py-2.5 min-h-[44px] ${
              variant === 'dark'
                ? locale === l
                  ? 'text-[var(--accent-soft)]'
                  : 'text-white/80 hover:text-white'
                : locale === l
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg)]'
            }`
      }`}
    >
      {t(l)}
      {locale === l && <span className="ml-auto" aria-hidden="true">✓</span>}
    </Link>
  ))

  if (variant === 'dark' || variant === 'list') {
    // Tiroir mobile / pied de page : liste directe, pas de menu déroulant.
    return (
      <div role="menu" aria-label={t('label')} className="flex flex-col">
        {items}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t('label')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="min-w-[44px] h-11 px-2 flex items-center gap-1.5 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors duration-200"
      >
        {locale.toUpperCase()}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-40 bg-[var(--surface)] border border-[var(--line)] shadow-lg py-1"
        >
          {items}
        </div>
      )}
    </div>
  )
}
