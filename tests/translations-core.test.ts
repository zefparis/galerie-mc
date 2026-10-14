import { describe, expect, it } from 'vitest'
import {
  fieldStatus,
  hashSource,
  markCorrected,
  markRelu,
  markStale,
  photoCaptionKey,
  planField,
  setFieldTranslation,
  settingsFrenchFields,
  translateFields,
  withStaleMarks,
} from '../lib/translations-core'
import type { Translations } from '../lib/types'

const fakeTranslator = (prefix: string) =>
  async (texts: Record<string, string>) => ({
    ok: Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, `${prefix}${v}`])),
    failed: {},
  })

describe('hashSource', () => {
  it('est stable et insensible aux espaces de bord', () => {
    expect(hashSource('Bonjour')).toBe(hashSource('  Bonjour  '))
    expect(hashSource('Bonjour')).not.toBe(hashSource('Bonsoir'))
  })
})

describe('planField', () => {
  const fr = 'Un texte français'
  it('traduit quand rien n’existe', () => {
    expect(planField({}, 'title', fr, 'en')).toBe('translate')
  })
  it('saute un champ français vide', () => {
    expect(planField({}, 'title', '  ', 'en')).toBe('skip')
  })
  it('saute une traduction auto à jour', () => {
    const t = setFieldTranslation({}, 'title', 'en', 'A text', fr)
    expect(planField(t, 'title', fr, 'en')).toBe('skip')
  })
  it('retraduit une traduction auto dont le français a changé', () => {
    const t = setFieldTranslation({}, 'title', 'en', 'A text', fr)
    expect(planField(t, 'title', 'Nouveau texte', 'en')).toBe('translate')
  })
  it('marque périmée une correction dont le français a changé', () => {
    const t = markCorrected({}, 'title', 'en', 'My fixed title', fr)
    expect(planField(t, 'title', 'Nouveau texte', 'en')).toBe('mark-stale')
  })
  it('conserve une correction si le français n’a pas changé', () => {
    const t = markCorrected({}, 'title', 'en', 'My fixed title', fr)
    expect(planField(t, 'title', fr, 'en')).toBe('skip')
  })
  it('retraduit tout avec force, sauf les champs vides', () => {
    const t = setFieldTranslation({}, 'title', 'en', 'A text', fr)
    expect(planField(t, 'title', fr, 'en', true)).toBe('translate')
    expect(planField({}, 'title', '', 'en', true)).toBe('skip')
  })
  it('un texte « relu » n’est jamais retraduit, même avec force', () => {
    const t = markRelu({}, 'title', 'en', 'Hand-made', fr)
    expect(planField(t, 'title', fr, 'en')).toBe('skip')
    expect(planField(t, 'title', fr, 'en', true)).toBe('skip')
    // Le français a changé → signalé, jamais effacé.
    expect(planField(t, 'title', 'Autre texte', 'en', true)).toBe('mark-stale')
  })
})

describe('setFieldTranslation / markCorrected / markStale', () => {
  it('enregistre le statut auto avec le hash source', () => {
    const t = setFieldTranslation({}, 'title', 'en', 'Hello', 'Bonjour')
    expect(t.en?.title).toBe('Hello')
    expect(t._meta?.title?.en?.statut).toBe('auto')
    expect(t._meta?.title?.en?.sourceHash).toBe(hashSource('Bonjour'))
  })
  it('markCorrected enregistre le statut corrige', () => {
    const t = markCorrected({}, 'title', 'de', 'Hallo', 'Bonjour')
    expect(t.de?.title).toBe('Hallo')
    expect(t._meta?.title?.de?.statut).toBe('corrige')
  })
  it('markCorrected avec un texte vide supprime proprement', () => {
    let t = markCorrected({}, 'title', 'de', 'Hallo', 'Bonjour')
    t = markCorrected(t, 'title', 'de', '   ', 'Bonjour')
    expect(t.de?.title).toBeUndefined()
    expect(t._meta?.title?.de).toBeUndefined()
  })
  it('markStale passe en a_mettre_a_jour sans effacer le texte', () => {
    let t = markCorrected({}, 'title', 'en', 'Fixed', 'Bonjour')
    t = markStale(t, 'title', 'en')
    expect(t.en?.title).toBe('Fixed')
    expect(t._meta?.title?.en?.statut).toBe('a_mettre_a_jour')
  })
  it('markRelu enregistre le statut relu avec l’empreinte du français', () => {
    const t = markRelu({}, 'title', 'de', 'Handgemacht', 'Bonjour')
    expect(t.de?.title).toBe('Handgemacht')
    expect(t._meta?.title?.de?.statut).toBe('relu')
    expect(t._meta?.title?.de?.sourceHash).toBe(hashSource('Bonjour'))
  })
})

describe('withStaleMarks', () => {
  it('ne marque que les champs dont le français a changé', () => {
    let t = markCorrected({}, 'title', 'en', 'Fixed', 'Bonjour')
    t = markCorrected(t, 'description', 'en', 'Fixed desc', 'Une description')
    const next = withStaleMarks(
      t,
      { title: 'Bonjour', description: 'Une description' },
      { title: 'Bonjour modifié', description: 'Une description' }
    )
    expect(fieldStatus(next, 'title', 'en', 'Bonjour modifié')).toBe('a_mettre_a_jour')
    expect(fieldStatus(next, 'description', 'en', 'Une description')).toBe('corrige')
  })
  it('ne touche pas les traductions auto (elles seront retraduites)', () => {
    const t = setFieldTranslation({}, 'title', 'en', 'Hello', 'Bonjour')
    const next = withStaleMarks(t, { title: 'Bonjour' }, { title: 'Autre' })
    expect(next._meta?.title?.en?.statut).toBe('auto')
  })
  it('marque aussi les traductions relues dont le français a changé', () => {
    const t = markRelu({}, 'title', 'en', 'Hand-made', 'Bonjour')
    const next = withStaleMarks(t, { title: 'Bonjour' }, { title: 'Autre' })
    expect(fieldStatus(next, 'title', 'en', 'Autre')).toBe('a_mettre_a_jour')
    expect(next.en?.title).toBe('Hand-made')
  })
})

