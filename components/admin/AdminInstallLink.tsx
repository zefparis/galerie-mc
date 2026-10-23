'use client'

import Link from 'next/link'
import { useInstallState } from '@/components/pwa/useInstallState'

// Lien « Installer l'application » de l'en-tête admin — vers le guide
// /admin/installer ; masqué une fois l'atelier installé.
export default function AdminInstallLink() {
  const st = useInstallState()
  if (!st.ready || st.standalone) return null
  return (
    <Link
      href="/admin/installer"
      className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors min-h-[48px] px-2 inline-flex items-center gap-1.5"
    >
      <span aria-hidden="true">📲</span> Installer
    </Link>
  )
}
