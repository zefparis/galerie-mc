'use client'

import { useEffect, useState } from 'react'
import { setThemeChoice, applyChoice } from '@/lib/theme'

// Interrupteur admin : un gros bouton explicite, pas d'icône seule.
// Sans choix enregistré, l'admin reste en clair.
export default function AdminThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    // Enregistre un choix explicite : l'admin garde son mode partout.
    setThemeChoice(next ? 'dark' : 'light')
    applyChoice(next ? 'dark' : 'light')
    setDark(next)
  }

  // Évite un libellé incertain avant hydratation
  if (dark === null) {
    return <span className="min-h-[48px] px-2 inline-block" aria-hidden="true" />
  }

  return (
    <button
      onClick={toggle}
      className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors min-h-[48px] px-3 border border-[var(--line)] bg-[var(--surface)]"
      aria-label={dark ? 'Revenir au mode clair' : 'Passer en mode sombre'}
    >
      {dark ? '☀️ Mode clair' : '🌙 Mode sombre'}
    </button>
  )
}
