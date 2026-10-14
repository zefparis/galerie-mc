'use client'

import { useEffect } from 'react'

// Le layout racine pose <html lang> au premier rendu ; après une navigation
// client vers une autre langue ce segment ne re-rend pas — on synchronise
// l'attribut ici pour les lecteurs d'écran et le SEO.
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}
