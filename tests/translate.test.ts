import { describe, expect, it } from 'vitest'
import {
  TruncatedResponseError,
  extractJson,
  failureReason,
  isRetryableError,
  splitForTranslation,
  validateTranslation,
} from '../lib/translate'

describe('splitForTranslation', () => {
  it('ne découpe pas un texte court', () => {
    expect(splitForTranslation('Un paragraphe.')).toEqual(['Un paragraphe.'])
  })

  it('découpe aux paragraphes et la concaténation restitue le texte', () => {
    const source = Array.from(
      { length: 12 },
      (_, i) => `Paragraphe ${i + 1}. ${'phrase. '.repeat(60)}`
    ).join('\n\n')
    expect(source.length).toBeGreaterThan(3000)
    const chunks = splitForTranslation(source)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(3000)
    expect(chunks.join('')).toBe(source)
  })

  it('découpe un paragraphe seul trop long sans perdre un caractère', () => {
    const source = 'mot '.repeat(1500).trim() // ~6 000 car., aucun saut de ligne
    const chunks = splitForTranslation(source)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(source)
  })
})

describe('extractJson', () => {
  it('lit un JSON nu', () => {
    expect(JSON.parse(extractJson('{"text":"Hello"}'))).toEqual({ text: 'Hello' })
  })
  it('lit un JSON dans un bloc ```json', () => {
    const raw = 'Voici :\n```json\n{"text":"Hallo"}\n```\nMerci.'
    expect(JSON.parse(extractJson(raw)).text).toBe('Hallo')
  })
  it('rejette une réponse sans JSON', () => {
    expect(() => extractJson('aucun objet ici')).toThrow('no-json')
  })
  it('rejette une réponse tronquée', () => {
    expect(() => extractJson('{"text": "début mais jamais la fin')).toThrow()
  })
})

describe('validateTranslation', () => {
  it('accepte une traduction correcte', () => {
    expect(
      validateTranslation(
        'Je peins depuis vingt ans dans mon atelier.',
        'I have been painting for twenty years in my studio.'
      )
    ).toBeNull()
  })
  it('refuse une traduction vide', () => {
    expect(validateTranslation('Un texte', '   ')).toBe('La traduction est revenue vide')
  })
  it('refuse un texte resté en français', () => {
    expect(
      validateTranslation(
        'Je travaille la matière depuis vingt ans.',
        'Je travaille la matière depuis vingt ans.'
      )
    ).toBe('La traduction est restée en français')
  })
  it('accepte un champ quasi identique court (noms propres)', () => {
    expect(validateTranslation('Marie-Claire Scandella', 'Marie-Claire Scandella')).toBeNull()
  })
  it('refuse une traduction trop courte', () => {
    expect(validateTranslation('a'.repeat(200), 'short')).toBe(
      'La traduction a une longueur anormale'
    )
  })
  it('refuse une traduction trop longue', () => {
    expect(validateTranslation('a'.repeat(100), 'b'.repeat(300))).toBe(
      'La traduction a une longueur anormale'
    )
  })
})

describe('isRetryableError', () => {
  const withStatus = (status: number) => Object.assign(new Error('x'), { status })
  it('retente 429, 5xx, timeouts et réponses illisibles', () => {
    expect(isRetryableError(withStatus(429))).toBe(true)
    expect(isRetryableError(withStatus(500))).toBe(true)
    expect(isRetryableError(withStatus(529))).toBe(true)
    expect(isRetryableError(new Error('no-json'))).toBe(true)
    expect(isRetryableError(new TruncatedResponseError())).toBe(true)
  })
  it('échoue immédiatement sur 400, 401, 403, 404', () => {
    for (const s of [400, 401, 403, 404]) expect(isRetryableError(withStatus(s))).toBe(false)
  })
})

describe('failureReason', () => {
  const withStatus = (status: number) => Object.assign(new Error('x'), { status })
  it('donne une raison en français pour chaque cas', () => {
    expect(failureReason(withStatus(401))).toBe('La clé de traduction est absente ou invalide')
    expect(failureReason(withStatus(404))).toBe('Le modèle de traduction est introuvable')
    expect(failureReason(withStatus(429))).toBe('Trop de demandes — réessayez dans un instant')
    expect(failureReason(withStatus(503))).toBe('Le service de traduction est indisponible')
    expect(failureReason(new TruncatedResponseError())).toBe(
      'La réponse du traducteur a été coupée'
    )
    expect(failureReason(new Error('no-json'))).toBe('La réponse du traducteur était illisible')
    expect(failureReason(new Error('???'))).toBe('La traduction a échoué')
  })
})
