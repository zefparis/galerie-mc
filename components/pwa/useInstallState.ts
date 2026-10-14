'use client'

import { useEffect, useState } from 'react'
import {
  isAndroid,
  isInAppBrowser,
  isIOS,
  isMobileDevice,
  isStandalone,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa-install'

export interface InstallState {
  /** Détection côté client terminée (SSR rend toujours « rien »). */
  ready: boolean
  /** Événement Android capturé — prompt natif disponible. */
  deferred: BeforeInstallPromptEvent | null
  standalone: boolean
  ios: boolean
  android: boolean
  /** Navigateur intégré (WhatsApp, Instagram…) : installation impossible. */
  inApp: boolean
  mobile: boolean
}

const INITIAL: InstallState = {
  ready: false,
  deferred: null,
  standalone: false,
  ios: false,
  android: false,
  inApp: false,
  mobile: false,
}

/** État d'installation partagé : prompt natif, plateforme, déjà installé. */
export function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>(INITIAL)

  useEffect(() => {
    setState((s) => ({
      ...s,
      ready: true,
      standalone: isStandalone(),
      ios: isIOS(),
      android: isAndroid(),
      inApp: isInAppBrowser(),
      mobile: isMobileDevice(),
    }))

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setState((s) => ({ ...s, deferred: e as BeforeInstallPromptEvent }))
    }
    const onInstalled = () =>
      setState((s) => ({ ...s, standalone: true, deferred: null }))
    const mq = window.matchMedia('(display-mode: standalone)')
    const onMode = () => setState((s) => ({ ...s, standalone: isStandalone() }))

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    mq.addEventListener('change', onMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener('change', onMode)
    }
  }, [])

  return state
}
