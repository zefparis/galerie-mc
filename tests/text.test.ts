import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProcessText from '../components/gallery/ProcessText'
import {
  NARROW_NBSP,
  displayParagraphs,
  frenchTypography,
  toParagraphs,
} from '../lib/text'

const NNBSP = '\u202F'

describe('toParagraphs', () => {
  it('normalise les fins de ligne \\r\\n et \\r', () => {
    expect(toParagraphs('un\r\ndeux\r\ntrois')).toEqual(['un', 'deux', 'trois'])
    expect(toParagraphs('un\rdeux')).toEqual(['un', 'deux'])
  })

  it('ignore les lignes vides multiples', () => {
    expect(toParagraphs('un\n\n\n\ndeux\n\n')).toEqual(['un', 'deux'])
    expect(toParagraphs('\n\nun\n\n')).toEqual(['un'])
  })

  it('rogne chaque ligne et réduit les espaces multiples', () => {
    expect(toParagraphs('  la   couleur \t guide  ')).toEqual(['la couleur guide'])
  })

  it('texte vide ou blanc → []', () => {
    expect(toParagraphs('')).toEqual([])
    expect(toParagraphs('   \n  \n ')).toEqual([])
    expect(toParagraphs(undefined)).toEqual([])
    expect(toParagraphs(null)).toEqual([])
  })
})

describe('frenchTypography', () => {
  it('espace fine insécable avant ; : ! ? »', () => {
    expect(frenchTypography('oui ; non')).toBe(`oui${NNBSP}; non`)
    expect(frenchTypography('il dit : oui')).toBe(`il dit${NNBSP}: oui`)
    expect(frenchTypography('attention !')).toBe(`attention${NNBSP}!`)
    expect(frenchTypography('comment ?')).toBe(`comment${NNBSP}?`)
    expect(frenchTypography('la fin »')).toBe(`la fin${NNBSP}»`)
  })

  it('espace fine insécable après «', () => {
    expect(frenchTypography('« bonjour »')).toBe(`«${NNBSP}bonjour${NNBSP}»`)
  })

  it('remplace une espace déjà insécable, sans doublon', () => {
    expect(frenchTypography('oui\u00A0?')).toBe(`oui${NNBSP}?`)
    expect(frenchTypography(`oui${NNBSP}?`)).toBe(`oui${NNBSP}?`)
    expect(frenchTypography('oui  ?')).toBe(`oui${NNBSP}?`)
  })

  it('espace insécable avant un tiret isolé', () => {
    expect(frenchTypography('la couleur - le geste')).toBe(
      `la couleur${NNBSP}- le geste`
    )
  })

  it('ne touche ni aux mots composés ni à la ponctuation sans espace saisie', () => {
    expect(frenchTypography('Montreuil-aux-Lions')).toBe('Montreuil-aux-Lions')
    expect(frenchTypography('mot? suite')).toBe('mot? suite')
    expect(frenchTypography('12:30')).toBe('12:30')
    expect(frenchTypography('mot -collé')).toBe('mot -collé')
  })
})

describe('displayParagraphs', () => {
  it('un paragraphe par ligne, dans les 4 langues', () => {
    for (const locale of ['fr', 'en', 'es', 'de']) {
      expect(displayParagraphs('premier\n\ndeuxième', locale)).toEqual([
        'premier',
        'deuxième',
      ])
    }
  })

  it('espace fine insécable en fr, jamais en en/es/de', () => {
    const src = 'Pourquoi ? Parce que !'
    expect(displayParagraphs(src, 'fr')).toEqual([
      `Pourquoi${NNBSP}? Parce que${NNBSP}!`,
    ])
    for (const locale of ['en', 'es', 'de']) {
      expect(displayParagraphs(src, locale)).toEqual([src])
    }
  })

  it('ne modifie aucun mot du texte saisi — seuls les blancs changent', () => {
    const src =
      'Je peins   d’abord ; avec les mains.\n\nLa couleur guide — le geste : tout.'
    const strip = (s: string) => s.replace(/\s+/g, '')
    expect(strip(displayParagraphs(src, 'fr').join('\n'))).toBe(strip(src))
  })
})

describe('rendu « Ma démarche picturale » (ProcessText)', () => {
  const render = (text: string, locale = 'fr') =>
    renderToStaticMarkup(createElement(ProcessText, { text, locale }))

  it('un <p> par paragraphe, texte échappé (jamais de HTML injecté)', () => {
    const html = render('Premier paragraphe.\n\nDeuxième.\nTroisième & <fin>.')
    expect(html.match(/<p[\s>]/g)).toHaveLength(3)
    expect(html).toContain('Premier paragraphe.')
    expect(html).toContain('&lt;fin&gt;')
  })

  it('premier paragraphe en italique seulement s’il y en a plusieurs', () => {
    const multi = render('Ouverture.\nCorps du texte.')
    expect(multi).toMatch(/<p[^>]*class="[^"]*italic[^"]*"[^>]*>Ouverture\./)
    const single = render('Un seul paragraphe.')
    expect(single.match(/<p[\s>]/g)).toHaveLength(1)
    expect(single).not.toContain('italic')
  })

  it('espace fine insécable rendue en fr, absente en en', () => {
    expect(render('Pourquoi ?', 'fr')).toContain(`Pourquoi${NNBSP}?`)
    expect(render('Pourquoi ?', 'en')).toContain('Pourquoi ?')
    expect(render('Pourquoi ?', 'en')).not.toContain(NNBSP)
  })

  it('texte vide → rien', () => {
    expect(render('   ')).toBe('')
  })
})
