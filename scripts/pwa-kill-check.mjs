#!/usr/bin/env node
// Test du bouton d'arrêt d'urgence du service worker, en deux phases
// contre la MÊME origine (profil navigateur persistant) :
//
//   Phase install — build normal servi sur PWA_BASE :
//     PWA_KILL_PHASE=install PWA_BASE=http://localhost:3501 node scripts/pwa-kill-check.mjs
//     → ouvre /, attend le worker actif et des caches mc-*, ferme le navigateur.
//
//   Phase kill — même origine servant un build fait avec
//     NEXT_PUBLIC_SW_DISABLED=1 :
//     PWA_KILL_PHASE=kill PWA_BASE=http://localhost:3501 node scripts/pwa-kill-check.mjs
//     → le navigateur retrouve sw.js = worker-suicide : les caches mc-*
//       sont vidés et l'enregistrement disparaît.
//
// Sur Vercel : activer = variable d'env + redeploy (le navigateur prend le
// nouveau sw.js au prochain chargement).

import { existsSync, rmSync } from 'node:fs'

const BASE = process.env.PWA_BASE || 'http://localhost:3501'
const PHASE = process.env.PWA_KILL_PHASE || 'install'
const PROFILE = '/tmp/pwa-kill-profile'

const { chromium } = await import('playwright')
const launch = () =>
  chromium.launchPersistentContext(PROFILE, {
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    serviceWorkers: 'allow',
    headless: true,
  })

const ok = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => {
  console.error(`  ✗ ${m}`)
  process.exitCode = 1
}

if (PHASE === 'install') {
  if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true })
  const ctx = await launch()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForTimeout(1500)
  const state = await page.evaluate(async () => ({
    regs: (await navigator.serviceWorker.getRegistrations()).length,
    caches: (await caches.keys()).filter((n) => n.startsWith('mc-')),
  }))
  state.regs === 1 ? ok(`worker installé`) : fail(`regs = ${state.regs}`)
  state.caches.length >= 1
    ? ok(`caches présents : ${state.caches.join(', ')}`)
    : fail('aucun cache mc-* après installation')
  await ctx.close()
  console.log('Phase install terminée — passez au build NEXT_PUBLIC_SW_DISABLED=1 sur la même origine, puis phase kill.')
} else {
  const ctx = await launch()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  // Le worker-suicide s'installe à la mise à jour puis se désinscrit.
  let gone = false
  for (let i = 0; i < 30 && !gone; i++) {
    await page.waitForTimeout(500)
    gone = await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length === 0
    )
    if (!gone && i % 6 === 5) await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
  }
  gone ? ok('worker désinscrit après activation du mode arrêt') : fail('worker encore enregistré')
  const left = await page.evaluate(() =>
    caches.keys().then((ns) => ns.filter((n) => n.startsWith('mc-')))
  )
  left.length === 0 ? ok('caches mc-* vidés') : fail(`caches restants : ${left.join(', ')}`)
  await ctx.close()
  if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true })
  if (process.exitCode) process.exit(process.exitCode)
  console.log('pwa-kill OK : arrêt d’urgence fonctionnel.')
}
