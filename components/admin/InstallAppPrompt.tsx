'use client'

import { useEffect, useState } from 'react'

// Événement Chromium — non typé par lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const HIDE_KEY = 'mc-atelier-install-hide'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error — propriété iOS Safari
    navigator.standalone === true
  )
}

/**
 * Invitation « Installer l'application » réservée à l'admin.
 *  - Android : bouton déclenchant le prompt natif (beforeinstallprompt).
 *  - iPhone : aide en français (« Partager → Sur l'écran d'accueil »).
 * Jamais affichée si l'app est déjà installée ; masquable durablement.
 */
export default function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  )
  const [ios, setIos] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(HIDE_KEY) === '1') return
    setIos(isIOS())
    setHidden(false)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden) return null
  // Rien à proposer : ni prompt Android ni iPhone.
  if (!deferred && !ios) return null

  const dismiss = () => {
    localStorage.setItem(HIDE_KEY, '1')
    setHidden(true)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setHidden(true)
  }

  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6 py-3">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <span aria-hidden="true" className="text-xl flex-shrink-0">
          📲
        </span>
        <div className="min-w-0 flex-1 font-body text-sm text-[var(--ink)]">
          {deferred ? (
            'Gardez votre atelier sous la main : installez l’application sur votre téléphone.'
          ) : (
            <>
              Pour installer l’atelier sur votre iPhone : appuyez sur{' '}
              <strong>Partager</strong>{' '}
              <span aria-hidden="true">(⎋)</span>, puis sur{' '}
              <strong>« Sur l’écran d’accueil »</strong>.
            </>
          )}
        </div>
        {deferred && (
          <button
            type="button"
            onClick={install}
            className="btn-accent !min-h-[44px] !py-2 !px-4 text-sm flex-shrink-0"
          >
            Installer l’application
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Masquer cette invitation"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
