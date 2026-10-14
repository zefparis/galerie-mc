#!/usr/bin/env node
// Test de navigation entre langues dans un vrai navigateur (Playwright +
// Chrome système). Rejoue le bug des préfixes empilés : navigation client
// via navbar, tiroir mobile et pied de page, sur plusieurs pages de départ.
//
// Vérifications après chaque clic :
//   - au plus UN préfixe de langue dans l'URL (jamais /en/en, /es/de/…)
//   - <html lang> et la langue affichée dans le sélecteur = langue cliquée
//   - paramètres de requête conservés (?categorie=, ?filtre=…)
//   - la page se sert (HTTP 200 ; 404 uniquement pour une vraie absence)
// Redirections testées : /en/en → /en, /es/de/es/es → /es, /fr/galerie →
// /galerie, /fr → /.
//
// Usage : npm run test:i18n-nav
//   NAV_BASE=http://localhost:3000 ou https://… → serveur déjà lancé
//   sinon le script démarre `next start` sur un port de test (build requis).

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const PORT = 3398
const BASE = process.env.NAV_BASE || `http://localhost:${PORT}`
const LOCALES = new Set(['fr', 'en', 'es', 'de'])
const AUTONYM = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch' }

// Les aria-labels sont traduits — on matche les 4 variantes.
const msg = (loc) => JSON.parse(readFileSync(`messages/${loc}.json`, 'utf8'))
const selAll = (scope, key) =>
  ['fr', 'en', 'es', 'de']
    .map((l) => `${scope}[aria-label="${msg(l)[key.split('.')[0]][key.split('.')[1]]}"]`)
    .join(', ')
const SEL_SWITCHER_BTN = selAll('.navbar button', 'lang.label')
const SEL_OPEN_MENU = selAll('button', 'nav.openMenu')
const SEL_CLOSE_MENU = selAll('[role="dialog"] button', 'nav.closeMenu')

let failures = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const fail = (msg) => {
  console.error(`  ✗ ${msg}`)
  failures++
}

// ─── Serveur de test ─────────────────────────────────────────────────────────
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
  if (process.env.NAV_BASE) {
    console.error(`Serveur injoignable sur ${NAV_BASE}`)
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
    console.error('next start n’a pas démarré — lancez d’abord npm run build')
    process.exit(2)
  }
}

// ─── Vérifications d'URL ─────────────────────────────────────────────────────
function leadingLocales(pathname) {
  return pathname.split('/').filter(Boolean).filter((s) => LOCALES.has(s))
}

function checkUrl(url, expectLocale, label) {
  const { pathname, search } = new URL(url)
  const locales = leadingLocales(pathname)
  if (locales.length > 1) {
    fail(`${label} : préfixes empilés dans ${pathname}`)
    return false
  }
  if (locales[0] === 'fr') {
    fail(`${label} : préfixe /fr interdit dans ${pathname}`)
    return false
  }
  const effective = locales[0] || 'fr'
  if (effective !== expectLocale) {
    fail(`${label} : URL ${pathname} mais langue attendue ${expectLocale}`)
    return false
  }
  return { pathname, search }
}

// Statut HTTP de l'URL atteinte (vérifie que la page se sert vraiment).
async function checkServed(url, label, expect404 = false) {
  const res = await fetch(url, { redirect: 'follow' })
  const want = expect404 ? 404 : 200
  if (res.status === want) ok(`${label} : ${new URL(url).pathname} → HTTP ${res.status}`)
  else fail(`${label} : ${url} → HTTP ${res.status} (attendu ${want})`)
}

