import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import FooterCredit from '../components/ui/FooterCredit'

const MESSAGES = ['fr', 'en', 'es', 'de'].map((loc) =>
  JSON.parse(readFileSync(join(process.cwd(), 'messages', `${loc}.json`), 'utf8'))
)

const html = renderToStaticMarkup(
  createElement(FooterCredit, {
    label: 'Site réalisé par IA Solution',
    ariaLabel: 'IA Solution, développeur du site (nouvel onglet)',
  })
)

describe('mention du développeur (pied de page)', () => {
  it('lien vers ia-solution.fr en nouvel onglet, rel noopener', () => {
    expect(html).toContain(
      'href="https://ia-solution.fr/?utm_source=scandellart&amp;utm_medium=footer"'
    )
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
  })

  it('libellé traduit et aria-label localisé, texte atténué', () => {
    expect(html).toContain('Site réalisé par IA Solution')
    expect(html).toContain('aria-label="IA Solution, développeur du site (nouvel onglet)"')
    expect(html).toContain('text-[var(--muted)]')
  })

  it('les 4 langues ont le libellé et l’aria-label, sans tiret cadratin', () => {
    for (const m of MESSAGES) {
      expect(m.footer.credit).toContain('IA Solution')
      expect(m.footer.creditAria).toContain('IA Solution')
      expect(m.footer.credit).not.toContain('—')
    }
  })
})
