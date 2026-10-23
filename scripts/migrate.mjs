// Migration additive : crée les tables si absentes et ajoute les colonnes
// manquantes. Jamais de DROP ni de suppression de colonne.
// Usage : npm run migrate  (charge .env puis .env.local si présents)
// Mode --soft (automatique sur Vercel via la variable VERCEL) : une erreur
// est affichée dans les logs mais le script sort en 0 pour ne pas bloquer
// le déploiement.

import pg from 'pg'
const { Pool } = pg

const soft = process.argv.includes('--soft') || !!process.env.VERCEL

const ssl =
  process.env.DATABASE_SSL === 'false'
    ? false
    : process.env.DATABASE_CA_CERT
      ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
      : { rejectUnauthorized: true }

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant — renseignez-le dans .env ou .env.local')
  if (soft) {
    console.error('Migration ignorée (mode non bloquant) : le build continue.')
  }
  process.exit(soft ? 0 : 1)
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
  // Deux galeries : peintures / collages. Toutes les œuvres existantes
  // restent en 'peintures' grâce au DEFAULT.
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'peintures'`,
  // Traductions automatiques (en/es/de) : { en: {champ: texte}, ...,
  // _meta: { champ: { langue: { sourceHash, statut } } } }. Jamais de
  // contenu existant modifié — colonne vide au départ.
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb`,
  // Historique des traductions avant chaque import manuel — permet
  // « Annuler le dernier import » sans jamais perdre de données.
  `CREATE TABLE IF NOT EXISTS translation_backups (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    translations JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_translation_backups_batch ON translation_backups (batch_id)`,
  // Origine de la sauvegarde : 'import' (bouton « Annuler le dernier
  // import ») ou 'auto' (traduction automatique — jamais restaurée par
  // le bouton d'annulation d'import).
  `ALTER TABLE translation_backups ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'import'`,
  // Photos des expositions (≤10, la première = couverture). Les
  // événements existants gardent cover_url/media — la lecture déduit
  // `images` de ces colonnes, rien n'est recopié ni perdu.
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb`,
  // Accroche de la page d'accueil, pré-remplie au premier déploiement
  // avec un texte neutre — jamais réécrite si l'artiste l'a modifiée.
  `UPDATE settings SET data = data || '{"tagline":"Peintures et collages — la matière en lumière"}'::jsonb WHERE id = 1 AND COALESCE(NULLIF(TRIM(data->>'tagline'), ''), '') = ''`,
  // Analyse IA d'une toile : `analysis` garde la sortie complète du modèle
  // (dont les notes privées) et n'est JAMAIS renvoyée par les requêtes
  // publiques ; `notice` ne contient que les 4 champs publiés par l'artiste.
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS analysis JSONB`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS analysed_at TIMESTAMPTZ`,
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS notice JSONB`,
  // Signature de l'œuvre (ex. « signée en bas à droite ») — affichée dans
  // la fiche technique uniquement quand elle est renseignée.
  `ALTER TABLE paintings ADD COLUMN IF NOT EXISTS signature TEXT`,
  // Adresse de contact officielle — mise à jour uniquement si le champ est
  // vide ou garde encore l'ancienne valeur par défaut ; une adresse saisie
  // par l'artiste n'est jamais écrasée.
  `UPDATE settings SET data = jsonb_set(data, '{email}', '"marieclairescandella@yahoo.fr"') WHERE id = 1 AND COALESCE(NULLIF(TRIM(data->>'email'), ''), 'contact@marie-claire-scandella.fr') = 'contact@marie-claire-scandella.fr'`,
  // Verrou anti brute-force du login admin : une ligne par tentative
  // échouée, comptée sur 15 min et purgée après 24 h.
  `CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_at ON login_attempts (ip, attempted_at)`,
  // Lien Instagram : l'ancienne clé `instagram` (identifiant brut) devient
  // `instagramUrl` canonique si celle-ci n'existe pas déjà. L'identifiant
  // n'est repris que s'il est sain (lettres/chiffres/points/underscores,
  // ≤30) — une valeur exotique est simplement abandonnée, pas copiée.
  // L'ancienne clé et le `phone` retiré ne sont plus lus ni écrits.
  `UPDATE settings
   SET data = (data - 'instagram' - 'phone') ||
     jsonb_build_object('instagramUrl', concat('https://www.instagram.com/', ltrim(data->>'instagram', '@'), '/'))
   WHERE id = 1
     AND data ? 'instagram'
     AND NOT data ? 'instagramUrl'
     AND data->>'instagram' ~ '^@?[A-Za-z0-9._]{1,30}$'`,
]

try {
  for (const sql of statements) {
    await pool.query(sql)
    console.log('OK:', sql.split('\n')[0].trim().slice(0, 80))
  }
  console.log('\nMigration terminée.')
} catch (err) {
  console.error('Échec de la migration :', err.message)
  if (soft) {
    console.error('Mode non bloquant : le build continue malgré cet échec.')
  } else {
    process.exitCode = 1
  }
} finally {
  await pool.end()
}
