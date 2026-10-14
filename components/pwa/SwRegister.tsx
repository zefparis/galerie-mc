'use client'

import { useEffect } from 'react'

// Enregistrement du service worker :
//  - uniquement en production (next dev n'enregistre jamais) ;
//  - previews Vercel écartées (hôte « …-git-<branche>-… ») pour ne pas
//    mettre en cache un déploiement jetable ;
//  - NEXT_PUBLIC_SW_DISABLED=1 (arrêt d'urgence) : on n'installe rien, on
//    désinscrit tout worker existant et on vide les caches mc-* — filet
//    de sécurité en plus du worker-suicide servi par /sw.js ;
//  - l'URL /sw.js?v=<build> change à chaque déploiement : nouveau worker,
//    nouveaux caches, purge des anciens (skipWaiting/clients.claim).
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    if (process.env.NEXT_PUBLIC_SW_DISABLED === '1') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
      caches
        .keys()
        .then((names) =>
          names
            .filter((n) => n.startsWith('mc-'))
            .forEach((n) => caches.delete(n))
        )
        .catch(() => {})
      return
    }

    if (location.hostname.includes('-git-')) return
    const v = process.env.NEXT_PUBLIC_BUILD_ID || 'v1'
    navigator.serviceWorker
      .register(`/sw.js?v=${v}`, { updateViaCache: 'none' })
      .catch(() => {})
  }, [])
  return null
}
