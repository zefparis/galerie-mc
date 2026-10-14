#!/usr/bin/env node
// Vérifie l'i18n public :
//  1. parité des clés entre fr.json (référence) et en/es/de ;
//  2. aucun texte français laissé en dur dans les composants publics.
// Sortie 1 si un problème est trouvé.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const LOCALES = ['fr', 'en', 'es', 'de']
let errors = 0

// ── 1. Parité des clés ─────────────────────────────────────────────────
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )

const ref = JSON.parse(readFileSync(join(root, 'messages/fr.json'), 'utf8'))
const refKeys = flatten(ref).sort()
const refSet = new Set(refKeys)

for (const locale of LOCALES) {
  const data = JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'))
  const keys = new Set(flatten(data))
  const missing = refKeys.filter((k) => !keys.has(k))
  const extra = [...keys].filter((k) => !refSet.has(k))
  for (const k of missing) {
    console.error(`✗ ${locale}.json : clé manquante "${k}"`)
    errors++
  }
  for (const k of extra) {
    console.error(`✗ ${locale}.json : clé inconnue "${k}" (absente de fr.json)`)
    errors++
  }
}

// ── 2. Texte français en dur dans les composants publics ───────────────
const PUBLIC_DIRS = [
  'app/[locale]',
  'components/gallery',
  'components/ui',
  'components/contact',
]

// ── 2b. Préfixes de langue concaténés à la main (bug des /en/en) ────────
// Tout chemin public doit passer par i18n/navigation (Link/useRouter/
// usePathname localisés) ou i18n/pathname. Interdits : imports nus de
// next/link & des hooks de navigation, et les gabarits `/xx` manuels.
const FORBIDDEN_IMPORT =
  /import\s+[^;]*(?:\bLink\b|\busePathname\b|\buseRouter\b|\bredirect\b|\bpermanentRedirect\b)[^;]*from\s+['"]next\/(?:link|navigation)['"]/
const MANUAL_PREFIX =
  /`\/\$\{[^}]*(?:locale|l)\b[^}]*\}|\$\{?locale\}?\s*\+\s*['"]\/|['"]\/['"]\s*\+\s*\b(?:locale|l)\b/

for (const dir of PUBLIC_DIRS) {
  for (const file of walk(join(root, dir))) {
    const src = readFileSync(file, 'utf8')
    if (FORBIDDEN_IMPORT.test(src)) {
      console.error(
        `✗ ${relative(root, file)} : import de navigation non localisé — ` +
          `utiliser @/i18n/navigation ou @/i18n/pathname`
      )
      errors++
    }
    src.split('\n').forEach((line, i) => {
      if (!line.trim().startsWith('//') && MANUAL_PREFIX.test(line)) {
        console.error(
          `✗ ${relative(root, file)}:${i + 1} : préfixe de langue concaténé à la main « ${line.trim().slice(0, 80)} »`
        )
        errors++
      }
    })
  }
}

// Mots/chaînes typiquement français, assez distinctifs pour éviter les
// faux positifs sur les chemins et identifiants techniques.
const FRENCH_RE =
  /Œuvre|œuvre|Galerie|Expositions?|Précédent|Suivant|Fermer|Vendue?|Disponibles?|Envoyer|Veuillez|Aucune?|Toutes\b|Chargement|Sélection|Présentation|démarche picturale|Contacter|Découvrir|Manifester|Cliquer|Agrandir|Retour|droits réservés|reproduction interdite|introuvable|pièce unique|arrivent bientôt|visionneuse|menu|Écrire|Agenda|Moments partagés|sur demande|à vendre|méthode/i

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(tsx?|jsx?)$/.test(name)) yield p
  }
}

for (const dir of PUBLIC_DIRS) {
  for (const file of walk(join(root, dir))) {
    const src = readFileSync(file, 'utf8')
    const lines = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('import '))
    lines.forEach((line, i) => {
      // Ne scanner que le texte visible : contenu JSX, chaînes aria/alt/title/placeholder.
      const jsxText = line.match(/>([^<>{}"']*[À-ÿ][^<>{}"']*)</)
      const attrText = line.match(/(?:aria-label|alt|title|placeholder|aria-description)\s*=\s*(?:"([^"]*)"|'([^']*)')/)
      const candidates = [jsxText?.[1], attrText?.[1], attrText?.[2]].filter(Boolean)
      for (const c of candidates) {
        if (FRENCH_RE.test(c)) {
          console.error(`✗ ${relative(root, file)}:${i + 1} : texte français en dur « ${c.trim().slice(0, 80)} »`)
          errors++
        }
      }
    })
  }
}

if (errors) {
  console.error(`\n${errors} problème(s) i18n détecté(s).`)
  process.exit(1)
}
console.log('i18n OK : clés identiques dans les 4 langues, aucun français en dur côté public.')
