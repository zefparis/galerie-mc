'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { INSTALL_HELP_EVENT } from '@/lib/pwa-install'
import { useInstallState } from './useInstallState'

// Pictogramme « Partager » iOS (carré + flèche vers le haut).
export function ShareGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 6l4-4 4 4" />
      <path d="M5 11v9h14v-9" />
    </svg>
  )
}

/**
 * Aide d'installation unique du site public — ouverte depuis la bannière,
 * le tiroir mobile ou le pied de page via l'événement `mc:install-help`.
 * Contenu selon l'appareil : prompt natif Android, étapes iOS, ou
 * « ouvrez dans Chrome/Safari » dans les navigateurs intégrés.
 */
export default function InstallHelpDialog() {
  const t = useTranslations('install')
  const st = useInstallState()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOpen = () => {
      setCopied(false)
      setOpen(true)
    }
    window.addEventListener(INSTALL_HELP_EVENT, onOpen)
    return () => window.removeEventListener(INSTALL_HELP_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Déjà installée : l'aide n'a plus de raison d'être.
  useEffect(() => {
    if (st.standalone) setOpen(false)
  }, [st.standalone])

  if (!open || !st.ready || st.standalone) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
    } catch {
      /* presse-papiers refusé */
    }
  }

  const install = async () => {
    if (!st.deferred) return
    await st.deferred.prompt()
    await st.deferred.userChoice
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('helpTitle')}
        tabIndex={-1}
        className="w-full max-w-sm bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl text-[var(--ink)]">
            {t('helpTitle')}
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('close')}
            className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 font-body text-sm text-[var(--ink)] leading-relaxed">
          {st.inApp ? (
            <>
              <p>{st.ios ? t('inAppIos') : t('inAppAndroid')}</p>
              <button onClick={copy} className="btn-outline !min-h-[44px] !py-2.5 mt-4 w-full text-sm">
                {copied ? t('copied') : t('copy')}
              </button>
            </>
          ) : st.ios ? (
            <ol className="space-y-3 list-none">
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-md border border-[var(--line)] flex items-center justify-center">
                  <ShareGlyph className="w-4 h-4 text-[var(--accent)]" />
                </span>
                <span>
                  1. {t('iosStep1')} <ShareGlyph className="inline w-3.5 h-3.5 align-[-2px]" />
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-md border border-[var(--line)] flex items-center justify-center text-[var(--accent)]">
                  ＋
                </span>
                <span>2. {t('iosStep2')}</span>
              </li>
            </ol>
          ) : st.deferred ? (
            <button onClick={install} className="btn-accent w-full !min-h-[48px]">
              {t('install')}
            </button>
          ) : (
            <p>{t('androidSteps')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
