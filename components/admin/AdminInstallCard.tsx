'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminCardDismissed, dismissAdminCard } from '@/lib/pwa-install'
import { useInstallState } from '@/components/pwa/useInstallState'

/**
 * Carte « Installer Mon atelier » sur l'accueil de l'admin — reste visible
 * tant que l'app n'est pas installée ; « Plus tard » la masque 7 jours.
 */
export default function AdminInstallCard() {
  const st = useInstallState()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [gone, setGone] = useState(false)

  if (gone || !st.ready || st.standalone || adminCardDismissed()) return null

  const install = async () => {
    if (st.deferred) {
      await st.deferred.prompt()
      await st.deferred.userChoice
      setGone(true)
    } else {
      router.push('/admin/installer')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + '/admin/installer')
      setCopied(true)
    } catch {
      /* presse-papiers refusé */
    }
  }

  return (
    <div
      role="region"
      aria-label="Installer Mon atelier"
      className="mb-8 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="text-3xl flex-shrink-0">
          📲
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-body text-lg font-medium text-[var(--ink)]">
            Installez Mon atelier sur votre téléphone
          </h2>
          <p className="font-body text-sm text-[var(--ink-soft)] mt-1">
            pour ajouter vos toiles en deux clics.
          </p>
          {st.inApp ? (
            <div className="mt-4">
              <p className="font-body text-sm text-[var(--ink)]">
                {st.ios
                  ? 'Pour installer, ouvrez cette page dans Safari.'
                  : 'Pour installer, ouvrez cette page dans Chrome.'}
              </p>
              <button
                onClick={copy}
                className="btn-outline !min-h-[44px] !py-2.5 mt-3 text-sm"
              >
                {copied ? 'Lien copié !' : 'Copier le lien'}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={install} className="btn-accent !min-h-[48px]">
                Installer
              </button>
              <button
                onClick={() => {
                  dismissAdminCard()
                  setGone(true)
                }}
                className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] min-h-[44px] px-3"
              >
                Plus tard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
