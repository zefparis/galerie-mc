import { NextRequest } from 'next/server'

// IP réelle du client pour le rate limiting.
// Ordre de confiance sur Vercel :
// 1. x-real-ip : posé par la plateforme, non falsifiable par le client ;
// 2. x-forwarded-for : la DERNIÈRE entrée est ajoutée par Vercel — la
//    première est librement choisie par le client (ne jamais la lire :
//    elle permettrait de contourner le rate limit en changeant d'IP) ;
// 3. 'unknown' en dernier recours (toutes les requêtes partagent alors
//    le même compteur — mieux vaut trop strict que pas de limite).
export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const last = forwarded.split(',').pop()?.trim()
    if (last) return last
  }
  return 'unknown'
}
