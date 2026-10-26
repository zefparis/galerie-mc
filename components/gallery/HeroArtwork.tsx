'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTechniqueLabel } from '@/lib/i18n'
import { Painting } from '@/lib/types'
import { resolveFrame, type FrameId } from '@/lib/frames'
import Lightbox from './Lightbox'
import WallArtwork from './WallArtwork'

const INTERVAL_MS = 6000
const SWIPE_MIN_PX = 45

interface Props {
  paintings: Painting[]
  artistName: string
  /** Cadre général des réglages — le cadre propre à la toile prime. */
  heroFrame?: FrameId
}

// Carrousel du tableau en vedette : chaque œuvre est « accrochée au mur »
// dans une zone de hauteur fixe, alignée par le bas (ligne de base
// commune), cartel centré dessous, points de navigation centrés sous le
// cartel. Fondu enchaîné 350 ms, pause au survol/focus, balayage tactile,
// flèches du clavier, aria-live, clic/Entrée → lightbox existante.
export default function HeroArtwork({ paintings, artistName, heroFrame }: Props) {
  const t = useTranslations('hero')
  const techLabel = useTechniqueLabel()
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [reduced, setReduced] = useState(false)
  const hovered = useRef(false)
  const focused = useRef(false)
  const manualPause = useRef(false)
  const paused = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchX = useRef<number | null>(null)

  const len = paintings.length
  const current = paintings[active]

  const syncPause = () => {
    paused.current = hovered.current || focused.current || manualPause.current
  }
  const pauseBriefly = (ms = 4000) => {
    manualPause.current = true
    syncPause()
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      manualPause.current = false
      syncPause()
    }, ms)
  }

  const next = () => setActive((a) => (a + 1) % len)
  const prev = () => setActive((a) => (a - 1 + len) % len)

  // Pas de défilement automatique si l'utilisateur préfère réduire les
  // animations (le fondu est déjà neutralisé par la règle CSS globale).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (len < 2 || reduced) return
    const id = setInterval(() => {
      if (!paused.current) setActive((a) => (a + 1) % len)
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [len, reduced])

  if (len === 0) return null

  const altFor = (p: Painting) =>
    t('photoAlt', {
      title: p.title,
      technique: p.technique ? techLabel(p.technique) : '',
      year: p.year,
      artist: artistName,
    })

  return (
    <figure
      onMouseEnter={() => {
        hovered.current = true
        syncPause()
      }}
      onMouseLeave={() => {
        hovered.current = false
        syncPause()
      }}
      onFocusCapture={() => {
        focused.current = true
        syncPause()
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          focused.current = false
          syncPause()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          next()
          pauseBriefly()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          prev()
          pauseBriefly()
        }
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null || len < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) >= SWIPE_MIN_PX) {
          if (dx < 0) next()
          else prev()
          pauseBriefly()
        }
      }}
    >
      {/* Zone de hauteur fixe : l'ancrage ne bouge jamais, quel que soit
          le format du tableau. */}
      <div className="relative h-[calc(60vh+64px)] md:h-[calc(min(68vh,560px)+64px)]">
        {paintings.map((p, i) => {
          // Précharge la toile affichée et ses voisines ; le reste en lazy.
          const near =
            len > 1 &&
            (i === (active + 1) % len || i === (active - 1 + len) % len)
          return (
            <div
              key={p.id}
              aria-hidden={i !== active}
              className={`absolute inset-x-0 bottom-0 flex justify-center transition-opacity duration-[350ms] ease-in-out ${
                i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <WallArtwork
                painting={p}
                alt={altFor(p)}
                sizes="(max-width: 768px) 92vw, 44vw"
                priority={i === 0}
                loading={i === active || near ? 'eager' : 'lazy'}
                cartel
                framed
                frame={resolveFrame(p, { heroFrame })}
                onOpen={i === active ? () => setLightbox(true) : undefined}
                openLabel={t('zoomAria', { title: p.title })}
                focusable={i === active}
                className="w-full"
              />
            </div>
          )
        })}
      </div>

      {len <= 5 && (
        <p className="sr-only" role="status" aria-live="polite">
          {t('artworkN', { n: active + 1, title: current.title })}
        </p>
      )}

      {/* Au-delà de 5 toiles : compteur accessible + flèches 44 px à la
          place des points (cibles tactiles et clavier identiques). La
          région polie unique annonce « Œuvre n : titre » aux lecteurs
          d'écran ; « n / N » reste affiché visuellement. */}
      {len > 5 && (
        <div
          className="mt-[22px] flex items-center justify-center gap-3"
          role="group"
          aria-label={t('chooseArtwork')}
        >
          <button
            type="button"
            onClick={() => {
              prev()
              pauseBriefly()
            }}
            aria-label={t('prevArtwork')}
            className="h-11 w-11 flex items-center justify-center text-2xl leading-none text-[var(--ink)] opacity-70 hover:opacity-100 hover:text-[var(--accent-hover)] transition-colors duration-200"
          >
            ‹
          </button>
          <p
            role="status"
            aria-live="polite"
            className="font-body text-sm text-[var(--muted)] tabular-nums min-w-[3.5rem] text-center"
          >
            <span aria-hidden="true">
              {active + 1} / {len}
            </span>
            <span className="sr-only">
              {t('artworkN', { n: active + 1, title: current.title })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              next()
              pauseBriefly()
            }}
            aria-label={t('nextArtwork')}
            className="h-11 w-11 flex items-center justify-center text-2xl leading-none text-[var(--ink)] opacity-70 hover:opacity-100 hover:text-[var(--accent-hover)] transition-colors duration-200"
          >
            ›
          </button>
        </div>
      )}

      {len > 1 && len <= 5 && (
        <div
          className="mt-[22px] flex items-center justify-center gap-1"
          role="tablist"
          aria-label={t('chooseArtwork')}
        >
          {paintings.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={t('artworkN', { n: i + 1, title: p.title })}
              onClick={() => {
                setActive(i)
                pauseBriefly()
              }}
              className="h-11 w-11 flex items-center justify-center"
            >
              <span
                className={`block rounded-full transition-all duration-200 ${
                  i === active
                    ? 'h-[10px] w-[10px] bg-[var(--accent)]'
                    : 'h-2 w-2 bg-[var(--ink)] opacity-60 hover:opacity-80'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          src={current.imageUrl}
          alt={altFor(current)}
          onClose={() => setLightbox(false)}
          onPrev={len > 1 ? prev : undefined}
          onNext={len > 1 ? next : undefined}
        />
      )}
    </figure>
  )
}
