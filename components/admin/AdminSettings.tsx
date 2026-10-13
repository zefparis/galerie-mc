'use client'

import { useState, useEffect, useRef } from 'react'
import { getSettings, DEFAULT_SETTINGS, isSessionExpired, redirectToLogin } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import { photoCaptionKey } from '@/lib/translations-core'
import CloudinaryUpload from './CloudinaryUpload'
import HelpTip from './HelpTip'
import TranslationPanel from './TranslationPanel'

function translateInBackground() {
  fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity: 'settings' }),
  }).catch(() => {})
}

const DRAFT_KEY = 'mc-draft-settings'
const MIGRATED_KEY = 'mc-settings-migrated'
const MAX_PHOTOS = 3

export default function AdminSettings() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftFound, setDraftFound] = useState(false)
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null)
  const restored = useRef(false)

  // Chargement : API (source de vérité), complétée par les anciennes valeurs
  // locales si elles n'ont jamais été envoyées en base — rien n'est perdu.
  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const load = async () => {
      let base: GallerySettings
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error()
        base = await res.json()
      } catch {
        setLoadError(true)
        base = getSettings()
      }

      // Ancien stockage navigateur : si l'artiste avait déjà saisi des textes
      // avant le passage en base ET que la base n'a encore rien de
      // personnalisé, on reprend ses anciennes valeurs — rien n'est perdu.
      try {
        if (!localStorage.getItem(MIGRATED_KEY)) {
          const legacy = getSettings()
          const apiStillDefaults =
            base.artistName === DEFAULT_SETTINGS.artistName &&
            base.bio === DEFAULT_SETTINGS.bio
          const legacyCustomized =
            legacy.artistName !== DEFAULT_SETTINGS.artistName ||
            legacy.bio !== DEFAULT_SETTINGS.bio ||
            legacy.bioShort !== DEFAULT_SETTINGS.bioShort ||
            legacy.email !== DEFAULT_SETTINGS.email
          if (apiStillDefaults && legacyCustomized) {
            base = { ...base, ...legacy }
          }
        }
      } catch { /* ignore */ }

      // Brouillon automatique éventuel
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          const draft = JSON.parse(raw)
          if (draft?.artistName) {
            base = draft
            setDraftFound(true)
          }
        }
      } catch { /* brouillon illisible — on l'ignore */ }

      setSettings(base)
    }
    load()
  }, [])

  // Brouillon auto-sauvegardé à chaque modification
  useEffect(() => {
    if (!settings) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(settings))
      } catch { /* stockage plein — non bloquant */ }
    }, 400)
    return () => clearTimeout(t)
  }, [settings])

  if (!settings) {
    return (
      <p className="font-body text-base text-[var(--muted)] py-10 text-center">
        Chargement de vos informations...
      </p>
    )
  }

  const photos = settings.photos || []

  const handleSave = async () => {
    setError('')
    setMessage('')
    if (!settings.artistName.trim()) {
      setError('Votre nom est obligatoire pour enregistrer.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        throw new Error('save-failed')
      }
      localStorage.removeItem(DRAFT_KEY)
      localStorage.setItem(MIGRATED_KEY, '1')
      setDraftFound(false)
      translateInBackground()
      setMessage('Votre présentation est enregistrée ✓ — elle est maintenant visible sur votre site. Les traductions arrivent dans quelques secondes.')
      setTimeout(() => setMessage(''), 8000)
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError('Une erreur est survenue — rien n\'a été perdu, réessayez.')
    } finally {
      setSaving(false)
    }
  }

  const addPhoto = (url: string, publicId: string) => {
    if (photos.length >= MAX_PHOTOS) return
    setSettings({ ...settings, photos: [...photos, { url, publicId }] })
  }

  const replacePhoto = (index: number, url: string, publicId: string) => {
    const arr = [...photos]
    arr[index] = { url, publicId }
    setSettings({ ...settings, photos: arr })
  }

  const removePhoto = (index: number) => {
    setSettings({ ...settings, photos: photos.filter((_, i) => i !== index) })
    setDeletePhotoIndex(null)
  }

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraftFound(false)
    restored.current = false
    setSettings(null)
    // recharge depuis l'API
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSettings(s || getSettings()))
      .catch(() => setSettings(getSettings()))
  }

  return (
    <div className="w-full max-w-2xl">
      <p className="font-body text-base text-[var(--ink-soft)] mb-8">
        Ce que les visiteurs lisent à votre sujet sur la page d&apos;accueil et le
        pied de page. Remplissez ce que vous voulez — tout est facultatif sauf
        votre nom.
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
      {loadError && (
        <div className="mb-6 p-4 bg-[var(--warning-bg)] border border-[var(--warning-line)]" role="alert">
          <p className="font-body text-base text-[var(--warning-ink)]">
            ⚠️ Je n&apos;ai pas pu charger vos informations enregistrées. Vérifiez
            votre connexion et rechargez la page avant de modifier — sinon vous
            risquez d&apos;écraser ce qui est en ligne.
          </p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
          <p className="font-body text-base text-[var(--danger)]">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="st-name" className="label-field">
            Votre nom, tel qu&apos;il s&apos;affiche *
          </label>
          <input
            id="st-name"
            type="text"
            value={settings.artistName}
            onChange={(e) => setSettings({ ...settings, artistName: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="st-bio-short" className="label-field">
            Petite phrase d&apos;accroche <span className="label-optional">— facultatif</span>
            <HelpTip text="Une ligne affichée juste sous votre nom sur la page d'accueil, par exemple « Artiste peintre à Montreuil-aux-Lions »." />
          </label>
          <input
            id="st-bio-short"
            type="text"
            value={settings.bioShort}
            onChange={(e) => setSettings({ ...settings, bioShort: e.target.value })}
            className="input-field"
            placeholder="ex : Artiste peintre à Montreuil-aux-Lions"
          />
        </div>

        <div>
          <label htmlFor="st-bio" className="label-field">
            Votre présentation <span className="label-optional">— facultatif</span>
            <HelpTip text="Quelques phrases sur vous et votre peinture. C'est le texte « Qui suis-je » de votre site." />
          </label>
          <textarea
            id="st-bio"
            value={settings.bio}
            onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
            className="input-field min-h-[160px] resize-y"
            rows={6}
          />
        </div>

        <div>
          <label htmlFor="st-process" className="label-field">
            Ma démarche picturale <span className="label-optional">— facultatif</span>
            <HelpTip text="Parlez de votre façon de peindre, de ce qui vous inspire, de ce que vous cherchez sur la toile. Vous pouvez écrire plusieurs paragraphes — ils s'afficheront en belles grandes lettres sur votre site." />
          </label>
          <textarea
            id="st-process"
            value={settings.processText || ''}
            onChange={(e) => setSettings({ ...settings, processText: e.target.value })}
            className="input-field min-h-[200px] resize-y"
            rows={8}
            placeholder="ex : Je peins d'abord avec les mains, la couleur guide le geste..."
          />
        </div>

        {/* ── Mes photos ── */}
        <div className="border-t border-[var(--line)] pt-6">
          <h3 className="font-body text-lg font-medium text-[var(--ink)] mb-1">
            Mes photos <span className="label-optional">— 3 maximum</span>
            <HelpTip text="Des photos de vous, dans votre atelier ou avec vos toiles. Elles s'affichent à côté de votre présentation sur le site." />
          </h3>
          <p className="font-body text-sm text-[var(--ink-soft)] mb-5">
            {photos.length === 0
              ? 'Ajoutez une photo de vous pour donner un visage à votre galerie.'
              : photos.length >= MAX_PHOTOS
                ? 'Vous avez atteint la limite de 3 photos — supprimez-en une pour en changer.'
                : `Encore ${MAX_PHOTOS - photos.length} emplacement${MAX_PHOTOS - photos.length > 1 ? 's' : ''} disponible${MAX_PHOTOS - photos.length > 1 ? 's' : ''}.`}
          </p>

          <div className="space-y-5">
            {photos.map((photo, i) => (
              <div key={photo.publicId || photo.url} className="border border-[var(--line)] bg-[var(--surface)] p-3">
                <CloudinaryUpload
                  currentUrl={photo.url}
                  onUploaded={(url, publicId) => replacePhoto(i, url, publicId)}
                />
                {deletePhotoIndex === i ? (
                  <div className="mt-3 p-3 border border-[var(--danger-line)] bg-[var(--danger-bg)]">
                    <p className="font-body text-sm text-[var(--ink)]">
                      Retirer cette photo de votre présentation ?
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setDeletePhotoIndex(null)}
                        autoFocus
                        className="btn-secondary flex-1 text-sm"
                      >
                        Annuler — garder la photo
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="font-body text-sm text-[var(--danger)] underline min-h-[48px] px-3"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeletePhotoIndex(i)}
                    className="mt-3 font-body text-sm text-[var(--danger)] underline min-h-[48px]"
                  >
                    Retirer cette photo
                  </button>
                )}
              </div>
            ))}

            {photos.length < MAX_PHOTOS && (
              <div className="border border-dashed border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="font-body text-sm text-[var(--muted)] mb-3">
                  Ajouter une photo ({photos.length + 1} sur {MAX_PHOTOS})
                </p>
                <CloudinaryUpload currentUrl="" onUploaded={addPhoto} />
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="st-email" className="label-field">
            Votre adresse email <span className="label-optional">— facultatif</span>
            <HelpTip text="Affichée sur la page Contact — c'est aussi l'adresse qui reçoit les messages des visiteurs." />
          </label>
          <input
            id="st-email"
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            className="input-field"
            inputMode="email"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="st-insta" className="label-field">
              Instagram <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="st-insta"
              type="text"
              value={settings.instagram || ''}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              className="input-field"
              placeholder="@votre_compte"
            />
          </div>
          <div>
            <label htmlFor="st-phone" className="label-field">
              Téléphone <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="st-phone"
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="input-field"
              placeholder="06 12 34 56 78"
              inputMode="tel"
            />
          </div>
        </div>

        {/* ── Traductions ── */}
        <div className="border-t border-[var(--line)] pt-6">
          <TranslationPanel
            entity="settings"
            fields={[
              { key: 'bioShort', label: 'Phrase d’accroche' },
              { key: 'bio', label: 'Votre présentation', multiline: true },
              { key: 'processText', label: 'Ma démarche picturale', multiline: true },
              ...photos
                .filter((p) => p.publicId)
                .map((p, i) => ({
                  key: photoCaptionKey(p.publicId!),
                  label: `Légende de la photo ${i + 1}`,
                })),
            ]}
            french={{
              bioShort: settings.bioShort,
              bio: settings.bio,
              processText: settings.processText || '',
              ...Object.fromEntries(
                photos.filter((p) => p.publicId).map((p) => [photoCaptionKey(p.publicId!), p.caption || ''])
              ),
            }}
            translations={settings.translations}
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
          {saving ? 'Enregistrement...' : '✓ Enregistrer ma présentation'}
        </button>
        <p className="font-body text-sm text-[var(--muted)] text-center mt-3">
          Ce que vous écrivez ici apparaît directement sur votre site.
        </p>
      </div>
    </div>
  )
}
