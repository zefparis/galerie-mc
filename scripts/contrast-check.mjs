#!/usr/bin/env node
// Audit des contrastes du site public (WCAG) : calcule le ratio de chaque
// couple texte/fond réellement utilisé, en thème clair ET sombre.
// Échoue (sortie 1) si un couple descend sous le seuil :
//   4.5:1 texte normal, 3:1 grands titres / icônes / états non-textuels.
// Usage : npm run contrast:check
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const css = readFileSync(join(root, 'app/globals.css'), 'utf8')

// ── Extraction des tokens ──────────────────────────────────────────────
function block(name) {
  const m = css.match(new RegExp(`${name}\\s*\\{([^}]*)\\}`))
  return m ? m[1] : ''
}

function parseTokens(source) {
  const tokens = {}
  for (const m of source.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim()
  }
  // Résout les alias « var(--autre) ».
  for (const [k, v] of Object.entries(tokens)) {
    const ref = v.match(/^var\(--([\w-]+)\)$/)
    if (ref && tokens[ref[1]]) tokens[k] = tokens[ref[1]]
  }
  return tokens
}

// Tous les blocs :root sont fusionnés (les variables de texture vivent
// dans un second bloc, plus bas dans le fichier). Les overrides de texte
// scopés au site public — body:has(.site-texture) — sont fusionnés aussi :
// l'audit porte sur le rendu public réel, l'admin garde les valeurs de base.
const light = parseTokens(
  [...css.matchAll(/:root\s*\{([^}]*)\}/g)]
    .map((m) => m[1])
    .concat(block('html:not\\(\\.dark\\) body:has\\(\\.site-texture\\)'))
    .join('\n')
)
const dark = {
  ...light,
  ...parseTokens(block('html\\.dark')),
  ...parseTokens(block('html\\.dark body:has\\(\\.site-texture\\)')),
}

// ── Texture « lin » : pire cas local ───────────────────────────────────
// La texture composite des 3 couches, mesurée sur les tuiles réelles
// (scripts/texture-peak.mjs — fenêtre glissante de 8 px, taille d'un
// glyphe), atteint ~0.72 × --texture-opacity d'alpha local sur le fond de
// page. Tout couple dont le fond est le fond de page (--bg) est évalué
// contre ce pire cas en plus du fond uni.
const TEX_PEAK_PER_OPACITY = 0.72
const TEX_FIBER = {
  light: { r: 0.235 * 255, g: 0.176 * 255, b: 0.118 * 255 }, // fils bruns
  dark: { r: 1 * 255, g: 0.957 * 255, b: 0.902 * 255 },      // fils crème
}

