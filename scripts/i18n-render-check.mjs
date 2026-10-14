#!/usr/bin/env node
// Audit de rendu i18n : charge les pages publiques dans les 4 langues,
// extrait les textes visibles et les attributs traduisibles (aria-label,
// alt, title, placeholder), puis signale tout texte identique au français
// sur /en, /es et /de (sauf noms propres et valeurs invariables).
//
// Classification :
//   A — texte fixe en dur / clé de messages non résolue (bloquant)
//   B — valeur par défaut des réglages restée en français (bloquant)
//   C — contenu saisi par l'artiste pas encore traduit (informatif)
//
// Usage : npm run i18n:render-check
//   I18N_BASE=http://localhost:3000  → utilise un serveur déjà lancé
//   sinon le script démarre `next start` lui-même sur un port de test.

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse } from 'node-html-parser'

const LOCALES = ['fr', 'en', 'es', 'de']
const PORT = 3299
const BASE = process.env.I18N_BASE || `http://localhost:${PORT}`

// ─── Pages à auditer ─────────────────────────────────────────────────────────
// Chaque entrée : chemin français (les autres langues ajoutent le préfixe).
const STATIC_PAGES = ['/', '/galerie', '/galerie?categorie=collages', '/galerie?categorie=peintures', '/galerie?filtre=vendues', '/galerie?filtre=disponibles', '/expositions', '/contact', '/page-inexistante-audit-i18n']

const pathFor = (path, locale) => (locale === 'fr' ? path : `/${locale}${path === '/' ? '' : path}`)

// ─── Extraction des textes ────────────────────────────────────────────────────
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'path', 'template'])
const ATTRS = ['aria-label', 'alt', 'title', 'placeholder']

function normalize(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function extractTexts(html) {
  const root = parse(html)
  const found = new Set()
  const walk = (node) => {
    if (node.nodeType !== 1) return
    if (SKIP_TAGS.has(node.rawTagName)) return
    for (const attr of ATTRS) {
      const v = normalize(node.getAttribute(attr))
      if (v) found.add(v)
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const v = normalize(child.rawText)
        // Filtre le doctype et toute balise capturée comme texte.
        if (v && !v.startsWith('<!')) found.add(v)
      } else walk(child)
    }
  }
  walk(root)
  return found
}

// ─── Liste blanche : noms propres, invariables ────────────────────────────────
const WHITELIST = new Set(
  [
    'Marie-Claire Scandella',
    'Montreuil-aux-Lions',
    'Montreuil aux Lions',
    'Instagram',
    'EmailJS',
    'Cloudinary',
  ].map(normalize)
)

function isInvariable(text) {
  const t = normalize(text)
  if (WHITELIST.has(t)) return true
  if (!/[a-zà-ÿ]/i.test(t)) return true // nombres, dates, prix, ponctuation
  if (/^[^\s]+@[^\s]+$/.test(t)) return true // email
  if (/^https?:\/\//.test(t)) return true // url
  if (t.length <= 2) return true
  return false
}

// ─── Classification A / B / C ─────────────────────────────────────────────────
const frMessages = JSON.parse(readFileSync(new URL('../messages/fr.json', import.meta.url)))
const localeMessages = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url))),
  ])
)
const fixedTexts = new Set()
const collectValues = (obj) => {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') fixedTexts.add(normalize(v))
    else if (v && typeof v === 'object') collectValues(v)
  }
}
collectValues(frMessages)

// Coïncidences légitimes : clé dont la traduction EST identique au français
// (« Navigation » en anglais, « Galerie » en allemand, autonymes du sélecteur
// de langue, « Email * »…). Construit en comparant chaque clé fr↔locale.
const identicalByLocale = { en: new Set(), es: new Set(), de: new Set() }
for (const locale of ['en', 'es', 'de']) {
  const other = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)))
  const walkPair = (fr, tr) => {
    for (const [k, v] of Object.entries(fr)) {
      const tv = tr?.[k]
      if (typeof v === 'string' && typeof tv === 'string' && normalize(v) === normalize(tv))
        identicalByLocale[locale].add(normalize(v))
      else if (v && typeof v === 'object') walkPair(v, tv || {})
    }
  }
  walkPair(frMessages, other)
}

