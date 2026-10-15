#!/usr/bin/env node
// Vérifie le hero « accroché au mur » dans un vrai navigateur (Playwright +
// Chrome système) sur un build de production :
//   1. proportions intrinsèques (ratio image_width/image_height, CLS 0)
//   2. ombre 3 couches + liseré 1 px, aucune boîte ni bordure épaisse
//   3. cartel centré sous le tableau, points centrés sous le cartel
//   4. fondu enchaîné ~350 ms, clavier, balayage tactile, aria-live
//   5. lightbox au clic, aucun débordement horizontal
// Captures : desktop 1280 + mobile 390, clair + sombre, chaque ratio.
//
// Usage : node scripts/wall-art-check.mjs   (build de production requis)
//   WALL_BASE=http://localhost:3000 → serveur déjà lancé
//   WALL_SHOTS=/tmp/hero → préfixe des captures

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const PORT = 3623
const BASE = process.env.WALL_BASE || `http://localhost:${PORT}`
const SHOTS = process.env.WALL_SHOTS || '/tmp/hero'

let failures = 0
const ok = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => {
  console.error(`  ✗ ${m}`)
  failures++
}
const check = (cond, m) => (cond ? ok(m) : fail(m))

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
  if (process.env.WALL_BASE) {
    console.error(`Serveur injoignable sur ${WALL_BASE}`)
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

const stage = (page) =>
  page.locator('main figure').filter({ has: page.locator('.wall-art') }).first()
const slideBox = (pg, i) =>
  stage(pg).locator('> div:first-child > div').nth(i).locator('.wall-art').first()

async function setTheme(page, dark) {
  await page.evaluate((d) => {
    localStorage.setItem('mc-theme', d ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', d)
  }, dark)
}

const slideCount = (page) => stage(page).locator('> div:first-child > div').count()
// La boîte-ratio (.wall-art) réserve l'espace exact ; l'img la remplit.
const imgOf = (pg, i) =>
  stage(pg).locator('> div:first-child > div').nth(i).locator('img')

async function geometry(page, label) {
  console.log(`\n— Géométrie ${label} —`)
  const n = await slideCount(page)
  check(n >= 1, `${n} slide(s) présente(s)`)
  const frameTs = []
  for (let i = 0; i < n; i++) {
    if (n > 1) {
      await page.locator('main figure button[role="tab"]').nth(i).click()
      await page.waitForTimeout(500)
    }
    const g = await slideBox(page, i).evaluate((el) => {
      const r = el.getBoundingClientRect()
      const gf = el.closest('.gf')
      const host = gf || el
      const hr = host.getBoundingClientRect()
      const fig = el.closest('figure').getBoundingClientRect()
      const cap = el.closest('figure').querySelector('figcaption')
      const capR = cap.getBoundingClientRect()
      const ar = (el.style.aspectRatio || '').split('/').map(Number)
      return {
        w: r.width,
        h: r.height,
        hw: hr.width,
        hh: hr.height,
        ratio: r.width / r.height,
        metaRatio: ar.length === 2 && ar[1] ? ar[0] / ar[1] : NaN,
        cx: hr.left + hr.width / 2,
        figCx: fig.left + fig.width / 2,
        capCx: capR.left + capR.width / 2,
        capAlign: getComputedStyle(cap).textAlign,
        radius: getComputedStyle(host).borderRadius,
        shadows: (getComputedStyle(host).boxShadow.match(/rgba/g) || []).length,
        artShadow: getComputedStyle(el).boxShadow,
        framed: !!gf,
        pieces: gf
          ? [...gf.querySelectorAll('i')].filter(
              (x) => x.getAttribute('aria-hidden') === 'true'
            ).length
          : 0,
        frameT: gf
          ? (hr.height - r.height) / 2
          : 0,
        vh: innerHeight,
      }
    })
    const p = await slideBox(page, i).evaluate((el) =>
      (el.closest('.gf') || el).getBoundingClientRect()
    )
    check(
      Number.isFinite(g.metaRatio) && Math.abs(g.ratio - g.metaRatio) < 0.02,
      `slide ${i + 1} : ratio affiché ${g.ratio.toFixed(3)} = métadonnées ${g.metaRatio.toFixed(3)}`
    )
    check(
      Math.abs(g.cx - g.figCx) < 8,
      `slide ${i + 1} : tableau centré dans sa colonne`
    )
    check(
      Math.abs(g.capCx - g.cx) < 12 && g.capAlign === 'center',
      `slide ${i + 1} : cartel centré sous le tableau`
    )
    check(
      (g.radius === '0px' || g.radius === '') && g.shadows >= 4,
      `slide ${i + 1} : ombre 3 couches + liseré, coins droits`
    )
    check(
      g.framed && g.pieces === 8,
      `slide ${i + 1} : cadre doré (4 bords + 4 coins décoratifs, aria-hidden)`
    )
    check(
      g.framed && g.artShadow === 'none',
      `slide ${i + 1} : ombre portée déplacée sur le cadre (toile sans ombre)`
    )
    if (g.framed) {
      const mh = Math.min(g.vh * 0.68, 560)
      check(
        g.hh <= mh + 2 && g.frameT >= 14 && g.frameT <= 46,
        `slide ${i + 1} : cadre + toile ≤ hauteur max (${Math.round(g.hh)} ≤ ${Math.round(mh)} px, épaisseur ~${Math.round(g.frameT)} px)`
      )
      frameTs.push(g.frameT)
    }
    console.log(
      `    · slide ${i + 1} : ${Math.round(p.width)}×${Math.round(p.height)} px (cadre compris)`
    )
  }
  if (frameTs.length > 1) {
    const spread = Math.max(...frameTs) - Math.min(...frameTs)
    check(
      spread < 1,
      `épaisseur de cadre identique sur toutes les toiles (écart ${spread.toFixed(2)} px)`
    )
  }
  return n
}

async function behaviour(page) {
  console.log('\n— Comportement —')
  const n = await slideCount(page)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  check(overflow <= 0, `aucun débordement horizontal (${overflow} px)`)

  const live = await page.locator('main figure [aria-live="polite"]').count()
  check(live === 1, 'région aria-live polie présente')

  if (n < 2) {
    console.log('    · une seule œuvre : fondu/clavier/balayage non applicables')
  } else {
    // Fondu enchaîné : pendant la transition, l'ancienne et la nouvelle
    // slide sont toutes deux partiellement opaques.
    await page.locator('main figure button[role="tab"]').nth(1).click()
    const mid = await page.waitForTimeout(120).then(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('main figure .wall-art')].map(
          (el) => +getComputedStyle(el.closest('div[aria-hidden]')).opacity
        )
      )
    )
    const fading = mid.filter((o) => o > 0.05 && o < 0.95).length
    check(fading >= 1, `fondu enchaîné en cours (${JSON.stringify(mid)})`)
    const dur = await imgOf(page, 0).evaluate(
      (el) => getComputedStyle(el.closest('div[aria-hidden]')).transitionDuration
    )
    check(
      parseFloat(dur) >= 0.3 && parseFloat(dur) <= 0.4,
      `transition ${dur} (300–400 ms)`
    )
    await page.waitForTimeout(400)

    // Clavier : flèche droite depuis un point
    await page.locator('main figure button[role="tab"]').first().focus()
    const before = await page
      .locator('main figure button[role="tab"][aria-selected="true"]')
      .evaluate((el) => [...el.parentNode.children].indexOf(el))
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(450)
    const after = await page
      .locator('main figure button[role="tab"][aria-selected="true"]')
      .evaluate((el) => [...el.parentNode.children].indexOf(el))
    check(after === (before + 1) % n, `flèche clavier : ${before} → ${after}`)

    // Balayage tactile simulé (vers la gauche = suivant)
    const selBefore = await page
      .locator('main figure button[role="tab"][aria-selected="true"]')
      .evaluate((el) => [...el.parentNode.children].indexOf(el))
    await stage(page).evaluate((fig) => {
      const r = fig.getBoundingClientRect()
      const y = r.top + r.height / 3
      const mk = (type, x) =>
        fig.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches:
              type === 'touchend' ? [] : [new Touch({ identifier: 1, target: fig, clientX: x, clientY: y })],
            changedTouches: [new Touch({ identifier: 1, target: fig, clientX: x, clientY: y })],
          })
        )
      mk('touchstart', r.left + r.width * 0.8)
      mk('touchend', r.left + r.width * 0.2)
    })
    await page.waitForTimeout(450)
    const selAfter = await page
      .locator('main figure button[role="tab"][aria-selected="true"]')
      .evaluate((el) => [...el.parentNode.children].indexOf(el))
    check(selAfter === (selBefore + 1) % n, `balayage : ${selBefore} → ${selAfter}`)
  }

  // CLS pendant un changement de slide
  await page.evaluate(() => {
    window.__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  if (n > 1) {
    await page.locator('main figure button[role="tab"]').first().click()
    await page.waitForTimeout(600)
  }
  const cls = await page.evaluate(() => window.__cls)
  check(cls < 0.001, `CLS = ${cls.toFixed(4)} pendant le carrousel`)
}

async function lightbox(page) {
  console.log('\n— Lightbox —')
  await stage(page).locator('div[aria-hidden="false"] .wall-art').first().click()
  await page.waitForTimeout(400)
  const open = await page.locator('[role="dialog"], .lightbox, [aria-label*="isionneuse"]').count()
  check(open >= 1, 'clic sur le tableau ouvre la visionneuse existante')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

async function shots(page, width, tag) {
  const n = await slideCount(page)
  for (const dark of [false, true]) {
    await setTheme(page, dark)
    await page.waitForTimeout(150)
    for (let i = 0; i < n; i++) {
      if (n > 1) {
        await page.locator('main figure button[role="tab"]').nth(i).click()
        await page.waitForTimeout(500)
      }
      await page.screenshot({ path: `${SHOTS}-${tag}-s${i + 1}-${dark ? 'dark' : 'light'}.png` })
    }
  }
}

async function detail(page) {
  console.log('\n— Fiche œuvre —')
  await page.goto(`${BASE}/galerie`, { waitUntil: 'networkidle' })
  const link = page.locator('main a[href*="/oeuvre/"]:visible').first()
  if ((await link.count()) === 0) {
    console.log('    · aucune fiche disponible — ignoré')
    return
  }
  await link.click()
  await page.waitForURL(/oeuvre\//)
  await page.locator('.wall-art--detail').waitFor({ state: 'attached', timeout: 8000 })
  const n = await page.locator('.wall-art--detail').count()
  check(n >= 1, 'traitement mural présent sur la fiche œuvre')
  const boxed = await page.locator('button.bg-\\[var\\(--mat\\)\\]').count()
  check(boxed === 0, 'ancienne boîte matée supprimée')
  await page.screenshot({ path: `${SHOTS}-detail.png`, fullPage: false })
}

async function main() {
  await ensureServer()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  })
  try {
    for (const [width, height, tag] of [
      [1280, 800, 'd'],
      [390, 844, 'm'],
    ]) {
      const ctx = await browser.newContext({ viewport: { width, height } })
      const page = await ctx.newPage()
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      const n = await geometry(page, `${width}px`)
      await behaviour(page)
      if (width === 1280) await lightbox(page)
      await shots(page, width, tag)
      if (width === 1280) await detail(page)
      await ctx.close()
      void n
    }

    // prefers-reduced-motion : pas de défilement automatique.
    console.log('\n— prefers-reduced-motion —')
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    if ((await slideCount(page)) > 1) {
      const first = await stage(page)
        .locator('figcaption')
        .first()
        .textContent()
      await page.waitForTimeout(7000)
      const after = await stage(page).locator('figcaption').first().textContent()
      check(first === after, 'aucun défilement automatique (mouvement réduit)')
    } else {
      console.log('    · une seule œuvre — non applicable')
    }
    await ctx.close()
  } finally {
    await browser.close()
  }
  console.log(failures === 0 ? '\nwall-art-check OK' : `\n${failures} échec(s)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
