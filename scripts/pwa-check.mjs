#!/usr/bin/env node
// Vérifie la couche PWA dans un vrai navigateur (Playwright + Chrome) sur
// un build de production :
//   1. manifestes visiteurs + admin valides (champs, icônes servies)
//   2. service worker enregistré et activé
//   3. /admin et /api/* JAMAIS mis en cache (ni navigation ni fetch)
//   4. navigations en network-first : aucune page HTML dans les caches,
//      un changement de langue sert le nouveau contenu, pas un périmé
//   5. hors ligne : la navigation retombe sur la page /offline localisée
//   6. mise à jour : après réactivation, seuls les caches de la version
//      courante subsistent (les pages ne sont pas cachées, un
//      redéploiement ne peut pas servir de HTML périmé)
//
// Usage : npm run test:pwa   (build de production requis)
//   PWA_BASE=http://localhost:3000 → serveur déjà lancé

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = 3599
const BASE = process.env.PWA_BASE || `http://localhost:${PORT}`

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => {
  console.error(`  ✗ ${m}`)
  failures++
}

// ─── Serveur de test ──────────────────────────────────────────────────────
const waitForServer = async (tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(BASE)).status < 600) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

let serverProc = null
process.on('exit', () => serverProc?.kill())

async function ensureServer() {
  if (await waitForServer(2)) return
  if (process.env.PWA_BASE) {
    console.error(`Serveur injoignable sur ${PWA_BASE}`)
    process.exit(2)
  }
  if (!existsSync('.next/BUILD_ID')) {
    console.error('Pas de build — lancez npm run build d’abord.')
    process.exit(2)
  }
  serverProc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: 'ignore',
    env: { ...process.env },
  })
  if (!(await waitForServer())) {
    console.error('next start n’a pas démarré')
    process.exit(2)
  }
}

// ─── Cache audit dans la page ─────────────────────────────────────────────
const cachedUrls = () =>
  caches
    .keys()
    .then((names) => Promise.all(names.map((n) => caches.open(n))))
    .then((cs) =>
      Promise.all(cs.map((c) => c.keys().then((ks) => ks.map((k) => k.url))))
    )
    .then((lists) => lists.flat())

async function checkManifest() {
  console.log('\n— Manifestes —')
  const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json()
  const must = {
    id: '/',
    name: 'Scandell’Art',
    short_name: 'Scandell’Art',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    lang: 'fr',
  }
  for (const [k, v] of Object.entries(must))
    m[k] === v ? ok(`visiteurs : ${k} = « ${v} »`) : fail(`visiteurs : ${k} = « ${m[k]} » (attendu « ${v} »)`)
  const sizes = (m.icons || []).map((i) => `${i.sizes}:${i.purpose || 'any'}`)
  for (const want of ['192x192:any', '512x512:any', '512x512:maskable'])
    sizes.includes(want) ? ok(`visiteurs : icône ${want}`) : fail(`visiteurs : icône ${want} absente (${sizes.join(', ')})`)
  for (const icon of m.icons || []) {
    const r = await fetch(`${BASE}${icon.src}`)
    r.ok ? ok(`visiteurs : ${icon.src} servi (${r.headers.get('content-type')})`) : fail(`visiteurs : ${icon.src} → HTTP ${r.status}`)
  }

  const am = await (await fetch(`${BASE}/admin/manifest.webmanifest`)).json()
  const amust = { id: '/admin', name: 'Mon atelier', short_name: 'Atelier', start_url: '/admin', scope: '/admin', display: 'standalone' }
  for (const [k, v] of Object.entries(amust))
    am[k] === v ? ok(`atelier : ${k} = « ${v} »`) : fail(`atelier : ${k} = « ${am[k]} » (attendu « ${v} »)`)
  const adminIcons = (am.icons || []).map((i) => i.src)
  adminIcons.every((s) => s.startsWith('/admin/'))
    ? ok('atelier : icônes distinctes sous /admin/')
    : fail(`atelier : icônes non distinctes (${adminIcons.join(', ')})`)
  for (const src of adminIcons) {
    const r = await fetch(`${BASE}${src}`)
    r.ok ? ok(`atelier : ${src} servi`) : fail(`atelier : ${src} → HTTP ${r.status}`)
  }

  // Liens <link rel=manifest> : visiteurs vs admin.
  const pub = await (await fetch(`${BASE}/`)).text()
  pub.includes('rel="manifest"') && pub.includes('/manifest.webmanifest') && !pub.includes('/admin/manifest')
    ? ok('page publique : manifeste visiteurs lié')
    : fail('page publique : manifeste visiteurs non lié correctement')
  const adm = await (await fetch(`${BASE}/admin/login`)).text()
  adm.includes('/admin/manifest.webmanifest')
    ? ok('admin : manifeste atelier lié')
    : fail('admin : manifeste atelier non lié')
  adm.includes('noindex')
    ? ok('admin : meta robots noindex')
    : fail('admin : meta robots noindex absente')
}

