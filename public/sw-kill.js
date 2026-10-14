/* Worker-suicide — servi à la place de sw.js quand
 * NEXT_PUBLIC_SW_DISABLED=1 (voir next.config.mjs et README).
 * À l'activation : vide tous les caches mc-*, se désinscrit et recharge
 * les pages ouvertes. Aucun gestionnaire fetch : tout va au réseau.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n.startsWith('mc-')).map((n) => caches.delete(n))
      )
      await self.clients.claim()
      const windows = await self.clients.matchAll({ type: 'window' })
      await self.registration.unregister()
      for (const client of windows) {
        try {
          client.navigate(client.url)
        } catch {
          /* fenêtre déjà partie */
        }
      }
    })()
  )
})
