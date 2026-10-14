'use client'

import { useEffect } from 'react'

// Enregistrement du service worker, uniquement en production :
//  - next dev ne l'enregistre jamais (NODE_ENV development) ;
//  - les previews Vercel sont écartées (hôte « …-git-<branche>-… ») pour ne
//    pas mettre en cache un déploiement jetable ;
//  - updateViaCache: 'none' → chaque nouveau sw.js est détecté, et
//    skipWaiting/clients.claim côté worker font la bascule proprement.
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    if (location.hostname.includes('-git-')) return
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch(() => {})
  }, [])
  return null
}
