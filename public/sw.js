/* Service worker « Scandell'Art » — écrit à la main, sans dépendance.
 *
 * Règles :
 *  - JAMAIS de cache pour /admin, /api/*, les requêtes non-GET ou
 *    authentifiées : aucune donnée d'atelier n'est servie hors ligne.
 *  - Navigations publiques : network-first, repli sur la page /offline
 *    de la langue de l'URL (pré-mise en cache à l'installation).
 *  - /_next/static/* (assets versionnés par build) : cache-first.
 *  - Images Cloudinary : stale-while-revalidate, 60 entrées max, 30 jours.
 *  - Mise à jour : skipWaiting + clients.claim + purge des anciens caches.
 *    Les pages ne sont jamais mises en cache : un déploiement ne peut pas
 *    servir de HTML périmé.
 */
// Le worker est enregistré en /sw.js?v=<identifiant de build> : chaque
// déploiement produit une nouvelle URL de script → nouveau worker →
// nouveaux caches → purge des anciens. Jamais de fichier périmé servi.
const VERSION =
  new URL(self.location.href).searchParams.get('v') || 'v1'
const CACHES = {
  static: `mc-static-${VERSION}`,
  images: `mc-images-${VERSION}`,
  offline: `mc-offline-${VERSION}`,
}
const LOCALES = ['fr', 'en', 'es', 'de']
const OFFLINE_PAGES = ['/offline', '/en/offline', '/es/offline', '/de/offline']
const IMG_MAX_ENTRIES = 60
const IMG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

// ─── Installation : pré-cache des pages hors ligne + leur feuille de style ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.offline)
      const assetUrls = new Set()
      for (const path of OFFLINE_PAGES) {
        try {
          const res = await fetch(path, { cache: 'no-store' })
          if (!res.ok) continue
          const html = await res.clone().text()
          await cache.put(path, res)
          // La page pré-cachée référence un CSS haché et des chunks JS :
          // on les met aussi en cache, sinon le repli hors ligne
          // s'afficherait sans style ou planterait à l'hydratation.
          for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g))
            assetUrls.add(new URL(m[1], self.location.origin).href)
          for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g))
            assetUrls.add(new URL(m[1], self.location.origin).href)
        } catch {
          /* réseau absent à l'installation : le repli sera refait plus tard */
        }
      }
      const staticCache = await caches.open(CACHES.static)
      await Promise.allSettled([...assetUrls].map((u) => staticCache.add(u)))
      await self.skipWaiting()
    })()
  )
})

// ─── Activation : purge de tout cache d'une version précédente ──────────────
self.addEventListener('activate', (event) => {
  const keep = new Set(Object.values(CACHES))
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('mc-') && !keep.has(n))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Helpers ────────────────────────────────────────────────────────────────
function offlineFor(url) {
  const seg = url.pathname.split('/')[1]
  const locale = LOCALES.includes(seg) ? seg : 'fr'
  const path = locale === 'fr' ? '/offline' : `/${locale}/offline`
  return caches.match(path, { cacheName: CACHES.offline })
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    const offline = await offlineFor(new URL(request.url))
    return (
      offline ||
      new Response('Hors ligne', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request, { cacheName: CACHES.static })
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) {
    const cache = await caches.open(CACHES.static)
    await cache.put(request, res.clone())
  }
  return res
}

function withTimestamp(response) {
  const headers = new Headers(response.headers)
  headers.set('x-sw-fetched', String(Date.now()))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function trimImages(cache) {
  const keys = await cache.keys()
  if (keys.length <= IMG_MAX_ENTRIES) return
  await Promise.all(
    keys.slice(0, keys.length - IMG_MAX_ENTRIES).map((k) => cache.delete(k))
  )
}

async function swrImage(request) {
  const cache = await caches.open(CACHES.images)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then(async (res) => {
      if (res.ok) {
        await cache.put(request, withTimestamp(res.clone()))
        await trimImages(cache)
      }
      return res
    })
    .catch(() => null)
  if (cached) {
    const fetchedAt = Number(cached.headers.get('x-sw-fetched') || 0)
    if (Date.now() - fetchedAt > IMG_MAX_AGE_MS) {
      // Périmée : on attend le réseau si possible.
      const fresh = await refresh
      if (fresh) return fresh
    } else {
      // Fraîche : revalidation en arrière-plan.
      refresh.catch(() => {})
    }
    return cached
  }
  const res = await refresh
  if (res) return res
  throw new TypeError('Image Cloudinary injoignable hors ligne')
}

// ─── Routage des requêtes ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.headers.has('authorization')) return

  const url = new URL(request.url)

  // Atelier et API : jamais de cache, jamais de repli hors ligne.
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/') ||
      url.pathname.startsWith('/api/'))
  )
    return

  // Navigations publiques : réseau d'abord, page hors ligne sinon.
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  ) {
    if (url.origin === self.location.origin)
      event.respondWith(networkFirstNavigation(request))
    return
  }

  // Assets versionnés par build (hash dans le nom → sûrs à long terme).
  // Exception : les chunks de l'atelier (…/app/admin/…) ne sont jamais
  // cachés — aucun code ni donnée admin ne doit survivre hors ligne.
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith('/_next/static/') &&
    !url.pathname.includes('/admin/')
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Images Cloudinary : fraîcheur raisonnable, borne de 60 entrées / 30 j.
  if (url.hostname === 'res.cloudinary.com' && request.destination === 'image') {
    event.respondWith(swrImage(request))
    return
  }
})