// Noms propres pouvant composer un texte traduit (« Galerie — Marie-Claire
// Scandella ») : on les retire avant le test de coïncidence.
const stripProperNouns = (t) =>
  normalize(t.replace(/Marie-Claire Scandella/g, '').replace(/[—–\-|]\s*$/, ''))

// Vrai si le texte identique au français est une traduction correcte
// (coïncidence orthographique) dans cette langue.
function isCoincidence(text, locale) {
  const t = normalize(text)
  if (identicalByLocale[locale].has(t)) return true
  const stripped = stripProperNouns(t)
  return !!stripped && stripped !== t && identicalByLocale[locale].has(stripped)
}

// Valeurs par défaut françaises des réglages (lib/storage.ts → DEFAULT_SETTINGS)
const storageSrc = readFileSync(new URL('../lib/storage.ts', import.meta.url), 'utf8')
const defaultsBlock = storageSrc.match(/DEFAULT_SETTINGS[^{]*\{([\s\S]*?)\n\}/)?.[1] || ''
const defaultTexts = new Set(
  [...defaultsBlock.matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => normalize(m[1].replace(/\\'/g, "'")))
    .filter((t) => /[a-zà-ÿ]{4,}/i.test(t) && !/^#/.test(t) && !/@/.test(t))
)

function classify(text) {
  const t = normalize(text)
  if (defaultTexts.has(t)) return 'B'
  if (fixedTexts.has(t)) return 'A'
  return 'C'
}

// ─── Techniques : couverture du dictionnaire ─────────────────────────────────
// Même normalisation que lib/i18n.ts → techniqueKey.
const techniqueKey = (v) =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const TECH_SUFFIXES = ['-sur-toile', '-sur-papier', '-on-canvas', '-on-paper']
const techCovered = (dict, key) =>
  !!dict[key] || TECH_SUFFIXES.some((s) => key.endsWith(s) && dict[key.slice(0, -s.length)])

// Valeurs françaises du dictionnaire servant d'aiguilles dans les pages
// traduites (tri décroissant : « Huile sur toile » avant « Huile »).
const frTechNeedles = Object.entries(frMessages.techniques || {})
  .map(([key, val]) => ({
    key,
    val: normalize(val),
    re: new RegExp(`(^|[^\\p{L}])${normalize(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u'),
  }))
  .sort((a, b) => b.val.length - a.val.length)

// Une technique française visible sur une page traduite = échec, sauf
// coïncidence légitime (la traduction est orthographiquement identique,
// ex. « Pastel » en anglais).
function findUntranslatedTechnique(text, locale) {
  for (const { key, val, re } of frTechNeedles) {
    if (!re.test(text)) continue
    // Coïncidence légitime : la traduction est orthographiquement identique.
    const target = localeMessages[locale]?.techniques?.[key]
    if (target && normalize(target) === val) continue
    return { key, val }
  }
  return null
}

// Vérifie côté base (si DATABASE_URL) que chaque technique saisie a une
// traduction dans les 3 langues. Lecture seule.
async function auditDbTechniques(report) {
  if (!process.env.DATABASE_URL) {
    console.log('  (DATABASE_URL absente — couverture limitée aux pages rendues)')
    return
  }
  try {
    const { Client } = await import('pg')
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : { rejectUnauthorized: false },
    })
    await client.connect()
    const { rows } = await client.query(
      `SELECT DISTINCT technique FROM paintings WHERE technique IS NOT NULL AND btrim(technique) <> ''`
    )
    await client.end()
    for (const { technique } of rows) {
      const key = techniqueKey(technique)
      for (const locale of ['en', 'es', 'de']) {
        if (!techCovered(localeMessages[locale]?.techniques || {}, key)) {
          report.push({ locale, page: '(base)', text: technique })
        }
      }
      // Signale aussi la clé inconnue même si un repli la couvre.
      if (!(frMessages.techniques || {})[key]) {
        report.push({ locale: 'fr', page: '(base, valeur hors dictionnaire)', text: technique })
      }
    }
    if (rows.length) console.log(`  ${rows.length} technique(s) distincte(s) vérifiée(s) en base`)
  } catch (e) {
    console.log(`  (base injoignable — contrôle base ignoré : ${e.message})`)
  }
}

// ─── Serveur local ────────────────────────────────────────────────────────────
async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.status < 599) return true
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

let serverProc = null
const cleanup = () => serverProc?.kill()
process.on('exit', cleanup)

async function ensureServer() {
  if (await waitForServer(BASE, 2)) return
  if (process.env.I18N_BASE) {
    console.error(`Serveur injoignable sur ${BASE}`)
    process.exit(2)
  }
  serverProc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: 'ignore',
    env: { ...process.env },
  })
  if (!(await waitForServer(BASE))) {
    console.error('next start n’a pas démarré — lancez d’abord npm run build')
    process.exit(2)
  }
}

// ─── Découverte des contenus dynamiques via le sitemap ────────────────────────
async function discoverPaths() {
  const paths = []
  try {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text()
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    const seen = new Set()
    for (const u of urls) {
      const m = u.match(/\/(oeuvre|expositions)\/([0-9a-f-]{8,})/i)
      if (m && !seen.has(m[0])) {
        seen.add(m[0])
        paths.push(m[0])
      }
    }
  } catch {
    /* sitemap injoignable */
  }
  // On garde au maximum 1 fiche œuvre et 1 fiche exposition.
  return [
    paths.find((p) => p.startsWith('/oeuvre/')),
    paths.find((p) => p.startsWith('/expositions/')),
  ].filter(Boolean)
}

// ─── Audit ────────────────────────────────────────────────────────────────────
const results = { A: [], B: [], C: [], T: [], skipped: [] }

async function auditPage(frPath) {
  const frUrl = `${BASE}${frPath}`
  const frRes = await fetch(frUrl)
  if (frRes.status >= 500) {
    results.skipped.push(`${frPath} (fr → HTTP ${frRes.status})`)
    return
  }
  const frTexts = extractTexts(await frRes.text())
  for (const locale of ['en', 'es', 'de']) {
    const url = `${BASE}${pathFor(frPath, locale)}`
    const res = await fetch(url)
    if (res.status >= 500) {
      results.skipped.push(`${pathFor(frPath, locale)} (HTTP ${res.status})`)
      continue
    }
    const texts = extractTexts(await res.text())
    for (const text of texts) {
      // Technique française visible dans un texte composé (légende, méta) —
      // l'égalité exacte ci-dessous ne la verrait pas.
      const tech = findUntranslatedTechnique(text, locale)
      if (tech) results.T.push({ locale, page: pathFor(frPath, locale), text: `${tech.val} (dans « ${text} »)` })
      if (isInvariable(text)) continue
      if (!frTexts.has(text)) continue // différent du français : traduit
      if (isCoincidence(text, locale)) continue // orthographe identique, traduction correcte
      const cat = classify(text)
      results[cat].push({ locale, page: pathFor(frPath, locale), text })
    }
  }
}

const main = async () => {
  await ensureServer()
  const dynamic = await discoverPaths()
  const pages = [...STATIC_PAGES, ...dynamic]

  for (const p of pages) await auditPage(p)

  const dedup = (arr) => {
    const seen = new Set()
    return arr.filter((x) => {
      const k = `${x.page}|${x.text}`
      return !seen.has(k) && seen.add(k)
    })
  }
  // Couverture des techniques saisies en base (si DATABASE_URL).
  await auditDbTechniques(results.T)

  const a = dedup(results.A)
  const b = dedup(results.B)
  const c = dedup(results.C)
  const t = dedup(results.T)

  console.log('\n─── Audit i18n du rendu ───')
  console.log(`Pages auditées : ${pages.length} × 4 langues`)
  if (results.skipped.length)
    console.log(`Ignorées : ${[...new Set(results.skipped)].join(', ')}`)

  const show = (label, list) => {
    if (!list.length) return
    console.log(`\n${label} (${list.length}) :`)
    for (const x of list) console.log(`  [${x.locale}] ${x.page} — « ${x.text} »`)
  }
  show('A — textes fixes non traduits', a)
  show('B — valeurs par défaut en français', b)
  show('T — techniques sans traduction', t)
  show('C — contenus de l’artiste non traduits (informatif)', c)

  if (a.length || b.length || t.length) {
    console.error('\ni18n:render-check ÉCHEC — textes ou techniques français visibles sur le site traduit.')
    process.exit(1)
  }
  console.log('\ni18n:render-check OK — aucun texte fixe, défaut ni technique en français hors /fr.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(2)
  })
  .finally(() => serverProc?.kill())
