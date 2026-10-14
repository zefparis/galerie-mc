#!/usr/bin/env node
// Mesure le pic local de la texture « lin » utilisée par contrast:check.
// Rejoue les tuiles SVG de globals.css en navigateur et calcule, pour
// chaque thème, la pire moyenne d'alpha composite sur des fenêtres de
// 4 à 32 px (8 px ≈ taille d'un glyphe). Si les paramètres des tuiles ou
// --texture-opacity changent dans globals.css, les mettre à jour ici et
// ajuster TEX_PEAK_PER_OPACITY dans scripts/contrast-check.mjs.
// Usage : node scripts/texture-peak.mjs
import { chromium } from 'playwright'
function tile(S, fx, fy, seed, R, G, B, K, OFF) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}'><filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 ${R} 0 0 0 0 ${G} 0 0 0 0 ${B} ${K} 0 0 0 ${OFF}'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`
  return 'data:image/svg+xml,' + svg.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/ /g, '%20')
}
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const page = await browser.newPage()
for (const [theme, RGB, K12, OFF12, P] of [['clair', [0.235,0.176,0.118], 1, -0.22, 0.10], ['sombre', [0.055,0.043,0.032], 0.9, -0.2, 0.3]]) {
  const uris = [tile(300,'0.9','0.025',2,...RGB,K12,OFF12), tile(300,'0.025','0.9',9,...RGB,K12,OFF12), tile(900,'0.01','0.01',3,...RGB,0.45,-0.06)]
  const out = await page.evaluate(async ({ uris, P }) => {
    const S = 900, layers = []
    for (const uri of uris) {
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = uri })
      const t = img.width
      const tc = document.createElement('canvas'); tc.width = tc.height = t
      tc.getContext('2d').drawImage(img, 0, 0)
      const c = document.createElement('canvas'); c.width = c.height = S
      const ctx = c.getContext('2d')
      ctx.fillStyle = ctx.createPattern(tc, 'repeat'); ctx.fillRect(0, 0, S, S)
      const d = ctx.getImageData(0, 0, S, S).data
      const a = new Float32Array(S * S)
      for (let i = 0; i < S * S; i++) a[i] = d[i * 4 + 3] / 255
      layers.push(a)
    }
    const win = (arr, W) => {
      let m = 0
      for (let y = 0; y <= S - W; y += 2) for (let x = 0; x <= S - W; x += 2) {
        let s = 0
        for (let dy = 0; dy < W; dy++) for (let dx = 0; dx < W; dx++) s += arr[(y + dy) * S + x + dx]
        if (s / (W * W) > m) m = s / (W * W)
      }
      return m
    }
    const comp = new Float32Array(S * S)
    for (let i = 0; i < S * S; i++) comp[i] = (1 - (1 - layers[0][i]) * (1 - layers[1][i]) * (1 - layers[2][i])) * P
    const res = { win4: win(comp, 4), win8: win(comp, 8), win16: win(comp, 16), win32: win(comp, 32) }
    for (let l = 0; l < 3; l++) res[`L${l + 1}_win8`] = win(layers[l], 8) * P
    return res
  }, { uris, P })
  console.log(theme, JSON.stringify(out, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v))
}
await browser.close()
