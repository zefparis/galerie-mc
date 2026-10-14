'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  bannerDelay,
  bannerDismissed,
  dismissBanner,
  openInstallHelp,
  recordVisit,
} from '@/lib/pwa-install'
import { useInstallState } from './useInstallState'

/**
 * Bannière d'installation discrète — bas d'écran, mobile uniquement :
 *  - 2e visite et suivantes : après ~2,5 s ; 1re visite : après 20 s ;
 *  - jamais en standalone, jamais si fermée il y a moins de 30 jours,
 *    jamais sur ordinateur.
 * Android : « Installer » déclenche le prompt natif ; sinon (iPhone,
 * navigateur intégré, Android sans prompt) ouvre l'aide partagée.
 */
export default function InstallBanner() {
  const t = useTranslations('install')
  const st = useInstallState()
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!st.ready || !st.mobile || st.standalone || bannerDismissed()) return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    const visits = recordVisit()
    const timer = setTimeout(() => setVisible(true), bannerDelay(visits))
    return () => clearTimeout(timer)
  }, [st.ready, st.mobile, st.standalone])

  if (!visible || st.standalone) return null

  const close = () => {
    dismissBanner()
    setVisible(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
    } catch {
      /* presse-papiers refusé */
    }
  }

  const install = async () => {
    if (st.deferred) {
      await st.deferred.prompt()
      await st.deferred.userChoice
      setVisible(false)
    } else {
      setVisible(false)
      openInstallHelp()
    }
  }

  return (
    <div
      role="region"
      aria-label={t('bannerText')}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-lg">
        <span aria-hidden="true" className="text-lg flex-shrink-0">
          📲
        </span>
        <p className="flex-1 min-w-0 font-body text-sm text-[var(--ink)] leading-snug">
          {st.inApp ? (st.ios ? t('inAppIos') : t('inAppAndroid')) : t('bannerText')}
        </p>
        {st.inApp ? (
          <button
            onClick={copy}
            className="btn-accent !min-h-[44px] !py-2 !px-4 text-sm flex-shrink-0"
          >
            {copied ? t('copied') : t('copy')}
          </button>
        ) : (
          <button
            onClick={install}
            className="btn-accent !min-h-[44px] !py-2 !px-4 text-sm flex-shrink-0"
          >
            {t('install')}
          </button>
        )}
        <button
          onClick={close}
          aria-label={t('close')}
          className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
