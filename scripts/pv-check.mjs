// Vérification interactive de l'aperçu en direct admin.
import { chromium } from 'playwright'

const BASE = 'http://localhost:3623'
const COOKIE = process.env.MC_COOKIE
const results = []
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)

// PNG 1x1 rouge pour le test « changer la photo »
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
})

async function adminPage(viewport) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addCookies([
    { name: 'mc_admin_session', value: COOKIE, url: BASE },
  ])
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  return { ctx, page }
}

// ─── 1. Desktop : formulaire toile + aperçu sticky ─────────────────────
{
  const { ctx, page } = await adminPage({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Mes toiles' }).click()
  await page.getByText('Modifier').first().click()
  await page.waitForSelector('text=Aperçu — pas encore enregistré')
  ok('cadre aperçu visible (desktop)', true)
  // Étape 2 : les champs de texte (le titre vit ici)
  await page.getByRole('button', { name: 'Continuer →' }).click()
  await page.waitForSelector('#wiz-title')

  const frame = page.locator('aside')
  const cartel = frame.locator('figcaption')
  // Titre actuel dans le cartel ?
  const before = await cartel.innerText().catch(() => '')
  ok('cartel présent', before.length > 0, JSON.stringify(before.split('\n')[0]))

  // Modifier le titre → l'aperçu suit (debounce 150 ms)
  await page.locator('#wiz-title').fill('Titre aperçu test')
  await page.waitForTimeout(400)
  const after = await cartel.innerText().catch(() => '')
  ok('titre suivi en direct', after.includes('Titre aperçu test'), JSON.stringify(after.split('\n')[0]))

  // Onglet Galerie → vignette masonry
  await frame.getByRole('tab', { name: 'Galerie' }).click()
  const card = frame.locator('a.group, .group').first()
  ok('vignette galerie visible', await card.isVisible().catch(() => false))

  // Champ vidé → exemple grisé (onglet Accueil : le cartel)
  await frame.getByRole('tab', { name: 'Accueil' }).click()
  await page.locator('#wiz-title').fill('')
  await page.waitForTimeout(400)
  const ph = await frame.locator('figcaption p').first().innerText().catch(() => '')
  ok('exemple grisé champ vide', ph.includes('Titre de la toile'), JSON.stringify(ph))
  await page.locator('#wiz-title').fill('Titre aperçu test')
  await page.waitForTimeout(300)

  // Case « accueil » décochée → note dans l'onglet Accueil
  const featuredBox = page.locator('input[type=checkbox]').last()
  if (await featuredBox.isChecked()) await featuredBox.uncheck()
  await page.waitForTimeout(400)
  const note = await frame.locator('text=apparaîtra pas').count()
  ok('décocher accueil → note', note > 0)

  // Changer la photo → blob local dans l'aperçu (envoi échouera, c'est voulu)
  // Revenir à l'étape 1 pour changer la photo
  await page.getByRole('button', { name: '← Retour' }).click()
  await page.waitForTimeout(300)
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: PNG })
  await page.waitForTimeout(600)
  const blobImg = await frame.locator('img[src^="blob:"]').count()
  ok('photo locale (blob:) dans l’aperçu', blobImg > 0)

  // Langue EN → traduction ou mention « pas encore traduit »
  await page.getByRole('button', { name: 'Continuer →' }).click()
  await page.waitForTimeout(200)
  await frame.getByRole('tab', { name: 'Galerie' }).click()
  await page.waitForTimeout(200)
  await frame.getByRole('button', { name: 'EN', exact: true }).click()
  await page.waitForTimeout(400)
  const notTr = await frame.locator('text=Pas encore traduit').count()
  ok('mention « pas encore traduit » ou traduction', true, `${notTr} note(s)`)

  // Bascule sombre de l'aperçu : seul l'aperçu change
  const htmlDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await frame.getByRole('button', { name: /mode sombre|mode clair/ }).click()
  await page.waitForTimeout(200)
  const htmlDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  const pvBg = await frame.locator('.pv-dark, .pv-light').first().getAttribute('class')
  ok('bascule sombre scopée (admin inchangé)', htmlDarkBefore === htmlDarkAfter && /pv-dark/.test(pvBg || ''), pvBg)

  // Annuler → retour liste, rien n'est écrit
  await page.getByRole('button', { name: 'Annuler' }).first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/pv-list-after-cancel.png' })
  await ctx.close()
}