// ─── Clics dans les trois sélecteurs ─────────────────────────────────────────
// Les trois variantes du sélecteur rendent des <a role="menuitemradio"> dont
// le texte est l'autonyme (Français, English, Español, Deutsch).
async function clickLanguage(page, zone, locale) {
  const label = AUTONYM[locale]
  if (zone === 'navbar') {
    await page.locator(SEL_SWITCHER_BTN).first().click()
    await page.locator(`.navbar a[role="menuitemradio"]:has-text("${label}")`).first().click()
  } else if (zone === 'footer') {
    await page.locator(`footer a[role="menuitemradio"]:has-text("${label}")`).first().click()
  } else {
    // Tiroir mobile : ouvrir si fermé (cliquer la langue déjà active ne
    // naviguant pas, le tiroir peut être resté ouvert).
    const dialog = page.locator('[role="dialog"]')
    const open = await dialog
      .evaluate((el) => el.getAttribute('aria-hidden') === 'false')
      .catch(() => false)
    if (!open) {
      await page.locator(SEL_OPEN_MENU).first().click()
      await page.waitForTimeout(400) // animation d'ouverture
    }
    await page.locator(`[role="dialog"] a[role="menuitemradio"]:has-text("${label}")`).first().click()
  }
}

async function assertAfterClick(page, locale, label, { expectPathContains, keepSearch } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300) // laisse le router client finir
  const url = page.url()
  const res = checkUrl(url, locale, label)
  if (!res) return false

  const htmlLang = await page.evaluate(() => document.documentElement.lang)
  if (htmlLang === locale) ok(`${label} : <html lang="${htmlLang}">`)
  else fail(`${label} : <html lang="${htmlLang}"> ≠ ${locale} (URL ${res.pathname})`)

  // Langue affichée dans le sélecteur (✓ / aria-checked sur le bon item).
  const active = await page
    .locator(`a[role="menuitemradio"][aria-checked="true"]`)
    .allTextContents()
    .catch(() => [])
  const wanted = AUTONYM[locale]
  if (active.some((t) => t.includes(wanted))) ok(`${label} : sélecteur sur ${wanted}`)
  else fail(`${label} : sélecteur n'affiche pas ${wanted} (trouvé : ${active.join(', ') || 'rien'})`)

  if (expectPathContains && !res.pathname.includes(expectPathContains)) {
    fail(`${label} : chemin ${res.pathname} ne contient pas ${expectPathContains}`)
  }
  if (keepSearch) {
    const sp = new URLSearchParams(res.search)
    for (const [k, v] of new URLSearchParams(keepSearch)) {
      if (sp.get(k) !== v) fail(`${label} : paramètre ${k}=${v} perdu (${res.search || 'vide'})`)
    }
  }
  return true
}

// ─── Scénarios ───────────────────────────────────────────────────────────────
async function scenarioNavbar(page, startPath) {
  // Séquence variée : en → es → de → fr → de → en → fr
  for (const locale of ['en', 'es', 'de', 'fr', 'de', 'en', 'fr']) {
    await clickLanguage(page, 'navbar', locale)
    const keep = new URL(page.url()).search
    await assertAfterClick(page, locale, `navbar ${startPath} → ${locale}`, { keepSearch: keep })
  }
}

async function scenarioFooter(page) {
  for (const locale of ['de', 'en', 'fr', 'es']) {
    await clickLanguage(page, 'footer', locale)
    await assertAfterClick(page, locale, `footer → ${locale}`)
  }
}

async function scenarioDrawer(page) {
  for (const locale of ['en', 'de', 'fr', 'es']) {
    await clickLanguage(page, 'drawer', locale)
    await assertAfterClick(page, locale, `tiroir → ${locale}`)
    // Referme le tiroir s'il est resté ouvert (clic sur la langue courante
    // ne navigue pas).
    const dialogOpen = await page
      .locator('[role="dialog"]')
      .evaluate((el) => el.getAttribute('aria-hidden') === 'false')
      .catch(() => false)
    if (dialogOpen) {
      await page.locator(SEL_CLOSE_MENU).first().click().catch(() => {})
      await page.waitForTimeout(350)
    }
  }
}

