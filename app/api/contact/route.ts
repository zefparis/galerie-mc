import { NextRequest, NextResponse } from 'next/server'
import { contactBodySchema } from '@/lib/validation'
import { handleRouteError } from '@/lib/api'
import { isRateLimited } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/client-ip'
import { mailConfigured, sendContactEmail } from '@/lib/mail'
import { getGallerySettings } from '@/lib/data'

// Route publique, jamais pré-rendue.
export const dynamic = 'force-dynamic'

// Le front vérifie avant d'afficher le formulaire que l'envoi est
// configuré (sans révéler quoi que ce soit d'autre).
export async function GET() {
  return NextResponse.json(
    { configured: mailConfigured() },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (isRateLimited(`contact:${ip}`, 4, 10 * 60_000)) {
    return NextResponse.json(
      {
        error:
          'Trop de messages rapprochés — réessayez dans quelques minutes.',
      },
      { status: 429 }
    )
  }

  try {
    const b = contactBodySchema.parse(await req.json())

    // Pot-de-miel rempli = robot : on feint le succès sans rien envoyer.
    if (b.website) return NextResponse.json({ ok: true })

    if (!mailConfigured()) {
      return NextResponse.json(
        { configured: false, error: 'not-configured' },
        { status: 503 }
      )
    }

    const settings = await getGallerySettings()
    const to = (process.env.CONTACT_TO || settings.email || '').trim()
    if (!to) {
      return NextResponse.json(
        { configured: false, error: 'not-configured' },
        { status: 503 }
      )
    }

    const sent = await sendContactEmail({
      name: b.name,
      email: b.email,
      subject: b.subject,
      message: b.message,
      to,
    })
    if (!sent.ok) {
      return NextResponse.json(
        {
          error:
            "Je n'ai pas pu envoyer votre message — réessayez dans un instant ou écrivez directement à l'artiste.",
          // Motif technique Resend (visible dans l'onglet Réseau) pour
          // diagnostiquer la configuration sans lire les logs Vercel.
          ...(sent.hint ? { hint: sent.hint } : {}),
        },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err)
  }
}
