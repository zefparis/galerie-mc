import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Réinitialise le cadre de TOUTES les toiles : elles repassent au cadre
// général des réglages (frame = NULL). Réservé à l'administratrice.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { rows } = await pool.query(
      'UPDATE paintings SET frame = NULL WHERE frame IS NOT NULL RETURNING id'
    )
    return NextResponse.json({ reset: rows.length })
  } catch (err) {
    // Colonne frame absente (migration en retard) : rien à réinitialiser.
    if ((err as { code?: string })?.code === '42703') {
      return NextResponse.json({ reset: 0 })
    }
    return handleRouteError(err)
  }
}
