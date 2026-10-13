'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { blurDataUrl } from '@/lib/images'

interface Props {
  src: string
  alt: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

// Lightbox plein écran : double-clic / double-tap = zoom ×2,5 ancré au point
// touché, glisser pour déplacer quand zoomé, swipe latéral pour naviguer.
export default function Lightbox({ src, alt, onClose, onPrev, onNext }: Props) {
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState('50% 50%')
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })
  const touchRef = useRef({ x: 0, y: 0, lastTap: 0 })

  const resetZoom = useCallback(() => {
    setZoomed(false)
    setOffset({ x: 0, y: 0 })
    setOrigin('50% 50%')
  }, [])

  const goPrev = useCallback(() => { resetZoom(); onPrev?.() }, [resetZoom, onPrev])
  const goNext = useCallback(() => { resetZoom(); onNext?.() }, [resetZoom, onNext])

  const zoomAt = useCallback((clientX: number, clientY: number) => {
    if (zoomed) {
      resetZoom()
      return
    }
    const rect = imgRef.current?.getBoundingClientRect()
    if (rect && rect.width && rect.height) {
      const ox = ((clientX - rect.left) / rect.width) * 100
      const oy = ((clientY - rect.top) / rect.height) * 100
      setOrigin(`${Math.min(100, Math.max(0, ox))}% ${Math.min(100, Math.max(0, oy))}%`)
    }
    setZoomed(true)
  }, [zoomed, resetZoom])

  // Clavier : Échap ferme, flèches naviguent
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext])

  // Verrouille le scroll de la page
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Pan quand zoomé (souris + tactile via Pointer Events)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    })
  }
  const onPointerUp = () => { dragRef.current.active = false }

  // Swipe navigation + double-tap zoom (mobile)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current.x = t.clientX
    touchRef.current.y = t.clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (zoomed) return // le pan est géré par les pointer events
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    const now = Date.now()

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      // Tap : double-tap = zoom
      if (now - touchRef.current.lastTap < 320) {
        touchRef.current.lastTap = 0
        zoomAt(t.clientX, t.clientY)
      } else {
        touchRef.current.lastTap = now
      }
      return
    }
    if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6) {
      if (dx > 0) goPrev()
      else goNext()
    }
  }

  const hasNav = !!(onPrev || onNext)

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Visionneuse — ${alt}`}
      onClick={onClose}
    >
      {/* Fermer */}
      <button
        onClick={onClose}
        aria-label="Fermer la visionneuse"
        className="absolute top-4 right-4 z-10 p-3 text-white/80 hover:text-white transition-colors duration-200"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Flèches desktop */}
      {hasNav && onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          aria-label="Œuvre précédente"
          className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-10 p-3 text-white/70 hover:text-white transition-colors duration-200 hidden sm:block"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {hasNav && onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          aria-label="Œuvre suivante"
          className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-10 p-3 text-white/70 hover:text-white transition-colors duration-200 hidden sm:block"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="w-full h-full flex items-center justify-center p-4 sm:p-10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          onDoubleClick={(e) => zoomAt(e.clientX, e.clientY)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomed ? 2.5 : 1})`,
            transformOrigin: origin,
            transition: dragRef.current.active ? 'none' : 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <Image
            ref={imgRef}
            src={src}
            alt={alt}
            width={0}
            height={0}
            sizes="100vw"
            placeholder="blur"
            blurDataURL={blurDataUrl(src)}
            draggable={false}
            className="max-h-[92svh] w-auto max-w-full object-contain"
          />
        </div>
      </div>

      {/* Légende */}
      <p className="absolute bottom-4 left-0 right-0 text-center font-body text-xs text-white/60 px-6 pointer-events-none">
        {alt}
      </p>
    </div>
  )
}
