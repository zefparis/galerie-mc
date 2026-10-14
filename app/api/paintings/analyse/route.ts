import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { badRequest, handleRouteError, notFound } from '@/lib/api'
import { cloudinaryUrl, uuidSchema } from '@/lib/validation'
import { isRateLimited } from '@/lib/ratelimit'
import { analysePainting, analysisDisabledReason, failureReason } from '@/lib/analyse'

// Analyse IA d'une toile — admin uniquement, appel Anthropic côté serveur.
// La sortie complète (avec notes privées) est persistée dans `analysis` ;
// seuls les 4 champs publics pourront être publiés via .../notice.
export const maxDuration = 90
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  paintingId: uuidSchema.optional(),
  // Photo analysée : seules des URLs de NOTRE espace Cloudinary passent —
  // jamais d'image externe ni de contenu arbitraire envoyé au modèle.
  imageUrl: cloudinaryUrl.optional(),
  title: z.string().trim().max(300).optional(),
  technique: z.string().max(100).optional(),
  year: z.number().int().min(0).max(3000).nullable().optional(),
  dimensions: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  // Deux fenêtres indépendantes : 10 analyses / heure ET 30 / jour.
  if (
    isRateLimited('analyse:hour', 10, 3_600_000) ||
    isRateLimited('analyse:day', 30, 86_400_000)
  ) {
    return NextResponse.json(
      { error: 'Trop de demandes — réessayez dans un moment.' },
      { status: 429 }
    )
  }

  try {
    const b = bodySchema.parse(await req.json())

    const disabled = analysisDisabledReason()
    if (disabled === 'disabled') {
      return NextResponse.json(
        { error: "L'analyse IA est désactivée (ANALYSE_ENABLED)." },
        { status: 503 }
      )
    }
    if (disabled === 'no-key') {
      return NextResponse.json(
        { error: 'Clé d\u2019analyse absente — renseignez ANTHROPIC_API_KEY.' },
        { status: 503 }
      )
    }

    // Informations de la fiche enregistrée en complément des champs du
    // formulaire (les valeurs du formulaire priment — c'est le brouillon).
    let stored: Record<string, unknown> | null = null
    if (b.paintingId) {
      const { rows } = await pool.query(
        'SELECT title, technique, year, dimensions, image_url FROM paintings WHERE id=$1',
        [b.paintingId]
      )
      if (!rows.length) return notFound('Toile introuvable')
      stored = rows[0]
    }

    const input = {
      imageUrl: b.imageUrl || (stored?.image_url as string) || '',
      title: b.title ?? (stored?.title as string | undefined),
      technique: b.technique ?? (stored?.technique as string | undefined),
      year: b.year ?? (stored?.year as number | null | undefined),
      dimensions: b.dimensions ?? (stored?.dimensions as string | undefined),
    }
    if (!input.imageUrl) {
      return badRequest('Ajoutez d\u2019abord une photo de la toile.')
    }
    // Sécurité côté serveur : l'URL finale doit venir de notre cloud même
    // si elle vient de la base.
    const checked = cloudinaryUrl.safeParse(input.imageUrl)
    if (!checked.success) {
      return badRequest('La photo doit venir de l\u2019espace photo du site.')
    }

    const analysis = await analysePainting({ ...input, imageUrl: checked.data })

    // Persistance privée (paintingId présent) — jamais en création
    // non enregistrée : l'analyse est seulement renvoyée au formulaire.
    let persisted = false
    if (b.paintingId) {
      try {
        await pool.query(
          'UPDATE paintings SET analysis=$1, analysed_at=now() WHERE id=$2',
          [JSON.stringify(analysis), b.paintingId]
        )
        persisted = true
      } catch (err) {
        // Colonne analysis absente (migration en retard) : l'analyse est
        // tout de même renvoyée — rien n'est bloqué ni perdu côté admin.
        if ((err as { code?: string })?.code !== '42703') throw err
      }
    }

    return NextResponse.json({ ok: true, analysis, persisted })
  } catch (err) {
    if (err instanceof z.ZodError) return handleRouteError(err)
    // Erreur lisible en français, sans contenu généré ni secret.
    const reason = failureReason(err)
      .replace(/de traduction|du traducteur/g, 'd\u2019analyse')
      .replace('de traducteur', 'd\u2019analyse')
    return NextResponse.json({ error: reason }, { status: 502 })
  }
}
