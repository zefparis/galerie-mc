// Détection côté client pour les invitations d'installation PWA.
// Aucun état React ici — fonctions pures, sûres hors navigateur.

export const INSTALL_DISMISS_KEY = 'mc-install-dismissed-at'
export const INSTALL_VISITS_KEY = 'mc-install-visits'
export const ADMIN_INSTALL_DISMISS_KEY = 'mc-atelier-install-until'

export const BANNER_DELAY_FIRST_VISIT_MS = 20_000
export const BANNER_DELAY_RETURN_VISIT_MS = 2_500
export const BANNER_DISMISS_MS = 30 * 24 * 60 * 60 * 1000
export const ADMIN_DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(ua()) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isAndroid(): boolean {
  return /android/i.test(ua())
}

// Navigateurs intégrés : pas d'installation possible, il faut sortir.
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Messenger|Gmail|MicroMessenger|Snapchat|TikTok|Line\//i.test(
    ua()
  )
}

// « Mobile » au sens installation : téléphone réel, pas une fenêtre étroite.
export function isMobileDevice(): boolean {
  return isIOS() || isAndroid() || /mobile/i.test(ua())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error — propriété iOS Safari
    navigator.standalone === true
  )
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* mode privé : on n'insiste pas */
  }
}

/** Fermeture de la bannière mémorisée 30 jours. */
export function bannerDismissed(): boolean {
  const ts = Number(storageGet(INSTALL_DISMISS_KEY) || 0)
  return ts > 0 && Date.now() - ts < BANNER_DISMISS_MS
}
export function dismissBanner() {
  storageSet(INSTALL_DISMISS_KEY, String(Date.now()))
}

/** Compteur de visites : la bannière arrive plus tôt dès la 2e visite. */
export function recordVisit(): number {
  const n = Number(storageGet(INSTALL_VISITS_KEY) || 0) + 1
  storageSet(INSTALL_VISITS_KEY, String(n))
  return n
}
export function bannerDelay(visits: number): number {
  return visits >= 2 ? BANNER_DELAY_RETURN_VISIT_MS : BANNER_DELAY_FIRST_VISIT_MS
}

/** « Plus tard » de la carte admin, 7 jours. */
export function adminCardDismissed(): boolean {
  const until = Number(storageGet(ADMIN_INSTALL_DISMISS_KEY) || 0)
  return until > Date.now()
}
export function dismissAdminCard() {
  storageSet(ADMIN_INSTALL_DISMISS_KEY, String(Date.now() + ADMIN_DISMISS_MS))
}

/** Ouvre l'aide d'installation globale (dialogue unique du site public). */
export const INSTALL_HELP_EVENT = 'mc:install-help'
export function openInstallHelp() {
  window.dispatchEvent(new CustomEvent(INSTALL_HELP_EVENT))
}
