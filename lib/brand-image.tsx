import { readFile } from 'fs/promises'
import { join } from 'path'
import { ImageResponse } from 'next/og'

// Rendu des assets de marque (favicon PNG, apple-touch-icon, image OG)
// via Satori : il faut une fonte TTF/OTF/WOFF — Fraunces est chargée
// depuis le disque, aucun appel réseau.
let fontCache: Buffer | null = null
async function fraunces() {
  if (!fontCache)
    fontCache = await readFile(join(process.cwd(), 'app/fonts/fraunces.ttf'))
  return fontCache
}

const NIGHT = '#1A1612'
const COPPER = '#C98A5B'
const PAPER = '#EDE8DF'

/**
 * Favicon / icône : « S » serif cuivre sur carré arrondi sombre.
 * maskable : fond plein bord à bord, « S » réduit dans la zone sûre (~40 %).
 * inverted : variante « Mon atelier » — fond cuivre, « S » sombre.
 */
export async function brandMark(
  px: number,
  opts: { maskable?: boolean; inverted?: boolean } = {}
) {
  const font = await fraunces()
  const radius = opts.maskable ? 0 : Math.round(px * 0.22)
  const bg = opts.inverted ? COPPER : NIGHT
  const fg = opts.inverted ? NIGHT : COPPER
  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          borderRadius: radius,
        }}
      >
        <div
          style={{
            fontFamily: 'Fraunces',
            color: fg,
            fontSize: Math.round(px * (opts.maskable ? 0.4 : 0.62)),
            lineHeight: 1,
            paddingTop: Math.round(px * 0.04),
          }}
        >
          S
        </div>
      </div>
    ),
    {
      width: px,
      height: px,
      fonts: [{ name: 'Fraunces', data: font, style: 'normal', weight: 500 }],
    }
  )
}

/** Image Open Graph 1200×630 : logo centré, tagline en dessous. */
export async function brandOg(tagline: string) {
  const font = await fraunces()
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: NIGHT,
        }}
      >
        <div
          style={{
            fontFamily: 'Fraunces',
            fontSize: 108,
            lineHeight: 1,
            color: PAPER,
            display: 'flex',
          }}
        >
          Scandell<span style={{ color: COPPER }}>’Art</span>
        </div>
        <div
          style={{
            fontFamily: 'Fraunces',
            fontSize: 30,
            color: '#B9B1A2',
            marginTop: 34,
            letterSpacing: 2,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Fraunces', data: font, style: 'normal', weight: 500 }],
    }
  )
}
