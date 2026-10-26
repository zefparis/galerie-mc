import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { mapPaintingRow } from '@/lib/mappers'
import { paintingBodySchema, uuidSchema } from '@/lib/validation'
import { paintingFrenchFields, withStaleMarks } from '@/lib/translations-core'
import type { PaintingAnalysis, PaintingNotice, Translations } from '@/lib/types'

export const dynamic = 'force-dynamic'

const PUBLIC_COLS = `id, title, year, technique, dimensions, description, image_url,
  image_public_id, price, price_status, featured, "order", created_at,
  image_width, image_height, category, signature, notice, translations`

function sanitizeNoticeInput(n: PaintingNotice | null | undefined): PaintingNotice | null {
  if (!n) return null
  const clean: PaintingNotice = {
    accroche: (n.accroche || '').trim(),
    texte_client: (n.texte_client || '').trim(),
    ambiance: (n.ambiance || '').trim(),
    matiere_technique: (n.matiere_technique || []).map((p) => p.trim()).filter(Boolean),
  }
  return clean.accroche || clean.texte_client || clean.ambiance || clean.matiere_technique.length
    ? clean
    : null
}

function sanitizeAnalysisInput(a: PaintingAnalysis | null | undefined): PaintingAnalysis | null {
  if (!a) return null
  const clean: PaintingAnalysis = {
    accroche: (a.accroche || '').trim(),
    texte_client: (a.texte_client || '').trim(),
    ambiance: (a.ambiance || '').trim(),
    matiere_technique: (a.matiere_technique || []).map((p) => p.trim()).filter(Boolean),
    ...(Array.isArray(a.notes_artiste)
      ? { notes_artiste: a.notes_artiste.map((n) => n.trim()).filter(Boolean) }
      : {}),
    ...(typeof a.repere_prix === 'string' && a.repere_prix.trim()
      ? { repere_prix: a.repere_prix.trim() }
      : {}),
  }
  const hasAny =
    clean.accroche ||
    clean.texte_client ||
    clean.ambiance ||
    clean.matiere_technique.length ||
    (clean.notes_artiste && clean.notes_artiste.length > 0) ||
    clean.repere_prix
  return hasAny ? clean : null
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const b = paintingBodySchema.parse(await req.json())

    // Ancien français + traductions : si le titre, la description ou la
    // notice change, les traductions corrigées à la main passent « À mettre à jour ».
    let mergedTranslations: Translations | undefined = b.translations as Translations | undefined
    let prevNotice: PaintingNotice | null = null
    let prevAnalysis: PaintingAnalysis | null = null
    try {
      const prev = await pool.query(
        'SELECT title, description, notice, analysis, translations FROM paintings WHERE id=$1',
        [parsedId.data]
      )
      if (prev.rows.length) {
        prevNotice = (prev.rows[0].notice as PaintingNotice | null) || null
        prevAnalysis = (prev.rows[0].analysis as PaintingAnalysis | null) || null
        const nextNoticeForDiff =
          b.notice !== undefined ? sanitizeNoticeInput(b.notice) : prevNotice
        const base = mergedTranslations ?? (prev.rows[0].translations as Translations)
        mergedTranslations = withStaleMarks(
          base,
          paintingFrenchFields({
            title: prev.rows[0].title || '',
            description: prev.rows[0].description || '',
            notice: prevNotice || undefined,
          }),
          paintingFrenchFields({
            title: b.title,
            description: b.description,
            notice: nextNoticeForDiff || undefined,
          })
        )
      }
    } catch (err) {
      // Colonnes récentes absentes : on continue sans.
      if ((err as { code?: string })?.code !== '42703') throw err
    }

    const nextNotice =
      b.notice !== undefined ? sanitizeNoticeInput(b.notice) : prevNotice
    const nextAnalysis =
      b.analysis !== undefined
        ? sanitizeAnalysisInput(b.analysis)
        : prevAnalysis
    const analysisUpdated = b.analysis !== undefined && sanitizeAnalysisInput(b.analysis) !== null

    const values = [
      b.title,
      b.year ?? null,
      b.technique ?? null,
      b.dimensions,
      b.description,
      b.imageUrl,
      b.imagePublicId,
      b.price ?? null,
      b.priceStatus,
      b.featured,
      b.order,
      b.imageWidth ?? null,
      b.imageHeight ?? null,
      b.category,
      parsedId.data,
    ]
    const valuesT = [
      ...values.slice(0, 14),
      JSON.stringify(mergedTranslations || {}),
      b.signature,
      nextNotice ? JSON.stringify(nextNotice) : null,
      nextAnalysis ? JSON.stringify(nextAnalysis) : null,
      analysisUpdated,
      parsedId.data,
    ]
    let rows
    try {
      ;({ rows } = await pool.query(
        // Changement de galerie : l'œuvre rejoint la FIN de sa nouvelle
        // liste (ordre = max+1 de la catégorie cible) ; sinon l'ordre
        // envoyé par le formulaire est conservé tel quel.
        `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
         image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10,
         "order"=CASE WHEN category IS DISTINCT FROM $14
           THEN (SELECT COALESCE(MAX("order"), 0) + 1 FROM paintings WHERE category = $14)
           ELSE $11 END,
         image_width=$12, image_height=$13, category=$14, translations=$15, signature=$16,
         notice=$17::jsonb, analysis=$18::jsonb,
         analysed_at=CASE WHEN $19::boolean THEN now() ELSE analysed_at END
         WHERE id=$20 RETURNING ${PUBLIC_COLS}`,
        valuesT
      ))
    } catch (err) {
      if ((err as { code?: string })?.code !== '42703') throw err
      try {
        ;({ rows } = await pool.query(
          `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
           image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11,
           image_width=$12, image_height=$13
           WHERE id=$14 RETURNING *`,
          values.slice(0, 14)
        ))
      } catch (err2) {
        if ((err2 as { code?: string })?.code !== '42703') throw err2
        ;({ rows } = await pool.query(
          `UPDATE paintings SET title=$1, year=$2, technique=$3, dimensions=$4, description=$5,
           image_url=$6, image_public_id=$7, price=$8, price_status=$9, featured=$10, "order"=$11
           WHERE id=$12 RETURNING *`,
          [...values.slice(0, 11), parsedId.data]
        ))
      }
    }
    if (rows.length === 0) return notFound('Tableau introuvable')
    return NextResponse.json(mapPaintingRow(rows[0]))
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const parsedId = uuidSchema.safeParse(params.id)
    if (!parsedId.success) return badRequest('Identifiant invalide')

    const { rows } = await pool.query(
      'DELETE FROM paintings WHERE id=$1 RETURNING id',
      [parsedId.data]
    )
    if (rows.length === 0) return notFound('Tableau introuvable')
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
