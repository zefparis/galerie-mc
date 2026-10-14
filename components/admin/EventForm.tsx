'use client'

import { useEffect, useRef, useState } from 'react'
import { GalleryEvent, EventImage, EventMedia, Translations } from '@/lib/types'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'
import { photoCaptionKey } from '@/lib/translations-core'
import CloudinaryUpload from './CloudinaryUpload'
import EventPhotosField from './EventPhotosField'
import HelpTip from './HelpTip'
import TranslationPanel from './TranslationPanel'

function translateInBackground(entity: 'painting' | 'event' | 'settings', id?: string) {
  fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity, id }),
  }).catch(() => {})
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

interface Props {
  event: GalleryEvent | null
  onDone: (message: string) => void
  onCancel: () => void
}

export default function EventForm({ event, onDone, onCancel }: Props) {
  const isEditing = !!event
  const draftKey = `mc-draft-event-${event?.id || 'new'}`

  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    location: event?.location || '',
    eventDate: event?.eventDate || '',
    coverUrl: event?.coverUrl || '',
    coverPublicId: event?.coverPublicId || '',
    published: event?.published || false,
  })

  const [media, setMedia] = useState<EventMedia[]>(event?.media || [])
  const [images, setImages] = useState<EventImage[]>(event?.images || [])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState('')
  const [draftFound, setDraftFound] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [translations, setTranslations] = useState<Translations>(event?.translations || {})
  const restored = useRef(false)

  // Récupération du brouillon automatique
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft?.form?.title || draft?.form?.coverUrl) {
        setForm(draft.form)
        if (Array.isArray(draft.media)) setMedia(draft.media)
        if (Array.isArray(draft.images)) setImages(draft.images)
        setDraftFound(true)
      }
    } catch { /* brouillon illisible — on l'ignore */ }
  }, [draftKey])

  // Sauvegarde automatique du brouillon
  useEffect(() => {
    if (isEditing) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, media, images }))
      } catch { /* stockage plein — non bloquant */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form, media, images, draftKey, isEditing])

  const discardDraft = () => {
    localStorage.removeItem(draftKey)
    setDraftFound(false)
    setForm({
      title: '', description: '', location: '', eventDate: '',
      coverUrl: '', coverPublicId: '', published: false,
    })
    setMedia([])
    setImages([])
  }

  const handleSave = async () => {
    setError('')
    if (!form.title.trim()) {
      setError('Donnez un titre à votre événement pour pouvoir l\'enregistrer.')
      return
    }
    setSaving(true)
    try {
      // La première photo devient la couverture (le serveur le garantit aussi).
      const body = {
        ...form,
        title: form.title.trim(),
        coverUrl: images[0]?.url || form.coverUrl,
        coverPublicId: images[0]?.publicId || form.coverPublicId,
        media,
        images,
        order: event?.order || 0,
      }
      const res = isEditing
        ? await fetch(`/api/events/${event.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        throw new Error('save-failed')
      }
      localStorage.removeItem(draftKey)
      translateInBackground('event', event?.id || (await res.json()).id)
      onDone(
        (isEditing ? 'Modifications enregistrées ✓' : 'Votre événement est enregistré ✓') +
          ' Les traductions arrivent dans quelques secondes.'
      )
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError('Une erreur est survenue — rien n\'a été perdu, réessayez.')
      setSaving(false)
    }
  }

  const handleAddVideo = () => {
    setVideoError('')
    const ytId = getYouTubeId(videoUrl.trim())
    if (!ytId) {
      setVideoError('Ce lien n\'est pas un lien YouTube valide. Copiez l\'adresse complète de la vidéo.')
      return
    }
    setMedia([...media, { type: 'video', url: videoUrl.trim(), caption: '' }])
    setVideoUrl('')
  }

  const handleMoveMedia = (index: number, direction: 'up' | 'down') => {
    const arr = [...media]
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= arr.length) return
    ;[arr[index], arr[swap]] = [arr[swap], arr[index]]
    setMedia(arr)
  }

  return (
    <div className="w-full max-w-2xl">
      {draftFound && (
        <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="font-body text-base text-[var(--ink)]">
            J&apos;ai retrouvé le brouillon que vous aviez commencé.
          </p>
          <button
            onClick={discardDraft}
            className="font-body text-sm text-[var(--ink-soft)] underline min-h-[44px] text-left sm:text-right"
          >
            Recommencer à zéro
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
          <p className="font-body text-base text-[var(--danger)]">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Photo de couverture */}
        <div>
          <p className="label-field">
            Photo de couverture
            <HelpTip text="La grande image qui présente votre événement sur le site." />
          </p>
          <CloudinaryUpload
            currentUrl={form.coverUrl}
            onUploaded={(url, publicId) => setForm({ ...form, coverUrl: url, coverPublicId: publicId })}
          />
        </div>

        {/* Titre */}
        <div>
          <label htmlFor="ev-title" className="label-field">Titre de l&apos;événement *</label>
          <input
            id="ev-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-field"
            placeholder="ex : Exposition à la mairie de Montreuil"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Lieu */}
          <div>
            <label htmlFor="ev-location" className="label-field">
              Lieu <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="ev-location"
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input-field"
              placeholder="ex : Salle des fêtes, Montreuil-aux-Lions"
            />
          </div>
          {/* Date */}
          <div>
            <label htmlFor="ev-date" className="label-field">
              Date <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="ev-date"
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ev-desc" className="label-field">
            Description <span className="label-optional">— facultatif</span>
            <HelpTip text="Toutes les informations utiles : horaires, entrée libre ou non, nombre d'œuvres présentées..." />
          </label>
          <textarea
            id="ev-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field min-h-[120px] resize-y"
            rows={4}
            placeholder="Présentez votre événement aux visiteurs..."
          />
        </div>

        {/* Visible / brouillon */}
        <div className="p-4 border border-[var(--line)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => setForm({ ...form, published: !form.published })}
            aria-pressed={form.published}
            className="flex items-center gap-3 w-full text-left min-h-[52px]"
          >
            <span
              className={`w-14 h-8 rounded-full transition-colors relative flex-shrink-0 ${
                form.published ? 'bg-[var(--success)]' : 'bg-[var(--line)]'
              }`}
            >
              <span
                className={`block w-6 h-6 rounded-full bg-white shadow absolute top-1 transition-transform ${
                  form.published ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </span>
            <span>
              <span className="block font-body text-base font-medium text-[var(--ink)]">
                {form.published ? '👁 Visible sur le site' : '📝 Brouillon'}
              </span>
              <span className="block font-body text-sm text-[var(--ink-soft)] mt-0.5">
                {form.published
                  ? 'Les visiteurs peuvent voir cet événement.'
                  : 'Personne ne le voit — touchez pour le rendre visible.'}
              </span>
            </span>
          </button>
        </div>

        {/* ── Médias ── */}
        <div className="border-t border-[var(--line)] pt-6">
          <h3 className="font-body text-lg font-medium text-[var(--ink)] mb-1">
            Photos et vidéos de l&apos;événement <span className="label-optional">— facultatif</span>
          </h3>
          <p className="font-body text-sm text-[var(--ink-soft)] mb-5">
            Ajoutez des photos de vos œuvres exposées, ou une vidéo YouTube du vernissage.
          </p>

          {/* Photos de l'exposition — envoi multiple, 10 maximum */}
          <div className="mb-5">
            <p className="label-field">
              Photos
              <HelpTip text="Les photos de l'exposition : œuvres accrochées, vues de la salle, vernissage. La première photo devient la couverture." />
            </p>
            <EventPhotosField images={images} onChange={setImages} max={10} />
          </div>

          {/* Ajouter une vidéo */}
          <div className="mb-5">
            <label htmlFor="ev-video" className="label-field">
              Ajouter une vidéo YouTube
              <HelpTip text="Copiez l'adresse de la vidéo sur YouTube (elle commence par youtube.com ou youtu.be) et collez-la ici." />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="ev-video"
                type="url"
                value={videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setVideoError('') }}
                className="input-field flex-1"
                placeholder="Collez le lien YouTube ici"
              />
              <button
                type="button"
                onClick={handleAddVideo}
                disabled={!videoUrl.trim()}
                className="btn-secondary disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
            {videoError && (
              <p className="font-body text-sm text-[var(--danger)] mt-2">{videoError}</p>
            )}
          </div>

          {/* Liste des vidéos (les photos vivent dans la section « Photos ») */}
          {media.some((m) => m.type === 'video') && (
            <div className="space-y-3">
              {media.map((m, i) => m.type === 'video' && (
                <div key={i} className="border border-[var(--line)] bg-[var(--surface)] p-3 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-black/80 overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-lg">
                      ▶
                    </div>
                    <span className="font-body text-sm font-medium text-[var(--ink)] flex-1">
                      🎬 Vidéo YouTube
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMoveMedia(i, 'up')}
                        disabled={i === 0}
                        aria-label="Monter ce média"
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMedia(i, 'down')}
                        disabled={i === media.length - 1}
                        aria-label="Descendre ce média"
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedia(media.filter((_, j) => j !== i))}
                        aria-label="Retirer ce média"
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--danger)] hover:border-[var(--danger)]"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={m.caption || ''}
                    onChange={(e) => {
                      const arr = [...media]
                      arr[i] = { ...arr[i], caption: e.target.value }
                      setMedia(arr)
                    }}
                    className="input-field text-base"
                    placeholder="Légende — facultatif"
                    aria-label="Légende du média"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traductions — seulement pour un événement déjà enregistré */}
        {isEditing && (
          <TranslationPanel
            entity="event"
            entityId={event.id}
            fields={[
              { key: 'title', label: 'Titre de l’événement' },
              { key: 'description', label: 'Description', multiline: true },
              { key: 'location', label: 'Lieu' },
              ...images
                .filter((img) => img.publicId)
                .map((img, i) => ({
                  key: photoCaptionKey(img.publicId!),
                  label: `Description de la photo ${i + 1}`,
                })),
            ]}
            french={{
              title: form.title,
              description: form.description,
              location: form.location,
              ...Object.fromEntries(
                images.filter((img) => img.publicId).map((img) => [photoCaptionKey(img.publicId!), img.alt || ''])
              ),
            }}
            translations={translations}
            onTranslationsChange={setTranslations}
          />
        )}

        {/* Boutons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-[var(--line)]">
          <button onClick={onCancel} className="btn-outline flex-1 text-base">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="btn-primary flex-1 text-base disabled:opacity-40"
          >
            {saving ? 'Enregistrement...' : '✓ Enregistrer l\'événement'}
          </button>
        </div>
      </div>
    </div>
  )
}
