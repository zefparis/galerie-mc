'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Painting } from '@/lib/types'
import { blurDataUrl, cloudinaryUrl } from '@/lib/images'
import { useTechniqueLabel, type Locale } from '@/lib/i18n'

interface Props {
  painting: Painting
  alt: string
  sizes: string
  priority?: boolean
  /** Rend l'image cliquable (ouverture de la lightbox existante). */
  onOpen?: () => void
  openLabel?: string
  /** false pour retirer la slide inactive du cycle de tabulation. */
  focusable?: boolean
  /** Affiche le cartel centré sous le tableau (titre italique + métadonnées). */
  cartel?: boolean
  /** 'hero' : hauteur max min(68vh,560px) ; 'detail' : 80vh (fiche œuvre). */
  variant?: 'hero' | 'detail'
  className?: string
}

// Tableau « accroché au mur » : proportions intrinsèques exactes
// (image_width/image_height en base → espace réservé, CLS 0), ombre
// portée 3 couches + liseré 1 px, aucune boîte ni passe-partout.
export default function WallArtwork({
  painting: p,
  alt,
  sizes,
  priority,
  onOpen,
  openLabel,
  focusable = true,
  cartel = false,
  variant = 'hero',
  className,
}: Props) {
  const techLabel = useTechniqueLabel()
  const locale = useLocale() as Locale
  // Ratio connu en base → espace réservé exact ; sinon mesuré au chargement
  // puis figé (repli pour les fiches sans dimensions d'image).
  const [size, setSize] = useState<[number, number] | null>(
    p.imageWidth && p.imageHeight ? [p.imageWidth, p.imageHeight] : null
  )

  const img = size ? (
    // La boîte porte le ratio : largeur = min(colonne, hauteurMax × ratio).
    <span
      className={`wall-art${variant === 'detail' ? ' wall-art--detail' : ''}`}
      style={{
        aspectRatio: `${size[0]} / ${size[1]}`,
        width: `min(100%, calc(var(--art-mh) * ${size[0]} / ${size[1]}))`,
      }}
    >
      <Image
        src={cloudinaryUrl(p.imageUrl, 'f_auto,q_auto')}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={blurDataUrl(p.imageUrl)}
        className="wall-art-img"
      />
    </span>
  ) : (
    <Image
      src={cloudinaryUrl(p.imageUrl, 'f_auto,q_auto')}
      alt={alt}
      width={0}
      height={0}
      onLoadingComplete={(el) => {
        if (el.naturalWidth > 0) setSize([el.naturalWidth, el.naturalHeight])
      }}
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={blurDataUrl(p.imageUrl)}
      className={`wall-art wall-art--raw${variant === 'detail' ? ' wall-art--detail' : ''}`}
    />
  )

  const artwork = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      tabIndex={focusable ? 0 : -1}
      className="flex w-full justify-center cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      {img}
    </button>
  ) : (
    img
  )

  if (!cartel) return <div className={className}>{artwork}</div>

  const technique = p.technique ? techLabel(p.technique) : ''
  const year = p.year
    ? new Intl.NumberFormat(locale, { useGrouping: false }).format(p.year)
    : ''
  const meta = [technique, year, p.dimensions].filter(Boolean).join(' · ')

  return (
    <figure className={className}>
      {artwork}
      {/* Hauteur fixe : la ligne de base commune des tableaux ne bouge
          pas quand le cartel change de contenu. */}
      <figcaption className="mt-3 h-[54px] md:h-[58px] text-center">
        <p className="font-display italic text-[15px] md:text-[17px] leading-snug text-[var(--ink)]">
          {p.title}
        </p>
        {meta && (
          <p className="mt-1 font-body text-[11px] md:text-xs text-[var(--muted)]">
            {meta}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