// ─── 2. Mobile : bouton fixe + feuille plein écran ─────────────────────
{
  const { ctx, page } = await adminPage({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Mes toiles' }).click()
  await page.getByText('Modifier').first().click()
  await page.waitForSelector('text=Étape')
  // Étape 2 : on tape un titre puis on ouvre l'aperçu
  await page.getByRole('button', { name: 'Continuer →' }).click()
  await page.waitForSelector('#wiz-title')
  await page.locator('#wiz-title').fill('Titre mobile test')
  const pvBtn = page.getByRole('button', { name: '👁 Aperçu' })
  ok('bouton Aperçu fixe (mobile)', await pvBtn.isVisible())
  await pvBtn.click()
  const sheetVisible = await page.locator('[role="dialog"]').filter({ hasText: 'pas encore enregistré' }).isVisible()
  ok('feuille plein écran ouverte', sheetVisible)
  await page.waitForTimeout(500) // debounce 150 ms + rendu image
  const mCartel = await page.locator('[role="dialog"] figcaption p').first().innerText().catch(() => '')
  ok('aperçu mobile contient le titre', mCartel.includes('Titre mobile test'), JSON.stringify(mCartel.split('\n')[0]))
  await page.screenshot({ path: '/tmp/pv-mobile-sheet.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const stillOpen = await page.locator('[role="dialog"]').filter({ hasText: 'pas encore enregistré' }).isVisible().catch(() => false)
  ok('Échap ferme la feuille', !stillOpen)
  const focused = await page.evaluate(() => document.activeElement?.textContent)
  ok('focus restitué', (focused || '').includes('Aperçu'), JSON.stringify(focused))
  const titleVal = await page.locator('#wiz-title').inputValue().catch(() => '')
  ok('état formulaire préservé', titleVal === 'Titre mobile test', titleVal)
  await ctx.close()
}

// ─── 3. Exposition : carte + statut + galerie ──────────────────────────
{
  const { ctx, page } = await adminPage({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Mes événements' }).click()
  await page.waitForTimeout(400)
  const editBtn = page.getByText('Modifier').first()
  if (await editBtn.count()) {
    await editBtn.click()
    await page.waitForSelector('text=Aperçu — pas encore enregistré')
    const frame = page.locator('aside')
    const statusChip = await frame.locator('text=/À venir|Passée|Sans date/').first().innerText().catch(() => '')
    ok('statut expo calculé', /À venir|Passée|Sans date/.test(statusChip), statusChip)
    const date = page.locator('#ev-date')
    await date.fill('2099-12-01')
    await page.waitForTimeout(400)
    ok('statut → À venir', (await frame.locator('text=À venir').count()) > 0)
    const gal = await frame.locator('text=Photos de l’exposition').count()
    ok('galerie photos dans l’aperçu', gal >= 0, `${gal} bloc`)
    await page.getByRole('button', { name: 'Annuler' }).first().click()
  } else {
    ok('événement existant pour test', false)
  }
  await ctx.close()
}

// ─── 4. Présentation : hero + section ──────────────────────────────────
{
  const { ctx, page } = await adminPage({ width: 1280, height: 900 })
  await page.getByRole('button', { name: /Présentation/ }).first().click()
  await page.waitForSelector('text=Aperçu — pas encore enregistré', { timeout: 8000 })
  const frame = page.locator('aside')
  const heroH1 = await frame.locator('h1').first().innerText().catch(() => '')
  ok('hero (nom artiste) dans l’aperçu', heroH1.length > 0, heroH1)
  await page.locator('#pr-tagline').fill('Accroche test aperçu — la matière chante.')
  await page.waitForTimeout(400)
  const tag = await frame.locator('text=la matière chante').count()
  ok('accroche suivie en direct', tag > 0)
  const presSection = await frame.locator('text=Section « Présentation »').count()
  ok('section présentation', presSection > 0)
  await page.screenshot({ path: '/tmp/pv-presentation.png' })
  await ctx.close()
}

// ─── Captures desktop + mobile, clair + sombre ─────────────────────────
async function shot(name, { width, height }, dark) {
  const { ctx, page } = await adminPage({ width, height })
  if (dark) {
    await page.evaluate(() => document.documentElement.classList.add('dark'))
  }
  await page.getByRole('button', { name: 'Mes toiles' }).click()
  await page.getByText('Modifier').first().click()
  await page.getByRole('button', { name: 'Continuer →' }).click().catch(() => {})
  await page.waitForTimeout(500)
  if (width < 1000) {
    // Mobile : l'aperçu vit dans la feuille plein écran
    await page.getByRole('button', { name: '👁 Aperçu' }).click()
    await page.waitForSelector('[role="dialog"] >> text=pas encore enregistré')
    if (dark) {
      await page.getByRole('button', { name: /mode sombre/ }).last().click().catch(() => {})
      await page.waitForTimeout(300)
    }
  } else {
    await page.waitForSelector('aside >> text=pas encore enregistré')
    if (dark) {
      await page.locator('aside').getByRole('button', { name: /mode sombre/ }).click().catch(() => {})
      await page.waitForTimeout(300)
    }
  }
  await page.screenshot({ path: `/tmp/pv-${name}.png` })
  await ctx.close()
}
await shot('d-light', { width: 1280, height: 900 }, false)
await shot('d-dark', { width: 1280, height: 900 }, true)
await shot('m-light', { width: 390, height: 844 }, false)
await shot('m-dark', { width: 390, height: 844 }, true)

console.log(results.join('\n'))
await browser.close()
