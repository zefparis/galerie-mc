'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useLocale } from 'next-intl'
import type { Painting, PaintingShowcase } from '@/lib/types'
import { blurDataUrl, cloudinaryUrl } from '@/lib/images'
import { useTechniqueLabel, type Locale } from '@/lib/i18n'
import { computeShowcase, effectiveShowcase, resolveShowcaseFrame } from '@/lib/showcase'
import FramedArt from '@/components/frames/FramedArt'
import type { FrameId } from '@/lib/frames'
import WallArtwork, { Cartel } from './WallArtwork'

interface Props {
  painting: Painting
  /** Composition nettoyée (effectiveShowcase non-null). */
  showcase: PaintingShowcase
  alt: string
  sizes: string
  priority?: boolean
  /** Rend la composition cliquable (lightbox existante). */
  onOpen?: () => void
  openLabel?: string
  /** false pour retirer la slide inactive du cycle de tabulation. */
  focusable?: boolean
  /** Affiche le cartel centré sous la composition. */
  cartel?: boolean
  frame: FrameId
  loading?: 'eager' | 'lazy'
  unoptimized?: boolean
  titlePlaceholder?: boolean
  className?: string
  /** Surcharges pour l'aperçu admin et les tests (mesure contournée). */
  containerWidth?: number
  maxHeight?: number
  mobile?: boolean
}

// Hauteur de la zone d'art du carrousel — mêmes bornes que --art-mh
// dans globals.css (60 vh mobile, min(68 vh, 560 px) au-delà de 768 px).
function heroArtMaxHeight(mobile: boolean, vh: number): number {
  return mobile ? vh * 0.6 : Math.min(vh * 0.68, 560)
}

