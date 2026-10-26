'use client'

import Image from 'next/image'
import { useState, type SyntheticEvent } from 'react'
import { useLocale } from 'next-intl'
import { Painting } from '@/lib/types'
import { blurDataUrl, cloudinaryUrl } from '@/lib/images'
import { formatDimensions, useTechniqueLabel, type Locale } from '@/lib/i18n'
import FramedArt from '@/components/frames/FramedArt'
import type { FrameId } from '@/lib/frames'

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
  /** Entoure la toile d'un cadre (hero de l'accueil uniquement). */
  framed?: boolean
  /** Cadre appliqué quand framed — resolveFrame côté appelant,
   *  'gold-classic' par défaut. */
  frame?: FrameId
  /** Stratégie de chargement de l'image (carrousel : voisines en eager,
   *  les autres en lazy). */
  loading?: 'eager' | 'lazy'
  /** next/image sans optimisation (aperçu admin sur fichiers locaux blob:). */
  unoptimized?: boolean
  /** Le titre affiché est un exemple grisé (champ vide dans le formulaire). */
  titlePlaceholder?: boolean
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
  framed = false,
  frame = 'gold-classic',
  loading,
  unoptimized,
  titlePlaceholder,
  className,
}: Props) {
  const techLabel = useTechniqueLabel()
  const locale = useLocale() as Locale
  // Ratio connu en base → espace réservé exact ; sinon mesuré au chargement
  // puis figé (repli pour les fiches sans dimensions d'image).
  const [size, setSize] = useState<[number, number] | null>(
    p.imageWidth && p.imageHeight ? [p.imageWidth, p.imageHeight] : null
  )

  // Cadre : la boîte extérieure (.gf / .fx) emporte l'ombre portée et
  // l'épaisseur du cadre ; la toile interne garde le ratio. Sans
  // dimensions en base : repli 4/5, corrigé à la mesure de l'image.
  if (framed) {
    const [w, h] = size ?? [4, 5]
    const measure = size
      ? undefined
      : (e: SyntheticEvent<HTMLImageElement>) => {
          const im = e.currentTarget
          if (im.naturalWidth > 0) setSize([im.naturalWidth, im.naturalHeight])
        }
    const framedImg = (
      <FramedArt frame={frame} w={w} h={h}>
        <Image
          src={cloudinaryUrl(p.imageUrl, 'f_auto,q_auto')}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={unoptimized}
          placeholder="blur"
          blurDataURL={blurDataUrl(p.imageUrl)}
          onLoad={measure}
          loading={priority ? undefined : loading}
          className="wall-art-img"
        />
      </FramedArt>
    )
    const framedArtwork = onOpen ? (
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        tabIndex={focusable ? 0 : -1}
        className="flex w-full justify-center cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      >
        {framedImg}
      </button>
    ) : (
      framedImg
    )
    if (!cartel) return <div className={className}>{framedArtwork}</div>
    return (
      <figure className={className}>
        {framedArtwork}
        <Cartel
          p={p}
          locale={locale}
          techLabel={techLabel}
          titlePlaceholder={titlePlaceholder}
        />
      </figure>
    )
  }

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
        unoptimized={unoptimized}
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
      unoptimized={unoptimized}
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

  return (
    <figure className={className}>
      {artwork}
      <Cartel
        p={p}
        locale={locale}
        techLabel={techLabel}
        titlePlaceholder={titlePlaceholder}
      />
    </figure>
  )
}

// Cartel centré sous le tableau (titre italique + métadonnées), hauteur
// fixe : la ligne de base commune des tableaux ne bouge pas quand son
// contenu change.
function Cartel({
  p,
  locale,
  techLabel,
  titlePlaceholder,
}: {
  p: Painting
  locale: Locale
  techLabel: ReturnType<typeof useTechniqueLabel>
  titlePlaceholder?: boolean
}) {
  const technique = p.technique ? techLabel(p.technique) : ''
  const year = p.year
    ? new Intl.NumberFormat(locale, { useGrouping: false }).format(p.year)
    : ''
  const dims = p.dimensions ? formatDimensions(p.dimensions) : ''
  const meta = [technique, year, dims].filter(Boolean).join(' · ')

  return (
    <figcaption className="mt-3 h-[54px] md:h-[58px] text-center">
      <p
        className={`font-display italic text-[15px] md:text-[17px] leading-snug ${
          titlePlaceholder ? 'text-[var(--muted)]' : 'text-[var(--ink)]'
        }`}
      >
        {p.title}
      </p>
      {meta && (
        <p className="mt-1 font-body text-[13px] text-[var(--muted)]">{meta}</p>
      )}
    </figcaption>
  )
}
