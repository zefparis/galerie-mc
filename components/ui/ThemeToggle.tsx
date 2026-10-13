'use client'

import { useEffect, useRef, useState } from 'react'
import { ThemeChoice, getThemeChoice, setThemeChoice, applyChoice, watchSystem } from '@/lib/theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'auto', label: 'Automatique', icon: '◐' },
  { value: 'light', label: 'Clair', icon: '☀' },
  { value: 'dark', label: 'Sombre', icon: '☾' },
]

// Interrupteur discret du site public : icône soleil/lune, menu
// Automatique / Clair / Sombre, utilisable clavier et tactile.
export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null)
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setChoice(getThemeChoice())
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  // En mode « auto » (ou sans choix), suivre les changements système.
  useEffect(() => {
    return watchSystem(() => {
      if (choice === 'auto' || choice === null) {
        applyChoice(choice)
        setDark(document.documentElement.classList.contains('dark'))
      }
    })
  }, [choice])

  // Fermer au clic extérieur / Échap
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

  const pick = (v: ThemeChoice) => {
    setChoice(v)
    setThemeChoice(v)
    setDark(document.documentElement.classList.contains('dark'))
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Changer l'apparence"
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-11 h-11 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors duration-200"
      >
        {dark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-44 bg-[var(--surface)] border border-[var(--line)] shadow-lg py-1"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitemradio"
              aria-checked={(choice || 'auto') === opt.value}
              onClick={() => pick(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] font-body text-sm text-left transition-colors duration-150 ${
                (choice || 'auto') === opt.value
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg)]'
              }`}
            >
              <span aria-hidden="true" className="w-4 text-center">{opt.icon}</span>
              {opt.label}
              {(choice || 'auto') === opt.value && <span className="ml-auto" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
