import { describe, expect, it } from 'vitest'
import { analysisOutputSchema } from '../lib/analyse'
import { analysisBodySchema, noticeBodySchema, paintingBodySchema } from '../lib/validation'
import { mapPaintingRow } from '../lib/mappers'
import { paintingFrenchFields } from '../lib/translations-core'

const VALID = {
  accroche: 'Des bleus profonds traversés d’une lumière dorée.',
  texte_client: 'Premier paragraphe.\n\nSecond paragraphe.',
  ambiance: 'S’accordera bien avec un salon clair.',
  matiere_technique: ['Coups de couteau visibles', 'Touches d’or', 'Matière épaisse'],
  notes_artiste: ['Piste constructive'],
  repere_prix: '800-1000',
}

describe('analysisOutputSchema (sortie du modèle)', () => {
  it('accepte une sortie complète avec notes privées', () => {
    const r = analysisOutputSchema.parse(VALID)
    expect(r.notes_artiste).toHaveLength(1)
    expect(r.repere_prix).toBe('800-1000')
  })

  it('accepte une sortie sans notes ni repère de prix (optionnels)', () => {
    const { notes_artiste, repere_prix, ...rest } = VALID
    expect(analysisOutputSchema.parse(rest)).toMatchObject(rest)
  })

  it('rejette un champ public manquant ou vide', () => {
    expect(analysisOutputSchema.safeParse({ ...VALID, accroche: '' }).success).toBe(false)
    expect(
      analysisOutputSchema.safeParse({ ...VALID, matiere_technique: [] }).success
    ).toBe(false)
    expect(analysisOutputSchema.safeParse({ texte_client: 'x' }).success).toBe(false)
  })
})

describe('noticeBodySchema (publication)', () => {
  it('accepte les 4 champs publics', () => {
    const r = noticeBodySchema.parse({
      accroche: 'a',
      texte_client: 't',
      ambiance: 'b',
      matiere_technique: ['p1', 'p2'],
    })
    expect(r.matiere_technique).toHaveLength(2)
  })

  it('ne contient que des champs publics — rien de privé n’y entre', () => {
    const keys = Object.keys(noticeBodySchema.shape)
    expect(keys.sort()).toEqual(['accroche', 'ambiance', 'matiere_technique', 'texte_client'])
  })
})

describe('séparation public / privé', () => {
  it('mapPaintingRow ne transporte jamais analysis ni notes_artiste', () => {
    const row = {
      id: 'x',
      title: 'T',
      image_url: 'u',
      analysis: { notes_artiste: ['secret'], repere_prix: '900' },
      notice: {
        accroche: 'a',
        texte_client: 't',
        ambiance: 'b',
        matiere_technique: ['p'],
        notes_artiste: ['ne doit pas passer'],
        repere_prix: 'ne doit pas passer',
      },
      signature: 'signée en bas à droite',
    }
    const p = mapPaintingRow(row as never)
    const s = JSON.stringify(p)
    expect(s).not.toContain('notes_artiste')
    expect(s).not.toContain('repere')
    expect(s).not.toContain('secret')
    expect(p.notice?.accroche).toBe('a')
    expect(p.notice?.matiere_technique).toEqual(['p'])
    expect(p.signature).toBe('signée en bas à droite')
  })

  it('une notice vide devient undefined (rien ne s’affiche)', () => {
    const p = mapPaintingRow({
      id: 'x',
      title: 'T',
      image_url: 'u',
      notice: { accroche: '', texte_client: ' ', ambiance: '', matiere_technique: [] },
    } as never)
    expect(p.notice).toBeUndefined()
  })

  it('paintingFrenchFields inclut les 4 champs de la notice', () => {
    const f = paintingFrenchFields({
      title: 'T',
      description: 'd',
      notice: {
        accroche: 'a',
        texte_client: 't',
        ambiance: 'b',
        matiere_technique: ['p1', 'p2'],
      },
    })
    expect(f.notice_accroche).toBe('a')
    expect(f.notice_matiere).toBe('p1\np2')
    // Toile sans notice : champs vides → planField les ignore (skip).
    const empty = paintingFrenchFields({ title: 'T' })
    expect(empty.notice_accroche).toBe('')
  })

  it('paintingBodySchema accepte notice + analysis, mais rejette tout champ inconnu ou HTML', () => {
    const base = {
      title: 'Lumière d’octobre',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/cat',
      imagePublicId: 'cat',
      notice: {
        accroche: 'Une phrase sensible.',
        texte_client: 'Premier paragraphe.\n\nSecond paragraphe.',
        ambiance: 'Dans un salon clair.',
        matiere_technique: ['Couteau', 'Touches épaisses'],
      },
      analysis: VALID,
    }
    expect(paintingBodySchema.safeParse(base).success).toBe(true)

    // Champ inconnu à la racine → rejeté (.strict())
    expect(
      paintingBodySchema.safeParse({ ...base, champInconnu: 'interdit' }).success
    ).toBe(false)

    // Champ privé glissé dans notice → rejeté (.strict())
    expect(
      noticeBodySchema.safeParse({
        ...base.notice,
        notes_artiste: ['interdit dans notice'],
      }).success
    ).toBe(false)

    // Balises HTML dans notice ou analysis → rejetées
    expect(
      noticeBodySchema.safeParse({
        ...base.notice,
        texte_client: 'Texte <script>alert(1)</script>',
      }).success
    ).toBe(false)
    expect(
      analysisBodySchema.safeParse({
        ...VALID,
        notes_artiste: ['<img src=x onerror=alert(1)>'],
      }).success
    ).toBe(false)
  })
})
