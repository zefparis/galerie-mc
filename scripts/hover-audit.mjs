#!/usr/bin/env node
// Audit empirique des états hover/focus du site public (WCAG) :
//  · survole chaque élément interactif ET ses descendants textuels
//    (titres group-hover, cartels, prix…) et mesure le contraste réel ;
//  · vérifie qu'en thème sombre le survol n'assombrit pas le texte ;
//  · parcourt le focus clavier (Tab) et mesure l'anneau visible (≥ 3:1).
// Échoue (sortie 1) sous 4.5:1 (3:1 grands textes / anneau).
// Usage : node scripts/hover-audit.mjs   (serveur requis)
//   HOVER_BASE=http://localhost:3700   HOVER_REPORT=/tmp/hover.json
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.HOVER_BASE || 'http://localhost:3700'
const REPORT = process.env.HOVER_REPORT || ''
const PAGES = ['/', '/galerie', '/expositions', '/contact', '/informations-legales']
// Préfixes de liens détail à découvrir automatiquement (fiche œuvre, expo).
const DETAIL_RE = [/\/oeuvre\/[^/]+$/, /\/expositions\/[^/]+$/]

const chan = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const lum = (c) => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b)
const ratio = (a, b) => {
  const la = lum(a), lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
})
const effBg = (stack, base) => {
  let bg = { ...base }
  for (const s of [...stack].reverse()) bg = over(s, bg)
  return bg
}
const PAGE_BG = {
  light: { r: 250, g: 247, b: 241 },
  dark: { r: 28, g: 25, b: 21 },
}

// Mesure d'un élément dans le navigateur : couleur, pile de fonds, voile,
// anneau de focus (outline OU box-shadow de type Tailwind ring).
function MEASURE(el) {
  const col = (s) => {
    const m = (s || '').match(/rgba?\(([^)]+)\)/)
    if (!m) return { r: 0, g: 0, b: 0, a: 1 }
    const p = m[1].split(',').map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const cs = getComputedStyle(el)
  const stack = []
  let n = el
  while (n && n !== document.documentElement) {
    const b = col(getComputedStyle(n).backgroundColor)
    if (b.a > 0.01) stack.push(b)
    if (b.a === 1) break
    n = n.parentElement
  }
  const veil = el.closest('[class*="gradient"]')
  const veilStop = veil ? getComputedStyle(veil).backgroundImage : ''
  // Voile fourni par un FRÈRE dans la même carte interactive
  // (ArtworkCard : dégradé et texte sont deux enfants du lien) — ne
  // s'applique qu'aux éléments POSITIONNÉS sur l'image ; les légendes
  // sous l'image (flux normal) gardent le fond de la carte.
  const holder = el.closest('a,button')
  const posParent = el.closest('.absolute, .fixed')
  const positioned =
    cs.position === 'absolute' ||
    cs.position === 'fixed' ||
    !!(holder && posParent && holder.contains(posParent))
  const cardVeil = positioned && holder
    ? holder.querySelector('[class*="gradient"]')
    : null
  const cardVeilStop = cardVeil ? getComputedStyle(cardVeil).backgroundImage : ''
  // L'élément porte-t-il lui-même du texte (nœud texte direct) ?
  const hasText = [...el.childNodes].some(
    (n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0
  )
  const hasDescText = (el.textContent || '').trim().length > 0
  // Anneau : outline visible (Tailwind outline-none = transparent → on
  // regarde alors les couches de box-shadow, la ring y vit).
  const oColor = col(cs.outlineColor)
  const oW = parseFloat(cs.outlineWidth)
  const hasOutline = cs.outlineStyle !== 'none' && oW >= 2 && oColor.a > 0.9
  const ringColors = []
  if (cs.boxShadow && cs.boxShadow !== 'none') {
    for (const m of cs.boxShadow.matchAll(/rgba?\([^)]+\)/g)) {
      const c = col(m[0])
      if (c.a > 0.5) ringColors.push(c)
    }
  }
  return {
    color: col(cs.color),
    stack,
    fs: parseFloat(cs.fontSize),
    fw: parseInt(cs.fontWeight),
    tag: el.tagName.toLowerCase(),
    txt: (el.textContent || el.getAttribute('aria-label') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 42),
    cls: String(el.className).slice(0, 110),
    veil: /gradient/.test(veilStop)
      ? veilStop.slice(0, 160)
      : /gradient/.test(cardVeilStop)
        ? cardVeilStop.slice(0, 160)
        : '',
    ring: hasOutline ? oColor : null,
    ringColors,
    hasText,
    hasDescText,
  }
}

// Descendants textuels d'un élément survolé (titres group-hover, cartels…).
function DESC(el) {
  const out = []
  const sel = 'h1,h2,h3,h4,h5,h6,p,span,time,em,strong,figcaption,div'
  for (const n of el.querySelectorAll(sel)) {
    const t = (n.textContent || '').trim()
    if (t.length < 2 || t.length > 140) continue
    const cs = getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue
    out.push(n)
    if (out.length >= 8) break
  }
  return out
}