// Œuvre composée dans la vitrine : chaque partie (photo de l'œuvre) dans
// son propre cadre — même cadre pour toutes, même hauteur en 'row',
// même largeur en 'column', ratio réel conservé, jamais rognées. Une
// photo morte est ignorée au rendu ; s'il n'en reste pas assez, repli
// sur la photo principale (rendu identique au comportement d'origine).
export default function ShowcaseArtwork({
  painting: p,
  showcase,
  alt,
  sizes,
  priority,
  onOpen,
  openLabel,
  focusable = true,
  cartel = false,
  frame,
  loading,
  unoptimized,
  titlePlaceholder,
  className,
  containerWidth,
  maxHeight,
  mobile,
}: Props) {
  const techLabel = useTechniqueLabel()
  const locale = useLocale() as Locale
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [measuredW, setMeasuredW] = useState(0)
  const [env, setEnv] = useState({ mobile: false, vh: 0 })
  // Dimensions mesurées à la volée quand elles manquent en base,
  // et photos mortes (supprimées du cloud après coup).
  const [measured, setMeasured] = useState<Record<number, [number, number]>>({})
  const [dead, setDead] = useState<Record<string, true>>({})

  const availW = containerWidth ?? measuredW
  const isMobile = mobile ?? env.mobile
  const availH = maxHeight ?? heroArtMaxHeight(env.mobile, env.vh)

  useEffect(() => {
    if (mobile != null && maxHeight != null) return
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setEnv({ mobile: !mq.matches, vh: window.innerHeight })
    update()
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [mobile, maxHeight])

  useEffect(() => {
    if (containerWidth != null || !rootRef.current) return
    const el = rootRef.current
    const ro = new ResizeObserver(() => setMeasuredW(el.clientWidth))
    ro.observe(el)
    setMeasuredW(el.clientWidth)
    return () => ro.disconnect()
  }, [containerWidth])

  // Les photos de la composition moins celles mortes ; en-deçà du
  // minimum du layout, repli sur la photo principale via WallArtwork.
  const live = {
    ...showcase,
    photos: showcase.photos.filter((ph) => !dead[ph.publicId || ph.url]),
  }
  const effective = effectiveShowcase(live)

  if (!effective) {
    return (
      <WallArtwork
        painting={p}
        alt={alt}
        sizes={sizes}
        priority={priority}
        onOpen={onOpen}
        openLabel={openLabel}
        focusable={focusable}
        cartel={cartel}
        framed
        frame={frame}
        loading={loading}
        unoptimized={unoptimized}
        titlePlaceholder={titlePlaceholder}
        className={className}
      />
    )
  }

  // Cadre des toiles : celui choisi pour la composition, sinon le cadre
  // de l'œuvre (déjà résolu et passé en prop par l'appelant).
  const compFrame = resolveShowcaseFrame(effective, frame)
  const photos = effective.photos
  const ratios = photos.map((ph, i) => {
    const dims = measured[i] || (ph.width && ph.height ? [ph.width, ph.height] : null)
    return dims ? dims[0] / dims[1] : 4 / 5
  })
  const dimsOf = (i: number): [number, number] => {
    const ph = photos[i]
    const dims = measured[i] || (ph.width && ph.height ? [ph.width, ph.height] : null)
    return (dims as [number, number]) || [4, 5]
  }

  const plan =
    availW > 0 && availH > 0
      ? computeShowcase({
          layout: effective.layout,
          ratios,
          availW,
          availH,
          gap: effective.gap,
          frame: compFrame,
          mobile: isMobile,
        })
      : null

  const markDead = (i: number) => {
    const key = photos[i].publicId || photos[i].url
    setDead((d) => (d[key] ? d : { ...d, [key]: true }))
  }
  const onLoad = (i: number) => (e: SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget
    if (im.naturalWidth > 0 && !(photos[i].width && photos[i].height)) {
      setMeasured((m) => (m[i] ? m : { ...m, [i]: [im.naturalWidth, im.naturalHeight] }))
    }
  }

  const part = (i: number) => {
    const [w, h] = dimsOf(i)
    const placement = plan!.parts[i]
    return (
      <FramedArt
        key={photos[i].publicId || photos[i].url || i}
        frame={compFrame}
        w={w}
        h={h}
        artMh={`${placement.artMh}px`}
        widthPx={plan!.orientation === 'column' ? placement.width : undefined}
      >
        <Image
          src={cloudinaryUrl(photos[i].url, 'f_auto,q_auto')}
          alt={i === 0 ? alt : ''}
          fill
          sizes={`${Math.max(1, Math.round(placement.width))}px`}
          priority={priority}
          unoptimized={unoptimized}
          placeholder="blur"
          blurDataURL={blurDataUrl(photos[i].url)}
          loading={priority ? undefined : loading}
          className="wall-art-img"
          onLoad={onLoad(i)}
          onError={() => markDead(i)}
        />
      </FramedArt>
    )
  }

  const composition = plan ? (
    plan.orientation === 'row' ? (
      <div
        className="flex items-end justify-center w-full"
        style={{ gap: `${plan.gapPx}px` }}
      >
        {photos.map((_, i) => part(i))}
      </div>
    ) : (
      <div
        className="flex flex-col items-center w-full"
        style={{ gap: `${plan.gapPx}px` }}
      >
        {photos.map((_, i) => part(i))}
      </div>
    )
  ) : (
    // En attente de la mesure : l'espace est réservé, la zone du
    // carrousel ne bouge pas.
    <div style={{ height: `${availH}px` }} aria-hidden="true" />
  )

  const artwork = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      tabIndex={focusable ? 0 : -1}
      className="flex w-full justify-center cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
    >
      {composition}
    </button>
  ) : (
    composition
  )

  if (!cartel) return <div ref={rootRef} className={className}>{artwork}</div>

  return (
    <figure ref={rootRef} className={className}>
      {artwork}
      <Cartel p={p} locale={locale} techLabel={techLabel} titlePlaceholder={titlePlaceholder} />
    </figure>
  )
}
