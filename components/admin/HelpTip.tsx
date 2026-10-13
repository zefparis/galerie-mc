'use client'

import { useState } from 'react'

// Petit « ? » d'aide contextuelle à côté des champs qui peuvent hésiter.
export default function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-block align-middle ml-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Afficher l'aide"
        aria-expanded={open}
        className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] text-sm font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-9 z-20 w-64 sm:w-72 p-3 bg-[var(--night)] text-[var(--night-ink)] font-body text-sm font-normal leading-relaxed normal-case tracking-normal shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}
