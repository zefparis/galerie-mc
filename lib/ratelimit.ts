// Rate limit en mémoire — suffisant pour une instance unique (Vercel single region
// ou serveur Node). Les compteurs sont perdus au redémarrage, ce qui est acceptable
// pour un verrou anti brute-force.
const hits = new Map<string, { count: number; reset: number }>()

export function isRateLimited(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > limit
}
