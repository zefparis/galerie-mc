import { describe, expect, it } from 'vitest'
import { contactBodySchema } from '../lib/validation'

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
