// Envoi du formulaire de contact via l'API REST de Resend
// (https://resend.com — offre gratuite : 100 mails/jour, 3 000/mois).
// Clé serveur uniquement : RESEND_API_KEY ne quitte jamais le serveur.
// L'adresse de l'artiste reste privée : l'expéditeur technique est le
// domaine vérifié (CONTACT_FROM) et « Répondre à » pointe vers le
// visiteur, donc l'artiste répond directement depuis sa boîte mail.

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

interface ContactMailInput {
  name: string
  email: string
  subject: string
  message: string
  to: string
}

export async function sendContactEmail(
  input: ContactMailInput
): Promise<{ ok: boolean; status: number; hint?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, status: 503, hint: 'not-configured' }

  const base = (
    process.env.RESEND_API_BASE_URL || 'https://api.resend.com'
  ).replace(/\/+$/, '')
  const from =
    process.env.CONTACT_FROM ||
    "Scandell'Art <onboarding@resend.dev>"

  const subject = input.subject
    ? `[Scandell'Art] ${input.subject}`
    : `[Scandell'Art] Message de ${input.name}`

  const text = [
    `Nom : ${input.name}`,
    `Email : ${input.email}`,
    '',
    input.message,
    '',
    '—',
    'Répondez directement à ce message : votre réponse ira à',
    input.email,
  ].join('\n')

  const html = [
    '<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2c2620">',
    `<p style="font-size:13px;color:#8a6d3b;letter-spacing:.08em;text-transform:uppercase">Nouveau message depuis scandellart.fr</p>`,
    `<p><strong>${esc(input.name)}</strong> &lt;${esc(input.email)}&gt;</p>`,
    input.subject ? `<p><em>${esc(input.subject)}</em></p>` : '',
    `<div style="border-left:3px solid #c9a96e;padding:4px 0 4px 16px;margin:16px 0;white-space:pre-wrap">${esc(input.message)}</div>`,
    `<p style="font-size:13px;color:#8a8378">Répondez directement à ce message : votre réponse ira à ${esc(input.email)}.</p>`,
    '</div>',
  ].join('')

  try {
    const res = await fetch(`${base}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: input.email,
        subject,
        text,
        html,
      }),
    })
    if (res.ok) return { ok: true, status: res.status }
    const detail = await res.text().catch(() => '')
    console.error('[mail] envoi refusé', res.status, detail.slice(0, 300))
    // Le nom d'erreur Resend (ex. « validation_error ») est renvoyé dans
    // « hint » pour diagnostiquer sans ouvrir les logs Vercel.
    let hint: string | undefined
    try {
      const j = JSON.parse(detail) as { name?: string; message?: string }
      hint = [j.name, j.message].filter(Boolean).join(' : ').slice(0, 160)
    } catch {
      hint = detail.slice(0, 160) || undefined
    }
    return { ok: false, status: res.status, hint }
  } catch (err) {
    console.error('[mail] envoi impossible', err)
    return { ok: false, status: 0 }
  }
}