async function run() {
  await ensureServer()
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  })

  try {
    // ── Bureau : navbar + footer ──
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()

    console.log('\n— Clics navbar (depuis /, ordres variés) —')
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await scenarioNavbar(page, '/')

    console.log('\n— Clics navbar depuis /galerie?categorie=collages&filtre=vendues —')
    await page.goto(`${BASE}/galerie?categorie=collages&filtre=vendues`, {
      waitUntil: 'networkidle',
    })
    await clickLanguage(page, 'navbar', 'en')
    await assertAfterClick(page, 'en', 'galerie filtrée → en', {
      expectPathContains: '/galerie',
      keepSearch: '?categorie=collages&filtre=vendues',
    })
    await clickLanguage(page, 'navbar', 'de')
    await assertAfterClick(page, 'de', 'galerie filtrée → de', {
      expectPathContains: '/galerie',
      keepSearch: '?categorie=collages&filtre=vendues',
    })

    console.log('\n— Clics footer (depuis /contact) —')
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' })
    await scenarioFooter(page)

    console.log('\n— Fiche œuvre / exposition (si trouvées via sitemap) —')
    const dynamicPaths = []
    try {
      const xml = await (await fetch(`${BASE}/sitemap.xml`)).text()
      for (const m of xml.matchAll(/<loc>[^<]*(\/(?:oeuvre|expositions)\/[0-9a-f-]{8,})[^<]*<\/loc>/gi)) {
        if (!dynamicPaths.includes(m[1])) dynamicPaths.push(m[1])
      }
    } catch {}
    for (const p of dynamicPaths.slice(0, 2)) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
      for (const locale of ['en', 'de', 'fr']) {
        await clickLanguage(page, 'navbar', locale)
        await assertAfterClick(page, locale, `fiche ${p} → ${locale}`, {
          expectPathContains: p,
        })
      }
    }
    if (!dynamicPaths.length) console.log('  (aucune fiche trouvée — base locale vide, saut)')

    console.log('\n— 404 : sélecteur fonctionnel et langue réelle —')
    const res404 = await page.goto(`${BASE}/en/n-importe-quoi`, { waitUntil: 'networkidle' })
    if (res404?.status() === 404) ok('/en/n-importe-quoi → HTTP 404')
    else fail(`/en/n-importe-quoi → HTTP ${res404?.status()} (attendu 404)`)
    const lang404 = await page.evaluate(() => document.documentElement.lang)
    if (lang404 === 'en') ok('404 : <html lang="en">')
    else fail(`404 : <html lang="${lang404}"> ≠ en`)
    await clickLanguage(page, 'navbar', 'es')
    await assertAfterClick(page, 'es', '404 /en → es')

    // ── Mobile : tiroir ──
    console.log('\n— Tiroir mobile (375 px) —')
    const mctx = await browser.newContext({ viewport: { width: 375, height: 700 } })
    const mpage = await mctx.newPage()
    await mpage.goto(`${BASE}/en/galerie`, { waitUntil: 'networkidle' })
    await scenarioDrawer(mpage)

    await ctx.close()
    await mctx.close()
  } finally {
    await browser.close()
  }

  // ── Redirections des adresses déjà cassées ──
  console.log('\n— Redirections —')
  const redirects = [
    ['/en/en', '/en'],
    ['/en/en/galerie', '/en/galerie'],
    ['/es/de/es/es', '/es'],
    ['/fr/galerie', '/galerie'],
    ['/fr', '/'],
    ['/de/en/oeuvre/x', '/en/oeuvre/x'],
  ]
  for (const [from, to] of redirects) {
    const res = await fetch(`${BASE}${from}`, { redirect: 'manual' })
    const loc = res.headers.get('location') || ''
    const target = new URL(loc, BASE).pathname
    if ([301, 307, 308].includes(res.status) && target === to) {
      ok(`${from} → ${res.status} ${to}`)
    } else {
      fail(`${from} → HTTP ${res.status} vers ${target || '?'} (attendu 308 → ${to})`)
    }
  }
  // Les cibles canoniques sont servies ; la fiche inexistante reste une 404.
  await checkServed(`${BASE}/en`, 'sert')
  await checkServed(`${BASE}/es/galerie`, 'sert')
  await checkServed(`${BASE}/en/oeuvre/x`, 'sert', true)

  console.log(
    failures === 0
      ? '\ni18n-nav OK : aucun préfixe empilé, sélecteurs cohérents, redirections propres.'
      : `\n${failures} problème(s) de navigation i18n.`
  )
  process.exitCode = failures === 0 ? 0 : 1
}

run()
  .catch((e) => {
    console.error('test:i18n-nav a échoué :', e?.message || e)
    process.exitCode = 1
  })
  .finally(() => serverProc?.kill())
