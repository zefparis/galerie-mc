// Inventaire des traductions manquantes : pour chaque œuvre, événement et
// les réglages, liste les champs sans traduction (ou en échec / à mettre à
// jour) dans chaque langue cible.
// Usage : npm run translate:check   (charge .env puis .env.local)
// Sort en 1 si des champs sont à traduire — à lancer en local ou en CI.

import pg from 'pg'
const { Pool } = pg

const TARGET_LOCALES = ['en', 'es', 'de']
const LOCALES_NOM = { en: 'English', es: 'Español', de: 'Deutsch' }

const ssl =
  process.env.DATABASE_SSL === 'false'
    ? false
    : process.env.DATABASE_CA_CERT
      ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
      : { rejectUnauthorized: true }

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant — renseignez-le dans .env ou .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl })

// Hash FNV-1a, identique à lib/translations-core.ts (scripts en JS pur).
function hashSource(text) {
  let h = 0x811c9dc5
  const s = text.trim()
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const photoCaptionKey = (publicId) => `photo:${publicId}`

function fieldStatus(t, field, locale, french) {
  const meta = t?._meta?.[field]?.[locale]
  const hasText = !!t?.[locale]?.[field]
  if (!french.trim()) return 'non_traduit'
  if (!meta) return hasText ? 'corrige' : 'non_traduit'
  if (
    (meta.statut === 'corrige' || meta.statut === 'relu') &&
    meta.sourceHash !== hashSource(french)
  ) {
    return 'a_mettre_a_jour'
  }
  return meta.statut
}

const STATUS_LABEL = {
  non_traduit: 'manquant',
  a_mettre_a_jour: 'à mettre à jour',
  echec: 'échec',
  auto: 'traduit',
  corrige: 'corrigé',
  relu: 'traduit et relu',
}

/** Champs français traduisibles des réglages (miroir de settingsFrenchFields). */
function settingsFrenchFields(s) {
  const fields = {
    bioShort: s.bioShort || '',
    bio: s.bio || '',
    processText: s.processText || '',
    tagline: s.tagline || '',
    presentation: s.presentation || '',
  }
  for (const p of s.photos || []) {
    if (p.publicId) fields[photoCaptionKey(p.publicId)] = p.caption || ''
  }
  return fields
}

/** Champs français traduisibles d'un événement (miroir d'eventFrenchFields). */
function eventFrenchFields(e) {
  const fields = {
    title: e.title || '',
    description: e.description || '',
    location: e.location || '',
  }
  for (const img of e.images || []) {
    if (img.publicId) fields[photoCaptionKey(img.publicId)] = img.alt || ''
  }
  return fields
}

/** Champs français traduisibles d'une toile (miroir de paintingFrenchFields). */
function paintingFrenchFields(p) {
  const n = p.notice
  return {
    title: p.title || '',
    description: p.description || '',
    notice_accroche: n?.accroche || '',
    notice_texte: n?.texte_client || '',
    notice_ambiance: n?.ambiance || '',
    notice_matiere: (n?.matiere_technique || []).join('\n'),
  }
}

const FIELD_LABELS = {
  title: 'titre',
  description: 'description',
  location: 'lieu',
  bioShort: 'accroche (ligne sous le nom)',
  bio: 'présentation de l’artiste',
  processText: 'démarche picturale',
  tagline: 'phrase d’accroche (accueil)',
  presentation: 'texte de présentation (accueil)',
  notice_accroche: 'accroche de la fiche',
  notice_texte: 'texte de la fiche',
  notice_ambiance: 'ambiance de la fiche',
  notice_matiere: 'matière et technique de la fiche',
}

const fieldLabel = (f) =>
  FIELD_LABELS[f] || (f.startsWith('photo:') ? `légende photo ${f.slice(6)}` : f)

function report(label, french, translations) {
  const missing = []
  for (const locale of TARGET_LOCALES) {
    for (const [field, text] of Object.entries(french)) {
      if (!text.trim()) continue // champ français vide : rien à traduire
      const status = fieldStatus(translations, field, locale, text)
      if (status === 'non_traduit' || status === 'a_mettre_a_jour' || status === 'echec') {
        missing.push({ locale, field, status, raison: translations?._meta?.[field]?.[locale]?.erreur })
      }
    }
  }
  if (missing.length === 0) {
    console.log(`  ✓ ${label}`)
    return 0
  }
  console.log(`  ✗ ${label}`)
  for (const m of missing) {
    const extra = m.status === 'echec' && m.raison ? ` — ${m.raison}` : ''
    console.log(
      `      ${LOCALES_NOM[m.locale].padEnd(8)} ${fieldLabel(m.field)} : ${STATUS_LABEL[m.status]}${extra}`
    )
  }
  return missing.length
}

try {
  const [{ rows: paintings }, { rows: events }, { rows: settingsRows }] = await Promise.all([
    pool.query('SELECT title, description, notice, translations FROM paintings ORDER BY "order" NULLS LAST'),
    pool.query('SELECT title, description, location, images, translations FROM events ORDER BY event_date DESC NULLS LAST'),
    pool.query('SELECT data, translations FROM settings WHERE id = 1'),
  ])

  let total = 0
  console.log(`\nToiles (${paintings.length})`)
  for (const p of paintings) {
    total += report(`« ${p.title} »`, paintingFrenchFields(p), p.translations || {})
  }
  console.log(`\nÉvénements (${events.length})`)
  for (const e of events) {
    total += report(`« ${e.title} »`, eventFrenchFields(e), e.translations || {})
  }
  console.log('\nRéglages (accroche, présentation, démarche, légendes)')
  total += report(
    'Présentation du site',
    settingsFrenchFields(settingsRows[0]?.data || {}),
    settingsRows[0]?.translations || {}
  )

  console.log(
    total === 0
      ? '\nTout est traduit ✓'
      : `\n${total} champ${total > 1 ? 's' : ''} à traduire — « Traduire tout mon site » dans l’admin les reprend.`
  )
  process.exit(total === 0 ? 0 : 1)
} catch (err) {
  if (err?.code === '42703') {
    console.error('Colonne translations absente — lancez npm run migrate.')
    process.exit(1)
  }
  console.error('translate:check a échoué :', err?.message || err)
  process.exit(1)
} finally {
  await pool.end().catch(() => {})
}
