#!/usr/bin/env node
// Audit LECTURE SEULE des techniques saisies en base : liste les valeurs
// distinctes de paintings.technique avec leur nombre d'occurrences, puis
// vérifie que chacune a une traduction dans messages/{en,es,de}.json.
//
// Usage : npm run techniques:audit
//   nécessite DATABASE_URL (.env/.env.local chargés si présents)

import { readFileSync, existsSync } from 'node:fs'

// Charge .env.local / .env si présents (sans écraser l'environnement).
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

// Même normalisation que lib/i18n.ts → techniqueKey.
const techniqueKey = (v) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const SUFFIXES = ['-sur-toile', '-sur-papier', '-on-canvas', '-on-paper']
const dicts = Object.fromEntries(
  ['fr', 'en', 'es', 'de'].map((l) => [
    l,
    JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).techniques || {},
  ])
)

const covered = (dict, key) =>
  !!dict[key] || SUFFIXES.some((s) => key.endsWith(s) && dict[key.slice(0, -s.length)])

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL absente — impossible de lire la base.')
  process.exit(2)
}

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
  `SELECT technique, COUNT(*)::int AS n
   FROM paintings
   WHERE technique IS NOT NULL AND btrim(technique) <> ''
   GROUP BY technique ORDER BY n DESC, technique`
)
await client.end()

console.log(`\nTechniques en base : ${rows.length} valeur(s) distincte(s)\n`)
let missing = 0
for (const { technique, n } of rows) {
  const key = techniqueKey(technique)
  const per = ['en', 'es', 'de'].map((l) => (covered(dicts[l], key) ? l : `✗${l}`))
  const okAll = per.every((x) => !x.startsWith('✗'))
  if (!okAll) missing++
  console.log(
    `  ${okAll ? '✓' : '✗'} ${technique}  (×${n})  clé « ${key} »  → ${per.join(' ')}`
  )
}
console.log(
  missing === 0
    ? '\nToutes les techniques en base ont une traduction en/es/de.'
    : `\n${missing} technique(s) sans traduction — elles s'affichent telles quelles (français) sur le site traduit.`
)
process.exit(missing === 0 ? 0 : 1)
