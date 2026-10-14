import { describe, expect, it } from 'vitest'
import { translateFields } from '../lib/translations-core'
import { splitForTranslation } from '../lib/translate'
import {
  buildJobs,
  failureLine,
  jobsToRetry,
  summaryText,
  type JobResult,
} from '../lib/translate-all'

describe('translateFields — budget de temps par requête', () => {
  // Simule une présentation de ~3 800 caractères comme en production :
  // chaque appel fournisseur « coûte » du temps ; une requête ne doit pas
  // dépasser son budget, et la passe complète se termine par continuations.
  it('un long texte passe dans les 3 langues sans dépasser le budget par requête', async () => {
    const longBio = Array.from(
      { length: 12 },
      (_, i) => `Paragraphe ${i + 1}. ${'Je travaille la matière et la lumière. '.repeat(8)}`
    ).join('\n\n')
    expect(longBio.length).toBeGreaterThan(3000)
    // Le découpage par paragraphes est bien nécessaire pour un tel texte.
    expect(splitForTranslation(longBio).length).toBeGreaterThan(1)

    const french = { bio: longBio, bioShort: 'Peintre abstraite' }
    let translations: import('../lib/types').Translations = {}
    // Chaque « champ » prend ~40 ms chez le fournisseur ; budget requête 100 ms.
    const CALL_MS = 40
    const BUDGET = 100
    const slowTranslator = async (texts: Record<string, string>) => {
      await new Promise((r) => setTimeout(r, CALL_MS))
      return {
        ok: Object.fromEntries(Object.keys(texts).map((k) => [k, `TR:${k}`])),
        failed: {},
      }
    }

    // Boucle identique à celle du client : on relance tant qu'il reste des champs.
    let passes = 0
    let remaining = 0
    do {
      const started = Date.now()
      const r = await translateFields(french, translations, ['en', 'es', 'de'], slowTranslator, {
        budgetMs: BUDGET,
      })
      expect(Date.now() - started).toBeLessThan(BUDGET + CALL_MS + 40)
      translations = r.translations
      remaining = r.remaining
      passes++
    } while (remaining > 0 && passes < 20)

    expect(remaining).toBe(0)
    // 2 champs × 3 langues = 6 traductions, réparties sur plusieurs requêtes.
    expect(passes).toBeGreaterThan(1)
    for (const locale of ['en', 'es', 'de'] as const) {
      expect(translations[locale]?.bio).toBe('TR:bio')
      expect(translations[locale]?.bioShort).toBe('TR:bioShort')
    }
  })

  it('un échec de champ est reporté avec sa raison et retenté à la passe suivante', async () => {
    const french = { title: 'Éclat', description: 'Une toile' }
    const r = await translateFields(french, {}, ['en'], async (texts) => {
      const outcome = { ok: {} as Record<string, string>, failed: {} as Record<string, string> }
      if ('description' in texts) outcome.failed.description = 'Trop de demandes — réessayez dans un instant'
      else outcome.ok.title = 'Burst'
      return outcome
    })
    expect(r.translated).toBe(1)
    expect(r.failures).toEqual([
      { field: 'description', locale: 'en', raison: 'Trop de demandes — réessayez dans un instant' },
    ])
    expect(r.remaining).toBe(0)
    // La traduction réussie n'est pas écrasée par l'échec.
    expect(r.translations.en?.title).toBe('Burst')
    expect(r.translations._meta?.description?.en?.statut).toBe('echec')
  })
})

describe('translate-all — boucle client, récapitulatif et retry', () => {
  const jobs = buildJobs([
    { entity: 'painting', id: 'p1', label: 'Éclat' },
    { entity: 'settings', label: 'Votre présentation et vos légendes' },
  ])

  it('un couple (contenu, langue) par requête', () => {
    // 2 contenus × 3 langues = 6 requêtes, jamais une seule grosse.
    expect(jobs).toHaveLength(6)
    expect(jobs[0]).toMatchObject({ entity: 'painting', id: 'p1', locale: 'en' })
    expect(jobs[5]).toMatchObject({ entity: 'settings', locale: 'de' })
  })

  const results: JobResult[] = [
    { job: jobs[0], translated: 2, failures: [] },
    {
      job: jobs[1],
      translated: 0,
      failures: [{ field: 'description', raison: 'Le service de traduction est indisponible' }],
      detail: 'HTTP 503',
    },
    { job: jobs[3], translated: 1, failures: [{ field: 'title', raison: 'La réponse du traducteur a été coupée' }] },
    { job: jobs[4], translated: 3, failures: [] },
  ]

  it('Réessayer ne reprend que les couples en échec', () => {
    const retry = jobsToRetry(results)
    expect(retry).toHaveLength(2)
    expect(retry.map((j) => j.locale)).toEqual(['es', 'en'])
  })

  it('le récapitulatif donne contenu, langue et cause en français', () => {
    const lines = results.flatMap(failureLine)
    expect(lines).toEqual([
      '« Éclat » — espagnol, description : Le service de traduction est indisponible',
      '« Votre présentation et vos légendes » — anglais, titre : La réponse du traducteur a été coupée',
    ])
    expect(summaryText(results, 6)).toBe(
      '6 textes traduits. 2 textes n’ont pas pu être traduits :'
    )
    expect(summaryText(results.slice(0, 1).concat(results.slice(3, 4)), 3)).toBe(
      'C’est fait ✓ 3 textes traduits.'
    )
    expect(summaryText([], 0)).toBe('Tout était déjà à jour ✓')
  })
})
