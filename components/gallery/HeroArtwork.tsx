'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { blurDataUrl } from '@/lib/images'
import { Painting } from '@/lib/types'

const INTERVAL_MS = 6000

interface Props {
  paintings: Painting[]
}

// Œuvre mise en avant présentée comme une toile encadrée : ratio naturel
// (object-contain, jamais recadrée), fond blanc, ombre douce. Si plusieurs
// œuvres sont mises en avant, fondu enchaîné toutes les 6 s avec points de
// navigation — pause au survol ou au toucher.
export default function HeroArtwork({ paintings }: Props) {
  const [active, setActive] = useState(0)
  const paused = useRef(false)

  useEffect(() => {
    if (paintings.length < 2) return
    const t = setInterval(() => {
      if (!paused.current) {
        setActive((i) => (i + 1) % paintings.length)
      }
    }, INTERVAL_MS)
    return () => clearInterval(t)
  }, [paintings.length])

  const current = paintings[active]

  return (
    <figure
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
      onTouchStart={() => { paused.current = true }}
      onTouchEnd={() => {
        // reprend quelques secondes après le toucher
        setTimeout(() => { paused.current = false }, 4000)
      }}
    >
      {/* Cadre : mat blanc + filet discret + ombre douce */}
      <div className="bg-white p-3 sm:p-4 border border-[var(--line)] shadow-[0_18px_50px_-18px_rgba(29,26,22,0.28)]">
        <div className="relative h-[46svh] sm:h-[52svh] lg:h-[58vh]">
          {paintings.map((p, i) => (
            <div
              key={p.id}
              aria-hidden={i !== active}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === active ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={p.imageUrl}
                alt={i === active ? p.title : ''}
                fill
                priority={i === 0}
                sizes="(max-width: 768px) 92vw, 44vw"
                placeholder="blur"
                blurDataURL={blurDataUrl(p.imageUrl)}
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Légende — texte en dehors de l'image, lisible */}
      <figcaption className="mt-4 flex items-start justify-between gap-4">
        <p className="font-body text-sm md:text-base text-[var(--ink-soft)]">
          « {current.title} » — {current.technique}, {current.year}
        </p>
        {paintings.length > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0" role="tablist" aria-label="Choisir l'œuvre affichée">
            {paintings.map((p, i) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={i === active}
                aria-label={`Œuvre ${i + 1} : ${p.title}`}
                onClick={() => setActive(i)}
                className="p-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <span
                  className={`block w-2 h-2 rounded-full transition-colors duration-300 ${
                    i === active ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  )
}
