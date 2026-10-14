'use client'

import { openInstallHelp } from '@/lib/pwa-install'
import { useInstallState } from './useInstallState'

/**
 * Lien permanent « Installer l'application » — ouvre l'aide partagée.
 * Masqué une fois l'application installée. Variantes : `night` (tiroir
 * mobile, toujours sombre) et `default` (pied de page).
 */
export default function InstallLink({
  label,
  variant = 'default',
  className = '',
}: {
  label: string
  variant?: 'default' | 'night'
  className?: string
}) {
  const st = useInstallState()
  if (!st.ready || st.standalone || !st.mobile) return null

  const colors =
    variant === 'night'
      ? 'text-[var(--on-night-muted)] hover:text-[var(--on-night)]'
      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'

  return (
    <button
      type="button"
      onClick={openInstallHelp}
      className={`font-body text-sm transition-colors min-h-[44px] flex items-center gap-2 ${colors} ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
      {label}
    </button>
  )
}
