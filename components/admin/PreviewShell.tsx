'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import frMessages from '@/messages/fr.json'
import enMessages from '@/messages/en.json'
import esMessages from '@/messages/es.json'
import deMessages from '@/messages/de.json'

// Dictionnaires du site — injectés dans l'aperçu pour que les vrais
// composants publics (useTranslations/useLocale) fonctionnent ici.
const MESSAGES = { fr: frMessages, en: enMessages, es: esMessages, de: deMessages }

const LANGS: { v: Locale; label: string }[] = [
  { v: 'fr', label: 'FR' },
  { v: 'en', label: 'EN' },
  { v: 'es', label: 'ES' },
  { v: 'de', label: 'DE' },
]

/** Petit délai anti-rebond : l'aperçu suit la frappe sans redessiner à
 *  chaque touche (150 ms, comme demandé). */
export function useDebounced<T>(value: T, ms = 150): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Mention discrète quand la langue choisie n'a pas de traduction. */
export function NotTranslatedNote() {
  return (
    <p
      role="status"
      className="mb-3 inline-block font-body text-xs text-[var(--muted)] bg-[var(--accent-soft)] border border-[var(--line)] px-2 py-1"
    >
      Pas encore traduit — le français est affiché.
    </p>
  )
}

interface FrameProps {
  children: ReactNode
  /** Rôle de la boîte (dialog dans la feuille mobile). */
  dialog?: boolean
  onClose?: () => void
}

// Cadre commun : bandeau « Aperçu, pas encore enregistré », sélecteur de
// langue et bascule clair/sombre propres à l'aperçu (classes pv-* scopées).
function PreviewFrame({ children, dialog, onClose }: FrameProps) {
  const [lang, setLang] = useState<Locale>('fr')
  const [dark, setDark] = useState(false)
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  return (
    <div
      role={dialog ? 'dialog' : undefined}
      aria-modal={dialog || undefined}
      aria-label={dialog ? 'Aperçu, pas encore enregistré' : undefined}
      className="pv-sheet border border-[var(--line)] bg-[var(--surface)] shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 border-b border-[var(--line)]">
        <p className="font-body text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          Aperçu — pas encore enregistré
        </p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Langue de l’aperçu" className="flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l.v}
                type="button"
                aria-pressed={lang === l.v}
                onClick={() => {
                  setLang(l.v)
                  setAnnounce(`Aperçu en ${l.label}`)
                }}
                className={`min-w-[40px] min-h-[36px] px-2 font-body text-xs font-medium border transition-colors ${
                  lang === l.v
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setDark((d) => !d)
              setAnnounce(dark ? 'Aperçu en mode clair' : 'Aperçu en mode sombre')
            }}
            aria-label={dark ? 'Aperçu en mode clair' : 'Aperçu en mode sombre'}
            className="min-w-[40px] min-h-[36px] px-2 border border-[var(--line)] text-sm text-[var(--ink)]"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l’aperçu"
              className="min-w-[40px] min-h-[36px] px-2 border border-[var(--line)] font-body text-sm text-[var(--ink)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {/* Zone aperçue : thème scopé, composants publics alimentés par le
          formulaire — jamais par la base. Les liens sont neutralisés pour
          ne pas perdre le brouillon en cours. */}
      <div
        className={`${dark ? 'pv-dark' : 'pv-light'} bg-[var(--bg)] text-[var(--ink)] p-5 sm:p-6`}
        onClickCapture={(e) => {
          // Bloque uniquement la navigation des liens (Next Link) — les
          // boutons de l'aperçu (miniatures, lightbox) restent actifs.
          if ((e.target as HTMLElement).closest('a')) e.preventDefault()
        }}
      >
        <NextIntlClientProvider locale={lang} messages={MESSAGES[lang]}>
          {children}
        </NextIntlClientProvider>
      </div>
    </div>
  )
}

// Feuille modale mobile : Échap ferme, focus piégé, retour au bouton.
function PreviewSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    const first = rootRef.current?.querySelector<HTMLElement>('button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      // Une visionneuse ouverte par-dessus la feuille gère Échap elle-même.
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const topDialogOpen = Array.from(dialogs).some((d) => !d.classList.contains('pv-sheet'))
      if (e.key === 'Escape') {
        if (!topDialogOpen) onClose()
      } else if (e.key === 'Tab' && rootRef.current) {
        const focusables = rootRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const firstEl = focusables[0]
        const lastEl = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      trigger?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={rootRef}
        className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </div>
    </div>
  )
}

interface Props {
  /** Contenu de l'aperçu (composants publics alimentés par le formulaire). */
  preview: ReactNode
  children: ReactNode
}

// Mise en page « formulaire + aperçu en direct » :
// - ordinateur : deux colonnes, aperçu sticky à droite ;
// - téléphone : bouton « Aperçu » fixe en bas → feuille plein écran.
export default function FormWithPreview({ preview, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(330px,400px)] lg:gap-10">
        <div className="min-w-0">{children}</div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <PreviewFrame>{preview}</PreviewFrame>
          </div>
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-5 right-5 z-40 min-h-[48px] px-5 font-body text-base font-medium bg-[var(--ink)] text-[var(--bg)] shadow-lg border border-[var(--ink)]"
        aria-haspopup="dialog"
      >
        👁 Aperçu
      </button>

      {open && (
        <PreviewSheet onClose={() => setOpen(false)}>
          <PreviewFrame dialog onClose={() => setOpen(false)}>
            {preview}
          </PreviewFrame>
        </PreviewSheet>
      )}
    </>
  )
}