async function setTheme(page, dark) {
  await page.evaluate((d) => {
    localStorage.setItem('mc-theme', d ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', d)
  }, dark)
  await page.waitForTimeout(400)
}

async function auditTheme(dark, ctxOpts) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  })
  const ctx = await browser.newContext({
    serviceWorkers: 'block', // évite tout chunk périmé en cache
    ...ctxOpts,
  })
  const page = await ctx.newPage()
  const rows = []
  const focusRows = []

  // Pages détail réelles (découvertes depuis les listes).
  const detail = []
  await page.goto(`${BASE}/galerie`, { waitUntil: 'load' })
  detail.push(
    ...(await page.$$eval('a[href]', (as) =>
      as.map((a) => a.getAttribute('href')).filter(Boolean)
    ))
  )
  await page.goto(`${BASE}/expositions`, { waitUntil: 'load' })
  detail.push(
    ...(await page.$$eval('a[href]', (as) =>
      as.map((a) => a.getAttribute('href')).filter(Boolean)
    ))
  )
  const pages = [...PAGES]
  for (const re of DETAIL_RE) {
    const p = detail.find((h) => re.test(h))
    if (p && !pages.includes(p)) pages.push(p)
  }

  for (const path of pages) {
    await page.goto(`${BASE}${path === '/' ? '' : path}`, { waitUntil: 'load' })
    await setTheme(page, dark)

    // ── Passe survol ───────────────────────────────────────────────
    const base = page.locator('a[href], button, [role="tab"], [role="button"]')
    const n = await base.count()
    let done = 0
    const seen = new Set()
    for (let i = 0; i < n && done < 90; i++) {
      const it = base.nth(i)
      let id = ''
      try {
        id = await it.evaluate(
          (el) => `${el.tagName}|${(el.textContent || '').trim().slice(0, 40)}|${el.className}`
        )
      } catch { continue }
      if (seen.has(id)) continue
      try {
        const box = await it.boundingBox()
        if (!box || box.width < 4 || box.height < 4) continue
        // Couleur AVANT survol (direction du changement).
        const before = await it.evaluate((el) => getComputedStyle(el).color)
        await it.scrollIntoViewIfNeeded({ timeout: 1500 })
        await it.hover({ timeout: 1500 })
        await page.waitForTimeout(280)
        const m = await it.evaluate(MEASURE)
        m.page = path
        m.role = 'self'
        m.before = before
        rows.push(m)
        // Descendants textuels (group-hover : titres, cartels, prix…).
        const kids = await it.evaluateHandle(DESC)
        const props = [...(await kids.getProperties()).values()]
        for (const h of props) {
          const el = h.asElement()
          if (!el) continue
          try {
            const dm = await el.evaluate(MEASURE)
            dm.page = path
            dm.role = 'desc'
            dm.parent = m.txt || m.tag
            rows.push(dm)
          } catch { /* détaché */ }
        }
        await kids.dispose()
        seen.add(id)
        done++
      } catch { /* élément masqué entre-temps */ }
    }

    // ── Passe focus clavier ────────────────────────────────────────
    const seenF = new Set()
    for (let t = 0; t < 80; t++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(60)
      const info = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        return {
          fv: el.matches(':focus-visible'),
          key: `${el.tagName}|${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}`,
        }
      })
      if (!info || !info.fv || seenF.has(info.key)) continue
      seenF.add(info.key)
      const h = await page.evaluateHandle(() => document.activeElement)
      const el = h.asElement()
      if (el) {
        try {
          const fm = await el.evaluate(MEASURE)
          fm.page = path
          fm.role = 'focus'
          focusRows.push(fm)
        } catch { /* détaché */ }
      }
      await h.dispose()
    }

    // ── Lightbox (page galerie uniquement) ─────────────────────────
    if (path === '/galerie') {
      try {
        const card = page.locator('main a.group, main button.group').first()
        if (await card.count()) {
          await card.scrollIntoViewIfNeeded({ timeout: 2000 })
          await card.click({ timeout: 2000 })
          await page.waitForTimeout(500)
          const dlg = page.locator('[role="dialog"]')
          if (await dlg.count()) {
            const btns = dlg.locator('button')
            const bn = await btns.count()
            for (let i = 0; i < bn; i++) {
              const b = btns.nth(i)
              try {
                await b.hover({ timeout: 1200 })
                await page.waitForTimeout(250)
                const bm = await b.evaluate(MEASURE)
                bm.page = path
                bm.role = 'lightbox'
                rows.push(bm)
              } catch { /* invisible mobile */ }
            }
          }
          await page.keyboard.press('Escape')
          await page.waitForTimeout(300)
        }
      } catch { /* pas de lightbox ouvrable */ }
    }
    console.log(`    · ${path} : ${done} élément(s) survolé(s), ${seenF.size} focus`)
  }
  await browser.close()
  return { rows, focusRows }
}

