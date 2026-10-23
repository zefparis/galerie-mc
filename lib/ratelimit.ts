import pool from './db'

// Rate limit en mémoire — nominale en multi-instances (chaque lambda Vercel
// a sa propre Map), ce qui convient aux routes peu sensibles. Le login
// utilise un compteur partagé en base — voir isLoginRateLimited.
const hits = new Map<string, { count: number; reset: number }>()

// Borne haute : sans purge, une Map alimentée par des IP arbitraires
// grandirait indéfiniment sur une instance longue durée.
const MAX_ENTRIES = 5_000

function evict(now: number) {
  hits.forEach((v, k) => {
    if (v.reset < now) hits.delete(k)
  })
  // Toujours pleine après purge des expirées : on jette les plus anciennes
  // clés (ordre d'insertion) jusqu'à repasser sous la borne.
  let excess = hits.size - MAX_ENTRIES + 1
  hits.forEach((_v, k) => {
    if (excess-- > 0) hits.delete(k)
  })
}

export function isRateLimited(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    if (hits.size >= MAX_ENTRIES) evict(now)
    hits.set(key, { count: 1, reset: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > limit
}

// ─── Login : compteur persistant en base ────────────────────────────────────
// login_attempts garde une ligne par tentative échouée. Partagée entre
// toutes les instances lambda, la limite tient réellement sur Vercel.
const LOGIN_LIMIT = 5

/** true = la tentative doit être refusée (429). DB injoignable → fail
 *  closed : on refuse plutôt que de laisser passer sans limite. */
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  try {
    // Purge opportuniste : les lignes de plus de 24 h ne servent plus.
    await pool.query(
      `DELETE FROM login_attempts WHERE attempted_at < now() - interval '24 hours'`
    )
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM login_attempts
       WHERE ip = $1 AND attempted_at > now() - interval '15 minutes'`,
      [ip]
    )
    return (rows[0]?.n ?? LOGIN_LIMIT) >= LOGIN_LIMIT
  } catch (err) {
    console.error(
      '[auth] compteur de tentatives injoignable — connexion refusée :',
      (err as Error)?.message
    )
    return true
  }
}

/** À appeler après chaque mot de passe refusé. */
export async function recordLoginFailure(ip: string): Promise<void> {
  await pool.query(`INSERT INTO login_attempts (ip) VALUES ($1)`, [ip])
}

/** Succès : l'IP repart à zéro. */
export async function clearLoginAttempts(ip: string): Promise<void> {
  await pool.query(`DELETE FROM login_attempts WHERE ip = $1`, [ip])
}
