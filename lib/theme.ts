'use client'

// Gestion du thème clair/sombre — tout côté navigateur, jamais bloquant.
// Clé partagée entre le site public et l'admin ; l'admin reste en clair
// par défaut tant qu'aucun choix n'a été enregistré.

export type ThemeChoice = 'auto' | 'light' | 'dark'

const KEY = 'mc-theme'

export function getThemeChoice(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : null
  } catch {
    return null
  }
}

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

// Résolution du choix en sombre/clair effectif.
// Sans préférence enregistrée : le site suit l'appareil, l'admin reste clair.
export function isDark(choice: ThemeChoice | null, isAdmin: boolean): boolean {
  if (choice === 'dark') return true
  if (choice === 'light') return false
  if (choice === 'auto') return systemDark()
  return isAdmin ? false : systemDark()
}

export function applyChoice(choice: ThemeChoice | null) {
  const dark = isDark(choice, window.location.pathname.startsWith('/admin'))
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.themeChoice = choice || ''
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch { /* stockage indisponible — le choix vaut pour cette session */ }
  applyChoice(choice)
}

// Abonnement aux changements système — utile quand le choix est « auto »
// (ou absent côté public). Renvoie la fonction de désabonnement.
export function watchSystem(onChange: () => void): () => void {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  } catch {
    return () => {}
  }
}
