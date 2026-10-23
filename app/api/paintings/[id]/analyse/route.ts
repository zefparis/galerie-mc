import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { uuidSchema } from '@/lib/validation'

// État privé de l'analyse d'une toile — admin uniquement. Renvoie
// `analysis` (notes_artiste, repère de prix) : cette route est la SEULE
// où ces données quittent le serveur, derrière requireAdmin.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const { rows } = await pool.query(
      'SELECT analysis, analysed_at, notice FROM paintings WHERE id=$1',
      [parsedId.data]
    )
    if (!rows.length) return notFound('Toile introuvable')
    return NextResponse.json({
      ok: true,
      analysis: rows[0].analysis || null,
      analysedAt: rows[0].analysed_at || null,
      notice: rows[0].notice || null,
    })
  } catch (err) {
    // Colonne analysis absente (migration en retard) : état vide.
    if ((err as { code?: string })?.code === '42703') {
      return NextResponse.json({ ok: true, analysis: null, analysedAt: null, notice: null })
    }
    return handleRouteError(err)
  }
}