let failures = 0
const report = {}
for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light'
  console.log(`\n=== Thème ${dark ? 'SOMBRE' : 'CLAIR'} ===`)
  const { rows, focusRows } = await auditTheme(dark, {
    viewport: { width: 1280, height: 900 },
  })
  let bad = 0
  const seenOut = new Set()
  for (const m of rows) {
    // Conteneurs sans texte propre mais avec descendants textuels :
    // leur couleur héritée n'est jamais rendue — les descendants la
    // portent déjà. Les éléments sans aucun texte (icônes) sont
    // évalués au seuil non-textuel 3:1.
    if (!m.hasText && m.hasDescText && m.role !== 'focus') continue
    let bg = effBg(m.stack, PAGE_BG[theme])
    // Texte sur voile dégradé « from-black/… » : pire cas = voile sur
    // image la plus claire (blanc).
    if (m.veil) {
      // Premier arrêt sombre du dégradé calculé, forme rgba(0,0,0,a)
      // ou rgb(0 0 0 / a).
      const mA =
        /rgba?\(\s*0[\s,]+0[\s,]+0[\s,\/]+\s*([\d.]+)\s*\)/.exec(m.veil) ||
        /black\/(\d+)/.exec(m.veil)
      if (mA) {
        const a = +mA[1] > 1 ? +mA[1] / 100 : +mA[1]
        bg = over({ r: 0, g: 0, b: 0, a }, { r: 255, g: 255, b: 255 })
      }
    }
    const fg = over(m.color, bg)
    const rr = ratio(fg, bg)
    const big = m.fs >= 24 || (m.fs >= 18.66 && m.fw >= 700)
    const min = !m.hasText && !m.hasDescText ? 3 : big ? 3 : 4.5
    // Direction du survol (mesurée sur l'élément lui-même uniquement).
    let dir = ''
    if (m.before && m.role === 'self') {
      const bm = m.before.match(/rgba?\(([^)]+)\)/)
      if (bm) {
        const p = bm[1].split(',').map(Number)
        const drop = lum({ r: p[0], g: p[1], b: p[2] }) - lum(fg)
        if (drop > 0.02) dir = dark ? 'ASSOMBRIT' : 'assombrit'
        else if (drop < -0.02) dir = 'éclaircit'
      }
    }
    const key = `${m.page}|${m.tag}|${m.txt}|${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)}`
    if (seenOut.has(key)) continue
    seenOut.add(key)
    ;(report[theme] ||= []).push({
      page: m.page, theme, role: m.role, tag: m.tag, txt: m.txt,
      fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: +rr.toFixed(2), min, dir, veil: !!m.veil, cls: m.cls,
      parent: m.parent || '',
    })
    const fail = rr < min || (dark && dir === 'ASSOMBRIT' && rr < 9)
    if (fail) {
      bad++
      failures++
      console.log(
        `  ✗ ${rr.toFixed(2)}${dir ? ' [' + dir + ']' : ''} [${m.page}] ${m.tag} «${m.txt}»` +
          `${m.parent ? ` (dans «${m.parent}»)` : ''}\n` +
          `      fg rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})` +
          ` sur rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` +
          `${m.veil ? ' [voile]' : ''}\n      cls: ${m.cls}`
      )
    }
  }
  // Anneau de focus : outline réel, sinon couleur de la ring (box-shadow).
  let badF = 0
  const seenF2 = new Set()
  for (const fm of focusRows) {
    const bg = effBg(fm.stack.slice(1), PAGE_BG[theme]) // fond parent
    const fKey = `${fm.page}|${fm.tag}|${fm.txt}`
    if (seenF2.has(fKey)) continue
    seenF2.add(fKey)
    if (fm.ring) {
      const rr = ratio(over(fm.ring, bg), bg)
      if (rr < 3) {
        badF++
        failures++
        console.log(
          `  ✗ anneau ${rr.toFixed(2)}:1 [${fm.page}] ${fm.tag} «${fm.txt}»`
        )
      }
    } else if (fm.ringColors.length) {
      const best = Math.max(...fm.ringColors.map((c) => ratio(over(c, bg), bg)))
      if (best < 3) {
        badF++
        failures++
        console.log(
          `  ✗ anneau (ring) ${best.toFixed(2)}:1 [${fm.page}] ${fm.tag} «${fm.txt}»`
        )
      }
    } else {
      badF++
      failures++
      console.log(`  ✗ focus sans anneau visible [${fm.page}] ${fm.tag} «${fm.txt}»`)
    }
  }
  console.log(
    `  → ${bad} violation(s) survol, ${badF} anneau(x) insuffisant(s) en thème ${theme}`
  )
}
if (REPORT) writeFileSync(REPORT, JSON.stringify(report, null, 2))
console.log(failures ? `\n${failures} violation(s)` : '\nhover-audit OK')
process.exit(failures ? 1 : 0)
