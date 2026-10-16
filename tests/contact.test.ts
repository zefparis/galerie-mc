import { afterEach, describe, expect, it, vi } from 'vitest'
import { contactBodySchema } from '../lib/validation'
import { resolveFrom, sendContactEmail } from '../lib/mail'

const valid = {
  name: 'Claire Dupont',
  email: 'claire@example.com',
  subject: 'Question sur une œuvre',
  message: 'Bonjour, votre toile « Éclat » est-elle encore disponible ?',
  website: '',
}

describe('contactBodySchema', () => {
  it('accepte un message complet valide', () => {
    const r = contactBodySchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('accepte un sujet vide', () => {
    const { subject: _s, ...rest } = valid
    const r = contactBodySchema.safeParse(rest)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.subject).toBe('')
  })

  it('rejette un email invalide', () => {
    expect(
      contactBodySchema.safeParse({ ...valid, email: 'pas-un-email' }).success
    ).toBe(false)
    expect(
      contactBodySchema.safeParse({ ...valid, email: '' }).success
    ).toBe(false)
  })

  it('rejette un nom ou un message vide', () => {
    expect(
      contactBodySchema.safeParse({ ...valid, name: '  ' }).success
    ).toBe(false)
    expect(
      contactBodySchema.safeParse({ ...valid, message: 'ok' }).success
    ).toBe(false)
  })

  it('rejette une clé inconnue (strict)', () => {
    expect(
      contactBodySchema.safeParse({ ...valid, cc: 'x@y.z' }).success
    ).toBe(false)
  })

  it('rejette les champs trop longs', () => {
    expect(
      contactBodySchema.safeParse({ ...valid, message: 'x'.repeat(4001) })
        .success
    ).toBe(false)
    expect(
      contactBodySchema.safeParse({ ...valid, subject: 'x'.repeat(151) })
        .success
    ).toBe(false)
  })

  it('le pot-de-miel « website » est accepté par le schéma (filtré en route)', () => {
    const r = contactBodySchema.safeParse({ ...valid, website: 'http://spam' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.website).toBe('http://spam')
  })
})

describe('resolveFrom (expéditeur technique)', () => {
  const PREV = process.env.CONTACT_FROM

  afterEach(() => {
    if (PREV === undefined) delete process.env.CONTACT_FROM
    else process.env.CONTACT_FROM = PREV
  })

  it('vaut contact@scandellart.fr quand CONTACT_FROM est absent', () => {
    delete process.env.CONTACT_FROM
    expect(resolveFrom()).toBe("Scandell'Art <contact@scandellart.fr>")
  })

  it('utilise CONTACT_FROM quand il est sur scandellart.fr', () => {
    process.env.CONTACT_FROM = 'Site <noreply@scandellart.fr>'
    expect(resolveFrom()).toBe('Site <noreply@scandellart.fr>')
    process.env.CONTACT_FROM = 'atelier@scandellart.fr'
    expect(resolveFrom()).toBe('atelier@scandellart.fr')
  })

  it('replie sur contact@scandellart.fr si CONTACT_FROM est hors domaine', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.CONTACT_FROM = "Scandell'Art <marieclairescandella@yahoo.fr>"
    expect(resolveFrom()).toBe("Scandell'Art <contact@scandellart.fr>")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('CONTACT_FROM hors domaine vérifié')
    )
    process.env.CONTACT_FROM = 'x@gmail.com'
    expect(resolveFrom()).toBe("Scandell'Art <contact@scandellart.fr>")
    warn.mockRestore()
  })
})

describe('sendContactEmail (payload Resend)', () => {
  const PREV_FROM = process.env.CONTACT_FROM
  const PREV_KEY = process.env.RESEND_API_KEY
  const PREV_BASE = process.env.RESEND_API_BASE_URL

  afterEach(() => {
    for (const [k, v] of [
      ['CONTACT_FROM', PREV_FROM],
      ['RESEND_API_KEY', PREV_KEY],
      ['RESEND_API_BASE_URL', PREV_BASE],
    ] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.unstubAllGlobals()
  })

  const input = {
    name: 'Claire Dupont',
    email: 'claire@example.com',
    subject: 'Question',
    message: 'Bonjour, votre toile est-elle disponible ?',
    to: 'marieclairescandella@yahoo.fr',
  }

  async function captureBody() {
    let sent: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent = JSON.parse(init.body)
        return new Response('{"id":"x"}', { status: 200 })
      })
    )
    process.env.RESEND_API_KEY = 're_test'
    await sendContactEmail(input)
    return sent
  }

  it('envoie to = artiste, reply_to = visiteur, from = contact@scandellart.fr', async () => {
    delete process.env.CONTACT_FROM
    const body = await captureBody()
    expect(body.to).toEqual(['marieclairescandella@yahoo.fr'])
    expect(body.reply_to).toBe('claire@example.com')
    expect(body.from).toBe("Scandell'Art <contact@scandellart.fr>")
  })

  it('to et reply_to inchangés quand CONTACT_FROM est hors domaine', async () => {
    process.env.CONTACT_FROM = 'marieclairescandella@yahoo.fr'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const body = await captureBody()
    expect(body.to).toEqual(['marieclairescandella@yahoo.fr'])
    expect(body.reply_to).toBe('claire@example.com')
    expect(body.from).toBe("Scandell'Art <contact@scandellart.fr>")
  })

  it('refuse sans RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY
    const r = await sendContactEmail(input)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(503)
  })
})
