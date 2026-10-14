import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { noticeBodySchema, uuidSchema } from '@/lib/validation'
import { NOTICE_KEYS, withStaleMarks } from '@/lib/translations-core'
import type { PaintingNotice, Translations } from '@/lib/types'

// Publication de la notice : admin uniquement, écriture explicite sur
// clic « Publier sur la fiche ». La colonne `notice` ne reçoit que les 4
// champs publics — notes_artiste et repere_prix restent dans `analysis`.
export const dynamic = 'force-dynamic'

// Champs français de la notice pour le suivi des traductions.
function noticeFrench(n: PaintingNotice | null | undefined): Record<string, string> {
  return {
    [NOTICE_KEYS.accroche]: n?.accroche || '',
    [NOTICE_KEYS.texte_client]: n?.texte_client || '',
    [NOTICE_KEYS.ambiance]: n?.ambiance || '',
    [NOTICE_KEYS.matiere_technique]: (n?.matiere_technique || []).join('\n'),
  }
}

// PUT — publie (ou republie après correction) le texte relu par l'artiste.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const b = noticeBodySchema.parse(await req.json())
    const notice: PaintingNotice = {
      accroche: b.accroche.trim(),
      texte_client: b.texte_client.trim(),
      ambiance: b.ambiance.trim(),
      matiere_technique: b.matiere_technique.map((p) => p.trim()).filter(Boolean),
    }
    if (!notice.accroche && !notice.texte_client && !notice.ambiance && !notice.matiere_technique.length) {
      return badRequest('La présentation est vide — écrivez au moins un champ.')
    }

    const { rows } = await pool.query(
      'SELECT notice, translations FROM paintings WHERE id=$1',
      [parsedId.data]
    )
    if (!rows.length) return notFound('Toile introuvable')

    // Si le français de la notice change, les traductions corrigées à la
    // main passent « À mettre à jour » — comme pour les autres contenus.
    const translations = withStaleMarks(
      (rows[0].translations as Translations) || {},
      noticeFrench(rows[0].notice as PaintingNotice | null),
      noticeFrench(notice)
    )

    await pool.query(
      'UPDATE paintings SET notice=$1, translations=$2 WHERE id=$3',
      [JSON.stringify(notice), JSON.stringify(translations), parsedId.data]
    )
    return NextResponse.json({ ok: true, notice, translations })
  } catch (err) {
    return handleRouteError(err)
  }
}

// DELETE — retire la notice de la fiche publique. L'analyse privée et les
// traductions sont conservées : rien n'est perdu si on republie.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const { rows } = await pool.query(
      'UPDATE paintings SET notice=NULL WHERE id=$1 RETURNING id',
      [parsedId.data]
    )
    if (!rows.length) return notFound('Toile introuvable')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