describe('fieldStatus', () => {
  const fr = 'Bonjour'
  it('non_traduit sans rien', () => {
    expect(fieldStatus({}, 'title', 'en', fr)).toBe('non_traduit')
  })
  it('non_traduit si le français est vide', () => {
    expect(fieldStatus({}, 'title', 'en', '')).toBe('non_traduit')
  })
  it('corrige si un texte existe sans méta', () => {
    expect(fieldStatus({ en: { title: 'X' } }, 'title', 'en', fr)).toBe('corrige')
  })
  it('relu → relu si le français n’a pas bougé, a_mettre_a_jour sinon', () => {
    const t = markRelu({}, 'title', 'en', 'Hand-made', 'Bonjour')
    expect(fieldStatus(t, 'title', 'en', 'Bonjour')).toBe('relu')
    expect(fieldStatus(t, 'title', 'en', 'Autre')).toBe('a_mettre_a_jour')
  })
})

describe('translateFields (idempotence)', () => {
  it('traduit les champs manquants seulement', async () => {
    const r = await translateFields(
      { title: 'Bonjour', description: '' },
      {},
      ['en'],
      fakeTranslator('EN:')
    )
    expect(r.translated).toBe(1)
    expect(r.translations.en?.title).toBe('EN:Bonjour')
  })

  it('est idempotent : un second appel ne retraduit rien', async () => {
    const first = await translateFields({ title: 'Bonjour' }, {}, ['en'], fakeTranslator('EN:'))
    let calls = 0
    const second = await translateFields({ title: 'Bonjour' }, first.translations, ['en'], async (t) => {
      calls++
      return fakeTranslator('XX:')(t)
    })
    expect(calls).toBe(0)
    expect(second.translated).toBe(0)
    expect(second.skipped).toBeGreaterThan(0)
  })

  it('ne réécrit pas une correction manuelle', async () => {
    let t = setFieldTranslation({}, 'title', 'en', 'Auto', 'Bonjour')
    t = markCorrected(t, 'title', 'en', 'My version', 'Bonjour')
    const r = await translateFields({ title: 'Autre' }, t, ['en'], fakeTranslator('EN:'))
    expect(r.translations.en?.title).toBe('My version')
    expect(r.stale).toBe(1)
  })

  it('force retraduit même une correction', async () => {
    const t = markCorrected({}, 'title', 'en', 'My version', 'Bonjour')
    const r = await translateFields({ title: 'Bonjour' }, t, ['en'], fakeTranslator('EN:'), { force: true })
    expect(r.translations.en?.title).toBe('EN:Bonjour')
  })

  it('ne touche jamais un texte « relu », même avec force', async () => {
    const t = markRelu({}, 'title', 'en', 'Hand-made', 'Bonjour')
    const r = await translateFields({ title: 'Bonjour' }, t, ['en'], fakeTranslator('EN:'), {
      force: true,
    })
    expect(r.translations.en?.title).toBe('Hand-made')
    expect(r.translated).toBe(0)
  })

  it('compte une erreur et garde le reste si le fournisseur échoue', async () => {
    const r = await translateFields({ title: 'Bonjour' }, {}, ['en'], async () => {
      throw new Error('provider down')
    })
    expect(r.errors).toBe(1)
    expect(r.translations.en?.title).toBeUndefined()
    // L'échec est marqué : il sera retenté à la prochaine passe.
    expect(r.translations._meta?.title?.en?.statut).toBe('echec')
  })

  it('marque Échec chaque champ sans traduction renvoyée', async () => {
    const r = await translateFields({ title: 'Bonjour', description: 'Une phrase' }, {}, ['en'], async () => ({
      ok: { title: 'Hello' },
      failed: { description: 'La réponse du traducteur a été coupée' },
    }))
    expect(r.translated).toBe(1)
    expect(r.errors).toBe(1)
    expect(r.translations.en?.description).toBeUndefined()
    expect(r.translations._meta?.description?.en?.statut).toBe('echec')
    expect(r.translations._meta?.description?.en?.erreur).toBe('La réponse du traducteur a été coupée')
  })

  it('retente un champ en échec à la passe suivante', async () => {
    const first = await translateFields({ title: 'Bonjour' }, {}, ['en'], async () => ({
      ok: {},
      failed: { title: 'Trop de demandes' },
    }))
    expect(fieldStatus(first.translations, 'title', 'en', 'Bonjour')).toBe('echec')
    const second = await translateFields(
      { title: 'Bonjour' },
      first.translations,
      ['en'],
      fakeTranslator('EN:')
    )
    expect(second.translations.en?.title).toBe('EN:Bonjour')
    expect(second.errors).toBe(0)
  })
})

describe('settingsFrenchFields', () => {
  it('expose bio/bioShort/processText et les légendes photo', () => {
    const f = settingsFrenchFields({
      artistName: 'X',
      bio: 'Bio',
      bioShort: 'Accroche',
      email: '',
      processText: 'Ma démarche',
      photos: [{ url: 'u', publicId: 'galerie-mc/p1', caption: 'Dans l’atelier' }],
    })
    expect(f.bio).toBe('Bio')
    expect(f.bioShort).toBe('Accroche')
    expect(f.processText).toBe('Ma démarche')
    expect(f[photoCaptionKey('galerie-mc/p1')]).toBe('Dans l’atelier')
  })
})
