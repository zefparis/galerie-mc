// Captures d'états hover pour le rapport avant/après.
// Usage: node /tmp/hover-shots.mjs <tag>  (ex: avant | apres)
import { chromium } from 'playwright'
const BASE = process.env.HOVER_BASE || 'http://localhost:3656'
const TAG = process.argv[2] || 'shot'
const targets = [
  { page: '/galerie', sel: 'nav a[href="/expositions"]', name: 'navbar-lien' },
  { page: '/galerie', sel: 'main a.group', name: 'carte-galerie' },
  { page: '/galerie', sel: 'footer a[href="/expositions"]', name: 'footer-lien' },
  { page: '/expositions', sel: 'main a.group', name: 'carte-expo' },
  { page: '/', sel: 'button[aria-label*="suivante"], button[aria-label*="next" i], button[aria-label*="Siguiente" i], button[aria-label*="nächste" i]', name: 'hero-fleche' },
]
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' })
for (const dark of [false, true]) {
  const th = dark ? 'dark' : 'light'
  for (const [w, h, vp] of [[1280, 900, 'd'], [390, 844, 'm']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 2 })
    const pg = await ctx.newPage()
    for (const t of targets) {
      try {
        await pg.goto(BASE + t.page, { waitUntil: 'load' })
        await pg.evaluate((d) => { localStorage.setItem('mc-theme', d ? 'dark' : 'light'); document.documentElement.classList.toggle('dark', d) }, dark)
        await pg.waitForTimeout(500)
        const el = pg.locator(t.sel).first()
        if (!(await el.count())) { console.log(`  · ${t.name} absent sur ${t.page}`); continue }
        await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
        // recentre dans le viewport pour une capture lisible
        await el.evaluate((n) => n.scrollIntoView({ block: 'center' })).catch(() => {})
        await pg.waitForTimeout(300)
        await el.hover({ timeout: 2000 })
        await pg.waitForTimeout(450)
        const f = `/tmp/hover-${TAG}-${vp}-${th}-${t.name}.png`
        await pg.screenshot({ path: f })
        console.log(`  ✓ ${f}`)
      } catch (e) { console.log(`  ✗ ${t.name}@${t.page} ${vp} ${th}: ${e.message.split('\n')[0]}`) }
    }
    await ctx.close()
  }
}
await browser.close()