async function checkServiceWorker(chromium) {
  console.log('\n— Service worker —')
  const browser = await chromium.launch()
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await context.newPage()

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (!reg) return 'absent'
    await navigator.serviceWorker.ready
    return reg.active ? 'active' : 'inactif'
  })
  swState === 'active' ? ok('service worker enregistré et actif') : fail(`service worker ${swState}`)
  if (swState !== 'active') {
    await browser.close()
    return
  }

  // URL de script versionnée par l'identifiant de build.
  const scriptUrl = await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL || ''
  )
  scriptUrl.includes('/sw.js?v=')
    ? ok(`worker versionné : ${scriptUrl.split('/').pop()}`)
    : fail(`worker non versionné : ${scriptUrl}`)

  // Enregistrement même en ouvrant /admin en premier (sans page publique).
  const ctxAdmin = await browser.newContext({ serviceWorkers: 'allow' })
  const adminPage = await ctxAdmin.newPage()
  await adminPage.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  const adminSw = await adminPage.evaluate(async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    return reg ? 'enregistré' : 'absent'
  })
  adminSw === 'enregistré'
    ? ok('worker enregistré depuis /admin en première visite')
    : fail(`depuis /admin : worker ${adminSw}`)
  await ctxAdmin.close()

  // Temps pour l'installation (pré-cache des pages hors ligne).
  await page.waitForTimeout(1500)

  // 1) /admin jamais en cache — navigation réelle vers la page de connexion.
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' }).catch(() => {})
  // 2) /api jamais en cache — requête réelle depuis la page.
  await page.evaluate(() => fetch('/api/auth/me', { credentials: 'same-origin' }).catch(() => null))
  await page.waitForTimeout(500)

  const urls = await page.evaluate(cachedUrls)
  const bad = urls.filter((u) => /\/(admin|api)(\/|\?|$)/.test(new URL(u).pathname))
  bad.length === 0
    ? ok('/admin et /api absents des caches')
    : fail(`URLs sensibles en cache : ${bad.join(', ')}`)

  // 3) Aucune page HTML dans les caches (navigations network-first) :
  //    seules les pages /offline pré-cachées sont permises.
  const html = urls.filter((u) => {
    const p = new URL(u).pathname
    return !p.includes('/_next/') && !/offline$/.test(p) && !/\.(css|js|woff2?|png|jpg|svg|ico|webmanifest)$/.test(p)
  })
  html.length === 0
    ? ok('aucune page HTML en cache (hors /offline)')
    : fail(`pages HTML en cache : ${html.join(', ')}`)

  // 4) Changement de langue : contenu frais, pas de périmé.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const frLang = await page.evaluate(() => document.documentElement.lang)
  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' })
  const enLang = await page.evaluate(() => document.documentElement.lang)
  const enHasFrenchHero = await page.evaluate(() => /Galerie\b/.test(document.title) && document.documentElement.lang !== 'fr')
  frLang === 'fr' && enLang === 'en' && !enHasFrenchHero
    ? ok('changement de langue : contenu frais servi (pas de périmé)')
    : fail(`langue fraîche : fr=${frLang} en=${enLang}`)

  // 5) Hors ligne : repli /offline localisé (fr + de).
  for (const [path, needle] of [
    ['/galerie', 'Connexion interrompue'],
    ['/de/galerie', 'Keine Verbindung'],
  ]) {
    await context.setOffline(true)
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await context.setOffline(false)
    const body = await page.evaluate(() => document.body.innerText).catch(() => '')
    body.includes(needle)
      ? ok(`hors ligne ${path} : page de repli « ${needle} »`)
      : fail(`hors ligne ${path} : repli absent (reçu « ${body.slice(0, 80)} »)`)
  }

  // 6) Caches = seulement la version courante (suffixe = build id).
  const names = await page.evaluate(() => caches.keys())
  const v = new URL(scriptUrl).searchParams.get('v')
  names.every((n) => !n.startsWith('mc-') || n.endsWith(`-${v}`))
    ? ok(`caches versionnés par build : ${names.join(', ')}`)
    : fail(`caches inattendus : ${names.join(', ')}`)

  await browser.close()
}

const main = async () => {
  await ensureServer()
  await checkManifest()
  const { chromium } = await import('playwright')
  const launcher = {
    launch: (opts = {}) =>
      chromium.launch({
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
        ...opts,
      }),
  }
  await checkServiceWorker(launcher)
  console.log('')
  if (failures) {
    console.error(`pwa-check ÉCHEC — ${failures} problème(s).`)
    process.exit(1)
  }
  console.log('pwa-check OK : manifestes valides, admin/api jamais en cache, repli hors ligne localisé.')
}

main()
