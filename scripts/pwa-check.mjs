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
import { createHmac } from 'node:crypto'

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

// ─── Invitations d'installation (visiteurs + atelier) ───────────────────────
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const INSTAGRAM_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0'
const BANNER = '[role="region"]'

const STANDALONE_OVERRIDE = `
  const origMM = window.matchMedia.bind(window)
  window.matchMedia = (q) => q === '(display-mode: standalone)'
    ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    : origMM(q)
`

const secondVisit = (page) =>
  page.addInitScript(() => localStorage.setItem('mc-install-visits', '2'))

function adminCookie() {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'admin', exp: Date.now() + 7 * 864e5 })
  ).toString('base64url')
  const sig = createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('base64url')
  return {
    name: 'mc_admin_session',
    value: `${payload}.${sig}`,
    url: BASE,
  }
}

async function checkInstallPrompts(chromium) {
  console.log("\n— Invitations d'installation —")
  const browser = await chromium.launch()
  const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }

  // 1) Première visite : absente à 1 s, encore absente à 6 s (délai 20 s).
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: ANDROID_UA })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    ;(await page.locator(BANNER).count()) === 0
      ? ok('bannière absente à la 1re seconde (1re visite)')
      : fail('bannière visible dès la 1re seconde')
    await page.waitForTimeout(5000)
    ;(await page.locator(BANNER).count()) === 0
      ? ok('bannière encore absente à 6 s (attend les 20 s)')
      : fail('bannière apparue trop tôt')
    await ctx.close()
  }

  // 2) 2e visite : bannière présente, puis fermeture mémorisée 30 jours.
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: ANDROID_UA })
    const page = await ctx.newPage()
    await secondVisit(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const banner = page.locator(BANNER).first()
    try {
      await banner.waitFor({ state: 'visible', timeout: 8000 })
      ok('bannière visible à la 2e visite')
    } catch {
      fail('bannière absente à la 2e visite')
    }
    await banner.locator('button[aria-label="Fermer"]').click()
    await page.waitForTimeout(300)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(6000)
    ;(await page.locator(BANNER).count()) === 0
      ? ok('fermeture mémorisée (30 jours)')
      : fail('bannière revenue après fermeture')
    await ctx.close()
  }

  // 3) Standalone simulé : jamais affichée.
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: ANDROID_UA })
    const page = await ctx.newPage()
    await page.addInitScript(STANDALONE_OVERRIDE)
    await secondVisit(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(6000)
    ;(await page.locator(BANNER).count()) === 0
      ? ok('bannière absente en mode standalone')
      : fail('bannière visible en standalone')
    await ctx.close()
  }

  // 4) Desktop : jamais affichée ; lien pied de page masqué.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await secondVisit(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(6000)
    ;(await page.locator(BANNER).count()) === 0
      ? ok('bannière absente sur desktop')
      : fail('bannière visible sur desktop')
    ;(await page.locator('footer button:has-text("Installer")').count()) === 0 ||
      !(await page.locator('footer button:has-text("Installer")').first().isVisible().catch(() => false))
      ? ok('lien pied de page masqué sur desktop')
      : fail('lien pied de page visible sur desktop')
    await ctx.close()
  }

  // 5) Liens permanents : tiroir mobile + pied de page mobile.
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: ANDROID_UA })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const footerLink = page.locator('footer button:has-text("Installer")')
    ;(await footerLink.isVisible().catch(() => false))
      ? ok('lien « Installer » présent dans le pied de page mobile')
      : fail('lien pied de page absent sur mobile')
    await page.locator('button[aria-label*="menu" i], button[aria-label*="Menu"]').first().click()
    await page.waitForTimeout(600)
    const drawerLink = page.locator('[role="dialog"] button:has-text("Installer")')
    ;(await drawerLink.isVisible().catch(() => false))
      ? ok('lien « Installer » présent dans le tiroir mobile')
      : fail('lien tiroir mobile absent')
    await ctx.close()
  }

  // 6) iPhone : aide « Partager → Sur l'écran d'accueil ».
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: IOS_UA })
    const page = await ctx.newPage()
    await secondVisit(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const banner = page.locator(BANNER).first()
    try {
      await banner.waitFor({ state: 'visible', timeout: 8000 })
      await banner.locator('button:has-text("Installer")').click()
      const dialog = page.locator('[role="dialog"]').last()
      ;(await dialog.textContent()).includes('Sur l’écran d’accueil')
        ? ok('iPhone : aide « Partager → Sur l’écran d’accueil »')
        : fail('iPhone : aide iOS absente')
    } catch {
      fail('iPhone : bannière ou aide absente')
    }
    await ctx.close()
  }

  // 7) Navigateur intégré (Instagram) : « ouvrez dans Chrome » + copier.
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: INSTAGRAM_UA })
    const page = await ctx.newPage()
    await secondVisit(page)
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const banner = page.locator(BANNER).first()
    try {
      await banner.waitFor({ state: 'visible', timeout: 8000 })
      const txt = await banner.textContent()
      txt.includes('ouvrez cette page dans Chrome') &&
      (await banner.locator('button:has-text("Copier le lien")').count()) === 1
        ? ok('navigateur intégré : « ouvrez dans Chrome » + copier le lien')
        : fail(`intégré : message inattendu « ${txt.slice(0, 80)} »`)
    } catch {
      fail('intégré : bannière absente')
    }
    await ctx.close()
  }

  // 8) /admin/installer : accessible sans connexion.
  {
    const res = await fetch(`${BASE}/admin/installer`)
    const html = await res.text()
    res.status === 200 && html.includes('Mon atelier') && !html.includes('/admin/login')
      ? ok('/admin/installer accessible sans connexion')
      : fail(`/admin/installer → HTTP ${res.status}`)
  }

  // 9) Carte admin : visible connectée, « Plus tard » la masque 7 jours.
  {
    const ctx = await browser.newContext({ ...mobile, userAgent: ANDROID_UA })
    await ctx.addCookies([adminCookie()])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    const card = page.locator('[role="region"]:has-text("Mon atelier")')
    try {
      await card.waitFor({ state: 'visible', timeout: 8000 })
      ok('carte « Installez Mon atelier » visible dans l’admin')
      await card.locator('button:has-text("Plus tard")').click()
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      ;(await page.locator('[role="region"]:has-text("Mon atelier")').count()) === 0
        ? ok('« Plus tard » masque la carte (7 jours)')
        : fail('carte admin revenue après « Plus tard »')
    } catch {
      fail('carte admin absente')
    }
    // Lien d'en-tête présent
    ;(await page.locator('a[href="/admin/installer"]:visible').count()) >= 1
      ? ok('lien « Installer » dans l’en-tête admin')
      : fail('lien en-tête admin absent')
    await ctx.close()
  }

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
  await checkInstallPrompts(launcher)
  console.log('')
  if (failures) {
    console.error(`pwa-check ÉCHEC — ${failures} problème(s).`)
    process.exit(1)
  }
  console.log('pwa-check OK : manifestes valides, admin/api jamais en cache, repli hors ligne localisé.')
}

main()
