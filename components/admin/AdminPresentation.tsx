'use client'

import { useEffect, useRef, useState } from 'react'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'
import { GallerySettings, Translations } from '@/lib/types'
import HelpTip from './HelpTip'
import TranslationPanel from './TranslationPanel'
import FormWithPreview from './PreviewShell'
import PresentationPreview from './PresentationPreview'

const TAGLINE_MAX = 160
const PRESENTATION_MAX = 3000
const DRAFT_KEY = 'mc-draft-presentation'

function translateInBackground() {
  fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity: 'settings' }),
  }).catch(() => {})
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={`font-body text-xs ${value >= max ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}
      aria-hidden="true"
    >
      {value} / {max}
    </span>
  )
}

// Carte « Présentation » : le texte de la page d'accueil, éditable par
// l'artiste — phrase d'accroche du hero + texte de présentation.
export default function AdminPresentation() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftFound, setDraftFound] = useState(false)
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const load = async () => {
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error()
        const s: GallerySettings = await res.json()
        try {
          const raw = localStorage.getItem(DRAFT_KEY)
          if (raw) {
            const draft = JSON.parse(raw)
            if (typeof draft?.tagline === 'string' || typeof draft?.presentation === 'string') {
              setSettings({ ...s, ...draft })
              setDraftFound(true)
              return
            }
          }
        } catch { /* brouillon illisible — on l'ignore */ }
        setSettings(s)
      } catch {
        setLoadError(true)
        setSettings(null)
      }
    }
    load()
  }, [])

  // Brouillon automatique des deux champs édités ici
  useEffect(() => {
    if (!settings) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ tagline: settings.tagline, presentation: settings.presentation })
        )
      } catch { /* stockage plein — non bloquant */ }
    }, 400)
    return () => clearTimeout(t)
  }, [settings])

  if (!settings) {
    return (
      <p className="font-body text-base text-[var(--muted)] py-10 text-center">
        {loadError
          ? "Je n'ai pas pu charger les textes — vérifiez votre connexion et rechargez la page."
          : 'Chargement des textes...'}
      </p>
    )
  }

  const tagline = settings.tagline || ''
  const presentation = settings.presentation || ''

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraftFound(false)
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setSettings(s))
      .catch(() => {})
  }

  const handleSave = async () => {
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, tagline, presentation }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        throw new Error('save-failed')
      }
      localStorage.removeItem(DRAFT_KEY)
      setDraftFound(false)
      translateInBackground()
      setMessage(
        'Vos textes sont enregistrés ✓ — ils sont visibles sur la page d’accueil. Les traductions arrivent dans quelques secondes.'
      )
      setTimeout(() => setMessage(''), 8000)
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError("Une erreur est survenue — rien n'a été perdu, réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormWithPreview
      preview={
        <PresentationPreview
          tagline={tagline}
          presentation={presentation}
          artistName={settings.artistName}
          // Même sur-titre que l'accueil : bioShort, « | » → « · » ;
          // vide → le défaut localisé des messages (dans l'aperçu).
          eyebrow={(settings.bioShort || '').replace(/\s*\|\s*/g, ' · ')}
          translations={settings.translations}
        />
      }
    >
    <div className="w-full max-w-2xl">
      <p className="font-body text-base text-[var(--ink-soft)] mb-8">
        Les textes affichés sur votre page d&apos;accueil, sous votre nom. Laissez
        un champ vide pour ne rien afficher — tout est facultatif.
      </p>

      {draftFound && (
        <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="font-body text-base text-[var(--ink)]">
            J&apos;ai retrouvé le brouillon que vous aviez commencé.
          </p>
          <button
            onClick={discardDraft}
            className="font-body text-sm text-[var(--ink-soft)] underline min-h-[44px] text-left sm:text-right"
          >
            Recharger la version en ligne
          </button>
        </div>
      )}

      {message && (
        <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
          <p className="font-body text-base text-[var(--ink)] font-medium">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
          <p className="font-body text-base text-[var(--danger)]">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pr-tagline" className="label-field">
              Phrase d&apos;accroche <span className="label-optional">— facultatif</span>
              <HelpTip text="Une courte phrase affichée juste sous votre nom, en haut de la page d'accueil." />
            </label>
            <Counter value={tagline.length} max={TAGLINE_MAX} />
          </div>
          <input
            id="pr-tagline"
            type="text"
            value={tagline}
            maxLength={TAGLINE_MAX}
            onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
            className="input-field"
            placeholder="ex : La couleur comme respiration, la matière comme langage."
          />
          <p className="font-body text-sm text-[var(--muted)] mt-2">
            {TAGLINE_MAX} caractères maximum. Évitez de répéter votre nom ou
            votre ville — ils sont déjà écrits juste au-dessus.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pr-presentation" className="label-field">
              Présentation <span className="label-optional">— facultatif</span>
              <HelpTip text="Quelques paragraphes sur vous et votre peinture, affichés dans la section « Présentation » de l'accueil. Un saut de ligne commence un nouveau paragraphe." />
            </label>
            <Counter value={presentation.length} max={PRESENTATION_MAX} />
          </div>
          <textarea
            id="pr-presentation"
            value={presentation}
            maxLength={PRESENTATION_MAX}
            onChange={(e) => setSettings({ ...settings, presentation: e.target.value })}
            className="input-field min-h-[220px] resize-y"
            rows={8}
            placeholder={
              'ex : Je travaille la couleur comme on respire — par à-coups, par nécessité.\n\nLa toile reste le lieu où tout se tait et se dit à la fois.'
            }
          />
          <p className="font-body text-sm text-[var(--muted)] mt-2">
            Texte brut uniquement (pas de mise en forme) — chaque saut de ligne
            crée un paragraphe sur le site. {PRESENTATION_MAX} caractères maximum.
          </p>
        </div>

        {/* Traductions — mêmes statuts et protections que les autres champs */}
        <div className="border-t border-[var(--line)] pt-6">
          <TranslationPanel
            entity="settings"
            fields={[
              { key: 'tagline', label: 'Phrase d’accroche (accueil)' },
              { key: 'presentation', label: 'Présentation (accueil)', multiline: true },
            ]}
            french={{ tagline, presentation }}
            translations={settings.translations as Translations | undefined}
            onTranslationsChange={(t) => setSettings({ ...settings, translations: t })}
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <button
          onClick={handleSave}
          disabled={saving || loadError}
          className="btn-primary w-full text-lg disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : '✓ Enregistrer mes textes'}
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline w-full text-base mt-3"
        >
          👁 Voir sur le site
        </a>
        <p className="font-body text-sm text-[var(--muted)] text-center mt-3">
          Ce que vous écrivez ici apparaît directement sur votre page d&apos;accueil.
        </p>
      </div>
    </div>
    </FormWithPreview>
  )
}
