import { Pool } from 'pg'

function sslConfig() {
  // DATABASE_SSL=false : base locale sans SSL (dev uniquement)
  if (process.env.DATABASE_SSL === 'false') return false
  // DATABASE_CA_CERT : certificat CA si le serveur PG utilise un certificat auto-signé
  const ca = process.env.DATABASE_CA_CERT
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
  // 3 connexions par instance : sur Vercel chaque lambda a son propre pool —
  // un max plus large épuiserait vite le plafond d'une petite base.
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export default pool
