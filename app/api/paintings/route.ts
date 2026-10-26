import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { mapPaintingRow } from '@/lib/mappers'
import { paintingBodySchema } from '@/lib/validation'
import type { PaintingAnalysis, PaintingNotice } from '@/lib/types'

export const dynamic = 'force-dynamic'

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

// Projection publique : colonnes explicites — la colonne privée
// `analysis` n'est JAMAIS lue ni renvoyée par l'API.
const PUBLIC_COLS = `id, title, year, technique, dimensions, description, image_url,
  image_public_id, price, price_status, featured, "order", created_at,
  image_width, image_height, category, signature, notice, translations, frame`

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLS} FROM paintings ORDER BY featured DESC, "order" ASC`
    )
    return NextResponse.json(rows.map(mapPaintingRow))
  } catch (err) {
    // Colonnes signature/notice pas encore créées : repli sans elles.
    if ((err as { code?: string })?.code !== '42703') return handleRouteError(err)
    try {
      const { rows } = await pool.query(
        `SELECT id, title, year, technique, dimensions, description, image_url,
          image_public_id, price, price_status, featured, "order", created_at,
          image_width, image_height, category, translations
         FROM paintings ORDER BY featured DESC, "order" ASC`
      )
      return NextResponse.json(rows.map(mapPaintingRow))
    } catch (err2) {
      return handleRouteError(err2)
    }
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const b = paintingBodySchema.parse(await req.json())
    const cleanNotice = sanitizeNoticeInput(b.notice)
    const cleanAnalysis = sanitizeAnalysisInput(b.analysis)
    const values = [
      b.id ?? null,
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
      JSON.stringify(b.translations || {}),
      b.signature,
      cleanNotice ? JSON.stringify(cleanNotice) : null,
      cleanAnalysis ? JSON.stringify(cleanAnalysis) : null,
      b.frame ?? null,
    ]
    try {
      // Une seule requête atomique : la toile, la notice (si cochée) et
      // l'analyse privée sont enregistrées ensemble (tout ou rien).
      // RETURNING utilise PUBLIC_COLS : `analysis` ne quitte jamais le serveur.
      const { rows } = await pool.query(
        `INSERT INTO paintings (
          id, title, year, technique, dimensions, description, image_url,
          image_public_id, price, price_status, featured, "order",
          image_width, image_height, category, translations, signature,
          notice, analysis, analysed_at, frame
        )
         VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          $18::jsonb, $19::jsonb,
          CASE WHEN $19::jsonb IS NOT NULL THEN now() ELSE NULL END, $20
         )
         RETURNING ${PUBLIC_COLS}`,
        values
      )
      return NextResponse.json(mapPaintingRow(rows[0]))
    } catch (err) {
      // Colonnes récentes pas encore créées : repli sans elles.
      if ((err as { code?: string })?.code !== '42703') throw err
      const { rows } = await pool.query(
        `INSERT INTO paintings (id, title, year, technique, dimensions, description, image_url, image_public_id, price, price_status, featured, "order")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        values.slice(0, 12)
      )
      return NextResponse.json(mapPaintingRow(rows[0]))
    }
  } catch (err) {
    return handleRouteError(err)
  }
}