// ── Couleurs ───────────────────────────────────────────────────────────
function parseColor(value, tokens) {
  const ref = value.match(/^var\(--([\w-]+)\)$/)
  if (ref) return parseColor(tokens[ref[1]], tokens)
  let m = value.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  m = value.match(/^rgba?\(([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\)$/i)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  if (value === 'white') return { r: 255, g: 255, b: 255, a: 1 }
  if (value === 'black') return { r: 0, g: 0, b: 0, a: 1 }
  throw new Error(`Couleur inconnue : ${value}`)
}

function composite(fg, bg) {
  if (fg.a >= 1) return fg
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  }
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function ratio(fgCol, bgCol) {
  const f = luminance(fgCol)
  const b = luminance(bgCol)
  return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)
}

// ── Couples réellement utilisés sur le site public ─────────────────────
// bg peut être un token, une couleur, ou { blend: [couche, alpha, dessous] }.
const PAIRS = [
  // Corps de texte
  ['ink', 'bg', 4.5, 'titres / texte principal'],
  ['ink', 'surface', 4.5, 'cartes, champs'],
  ['ink', 'accent-soft', 4.5, 'bannières, états actifs'],
  ['ink-soft', 'bg', 4.5, 'texte secondaire'],
  ['ink-soft', 'surface', 4.5, 'texte secondaire sur carte'],
  ['muted', 'bg', 4.5, 'compteurs, légendes, dates, placeholders'],
  ['muted', 'surface', 4.5, '« facultatif », placeholder sur champ'],
  // Accent (liens, eyebrow, filtre actif, prix « sur demande »)
  ['accent', 'bg', 4.5, 'liens, eyebrow, filtre actif'],
  ['accent', 'surface', 4.5, 'lien sur carte'],
  ['accent', 'accent-soft', 4.5, 'badge / pastille sur fond accent'],
  ['accent-hover', 'bg', 4.5, 'lien survolé'],
  // Boutons
  ['bg', 'ink', 4.5, 'btn-primary'],
  ['bg', 'btn-primary-hover', 4.5, 'btn-primary survolé'],
  ['on-accent', 'accent', 4.5, 'btn-accent'],
  ['on-accent', 'accent-hover', 4.5, 'btn-accent survolé'],
  ['bg', 'ink-soft', 4.5, 'btn-secondary'],
  ['ink', 'surface', 4.5, 'btn-outline (texte sur fond)'],
  // Messages
  ['danger', 'bg', 4.5, 'texte d’erreur'],
  ['on-danger', 'danger', 4.5, 'btn-danger'],
  ['success', 'bg', 4.5, 'texte de succès'],
  ['warning-ink', 'warning-bg', 4.5, 'avertissement'],
  // Surfaces toujours sombres (tiroir mobile, lightbox, badges)
  ['on-night', 'night', 4.5, 'liens du tiroir mobile'],
  ['on-night-muted', 'night', 4.5, 'fermer / langues du tiroir'],
  ['on-night-faint', 'night', 4.5, 'signature discrète du tiroir'],
  ['accent-on-night', 'night', 4.5, 'lien actif du tiroir'],
  ['on-night', { blend: ['#000000', 0.95, 'bg'] }, 4.5, 'lightbox'],
  ['on-night-muted', { blend: ['#000000', 0.95, 'bg'] }, 4.5, 'légende lightbox'],
  ['on-night', 'night', 3.0, 'outline focus dans le tiroir'],
  // Texte blanc sur voiles posés sur les images (pire cas : toile claire)
  ['#FFFFFF', { blend: ['#000000', 0.7, '#FFFFFF'] }, 4.5, 'légende de carte (voile 70 %)'],
  ['on-night', 'night', 4.5, 'badge « Vendue » (fond opaque)'],
  ['#FFFFFF', { blend: ['#000000', 0.6, '#FFFFFF'] }, 4.5, 'voile du tiroir mobile'],
  // États non textuels (3:1)
  ['accent', 'bg', 3.0, 'icônes / outline focus'],
  [{ blend: ['ink', 0.6, 'bg'] }, 'bg', 3.0, 'point inactif du carrousel hero (60 % encre)'],
  ['line', 'bg', 1.0, 'filets décoratifs (informatif — non exigé WCAG)'],
  // Barre nav translucide au scroll — dessous le plus défavorable
  ['ink-soft', { blend: ['var(--bg)', 0.88, '#000000'] }, 4.5, 'barre nav verre dépoli (dessous noir)'],
  ['ink-soft', { blend: ['var(--bg)', 0.88, '#FFFFFF'] }, 4.5, 'barre nav verre dépoli (dessous blanc)'],
  ['on-night', { blend: ['var(--night)', 0.88, '#FFFFFF'] }, 4.5, 'tiroir verre dépoli (dessous clair)'],
]

// ── Calcul ─────────────────────────────────────────────────────────────
let failures = 0

for (const [themeName, tokens] of [['clair', light], ['sombre', dark]]) {
  const themeKey = themeName === 'clair' ? 'light' : 'dark'
  const texPeak = TEX_PEAK_PER_OPACITY * Number(tokens['texture-opacity'] || 0)
  for (const [fgTok, bgSpec, min, note] of PAIRS) {
    let fg, bg
    try {
      // v : nom de token, hex, rgba() ou var(--token).
      const col = (v) => {
        const s = String(v)
        return parseColor(tokens[s] !== undefined ? tokens[s] : s, tokens)
      }
      // blend: [couche, alpha (appliqué si la couche est opaque), dessous]
      const layer = (blend) => {
        const c = col(blend[0])
        if (typeof blend[1] === 'number' && c.a === 1) c.a = blend[1]
        return composite(c, col(blend[2]))
      }
      fg = typeof fgTok === 'object' && fgTok !== null ? layer(fgTok.blend) : col(fgTok)
      bg = typeof bgSpec === 'object' && bgSpec !== null ? layer(bgSpec.blend) : col(bgSpec)
    } catch (e) {
      console.error(`✗ [${themeName}] ${fgTok} / ${JSON.stringify(bgSpec)} : ${e.message}`)
      failures++
      continue
    }
    let r = ratio(fg, bg)
    let tag = ''
    // Texte posé directement sur le fond de page : la texture peut
    // l'éclaircir ou l'assombrir localement — on évalue le pire cas.
    if (bgSpec === 'bg' && texPeak > 0) {
      const bgTex = composite({ ...TEX_FIBER[themeKey], a: texPeak }, bg)
      const rTex = ratio(fg, bgTex)
      if (rTex < r) {
        r = rTex
        tag = ' [pic texture]'
      }
    }
    const mark = r >= min ? '✓' : '✗'
    if (r < min) failures++
    console.log(
      `${mark} [${themeName}] ${String(typeof fgTok === 'object' ? 'blend' : fgTok).padEnd(18)} sur ${String(typeof bgSpec === 'object' ? 'blend' : bgSpec).padEnd(18)} = ${r.toFixed(2)}:1 (min ${min})${tag} — ${note}`
    )
  }
}

if (failures) {
  console.error(`\n${failures} couple(s) sous le seuil WCAG.`)
  process.exit(1)
}
console.log('\nContrastes OK : tous les couples passent WCAG (4.5:1 texte, 3:1 grandes tailles).')
