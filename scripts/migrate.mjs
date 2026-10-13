// Migration additive : crée les tables si absentes et ajoute les colonnes
// manquantes. Jamais de DROP ni de suppression de colonne.
// Usage : npm run migrate  (charge .env puis .env.local si présents)

import pg from 'pg'
const { Pool } = pg

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

const statements = [
  `CREATE TABLE IF NOT EXISTS paintings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    year INTEGER,
    technique TEXT,
    dimensions TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    image_public_id TEXT,
    price NUMERIC,
    price_status TEXT DEFAULT 'sur_demande',
    featured BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_date DATE,
    cover_url TEXT,
    cover_public_id TEXT,
    media JSONB DEFAULT '[]',
    published BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  // Colonnes additives au cas où une table existerait déjà avec un schéma partiel
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS year INTEGER`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS technique TEXT`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS dimensions TEXT`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS image_public_id TEXT`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS price NUMERIC`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS price_status TEXT DEFAULT 'sur_demande'`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date DATE`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_public_id TEXT`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
  `CREATE INDEX IF NOT EXISTS idx_events_published ON events (published)`,
  // Réglages de l'artiste : une ligne unique (id = 1), contenu en JSONB.
  `CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY CHECK (id = 1),
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,
  // Dimensions réelles de l'image (ratio affiché sans saut de mise en page)
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS image_width INTEGER`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS image_height INTEGER`,
]

try {
  for (const sql of statements) {
    await pool.query(sql)
    console.log('OK:', sql.split('\n')[0].trim().slice(0, 80))
  }
  console.log('\nMigration terminée.')
} catch (err) {
  console.error('Échec de la migration :', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
