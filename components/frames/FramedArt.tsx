import type { CSSProperties, ReactNode } from 'react'
import type { FrameId } from '@/lib/frames'

// Maquette partagée des cadres du carrousel : 'gold-classic' garde le
// montage historique (.gf + pièces WebP), les 9 autres sont des cadres
// CSS purs (.fx-*, cf. globals.css). Le parent fournit l'image absolue
// (.wall-art-img) — le cadre ne connaît que le ratio w/h.
export default function FramedArt({
  frame,
  w,
  h,
  artMh,
  children,
}: {
  frame: FrameId
  w: number
  h: number
  /** Référence de hauteur pour l'épaisseur proportionnelle (vignettes). */
  artMh?: string
  children: ReactNode
}) {
  const vars: CSSProperties = artMh
    ? ({ '--art-mh': artMh } as CSSProperties)
    : {}

  if (frame === 'gold-classic') {
    return (
      <span
        className="gf"
        style={{
          ...vars,
          width: `min(100%, calc((var(--art-mh) - var(--gf-py)) * ${w} / ${h} + var(--gf-px)))`,
        }}
      >
        <span className="wall-art gf-art" style={{ aspectRatio: `${w} / ${h}` }}>
          {children}
        </span>
        {/* Pièces du cadre : purement décoratives (maquette cadre-dore). */}
        <i className="gf-i gf-et" aria-hidden="true" />
        <i className="gf-i gf-eb" aria-hidden="true" />
        <i className="gf-i gf-el" aria-hidden="true" />
        <i className="gf-i gf-er" aria-hidden="true" />
        <i className="gf-c gf-ctl" aria-hidden="true" />
        <i className="gf-c gf-ctr" aria-hidden="true" />
        <i className="gf-c gf-cbl" aria-hidden="true" />
        <i className="gf-c gf-cbr" aria-hidden="true" />
      </span>
    )
  }

  return (
    <span
      className={`fx fx-${frame}`}
      style={{
        ...vars,
        width: `min(100%, calc((var(--art-mh) - var(--fx-py)) * ${w} / ${h} + var(--fx-px)))`,
      }}
    >
      <span className="fx-mat">
        <span className="wall-art fx-art" style={{ aspectRatio: `${w} / ${h}` }}>
          {children}
        </span>
      </span>
    </span>
  )
}

// Vignette de choix de cadre (réglages admin, fiche toile) : le cadre
// réel autour de la photo fournie, ou sur fond neutre sans image.
export function FramePreview({
  frame,
  imageUrl,
  alt = '',
  w = 4,
  h = 5,
  height = 132,
}: {
  frame: FrameId
  imageUrl?: string
  alt?: string
  w?: number
  h?: number
  height?: number
}) {
  return (
    <span className="frame-preview-box" style={{ height: `${height}px` }}>
      <FramedArt frame={frame} w={w} h={h} artMh={`${height}px`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette admin (blob: ou Cloudinary)
          <img src={imageUrl} alt={alt} className="wall-art-img" />
        ) : (
          <span className="frame-preview-blank" aria-hidden="true" />
        )}
      </FramedArt>
    </span>
  )
}
