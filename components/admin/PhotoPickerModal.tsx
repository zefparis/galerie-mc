'use client'

import { useEffect, useRef } from 'react'
import type { AdminPhoto } from '@/lib/types'
import PhotoLibrary from './PhotoLibrary'

interface Props {
  open: boolean
  mode: 'single' | 'multiple'
  maxSelect?: number
  onClose: () => void
  onSelect: (photos: AdminPhoto[]) => void
}

// Feuille modale de sélection dans la photothèque : focus piégé, fermeture à
// Échap ou au bouton, restitution du focus au déclencheur.
export default function PhotoPickerModal({
  open,
  mode,
  maxSelect = 1,
  onClose,
  onSelect,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement | null
    const t = setTimeout(() => closeBtnRef.current?.focus(), 20)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
      triggerRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] bg-[var(--bg)] border border-[var(--line)] flex flex-col overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--line)] flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            <h2
              id="photo-picker-title"
              className="font-display text-2xl text-[var(--ink)]"
            >
              Choisir dans mes photos
            </h2>
            <p className="font-body text-xs text-[var(--muted)] mt-0.5">
              {mode === 'single'
                ? 'Choisissez une photo déjà enregistrée dans votre espace.'
                : `Choisissez jusqu'à ${maxSelect} photo${maxSelect > 1 ? 's' : ''} pour cette exposition.`}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le sélecteur de photos"
            className="min-h-[44px] min-w-[44px] px-3 border border-[var(--line)] font-body text-sm text-[var(--ink)] hover:border-[var(--ink)]"
          >
            Fermer ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 pb-0">
          <PhotoLibrary
            mode={mode}
            maxSelect={maxSelect}
            onCancelPicker={onClose}
            onSelectPhotos={(chosen) => {
              onSelect(chosen)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
