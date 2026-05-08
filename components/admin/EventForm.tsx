'use client'

import { useState } from 'react'
import { GalleryEvent, EventMedia } from '@/lib/types'
import CloudinaryUpload from './CloudinaryUpload'

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match ? match[1] : null
}

interface Props {
  event: GalleryEvent | null
  onClose: () => void
}

export default function EventForm({ event, onClose }: Props) {
  const isEditing = !!event

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
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setError('')
    setMessage('')

    if (!form.title.trim()) {
      setError('Le titre est obligatoire.')
      return
    }

    setSaving(true)

    const body = {
      ...form,
      title: form.title.trim(),
      media,
      order: event?.order || 0,
    }

    if (isEditing) {
      await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    setMessage(isEditing ? 'Événement modifié !' : 'Événement ajouté !')
    setSaving(false)
    setTimeout(() => onClose(), 1000)
  }

  const handleAddVideo = () => {
    setVideoError('')
    const ytId = getYouTubeId(videoUrl.trim())
    if (!ytId) {
      setVideoError('URL YouTube invalide')
      return
    }
    setMedia([...media, { type: 'video', url: videoUrl.trim(), caption: '' }])
    setVideoUrl('')
  }

  const handleAddPhoto = (url: string, publicId: string) => {
    setMedia([...media, { type: 'photo', url, publicId, caption: '' }])
  }

  const handleRemoveMedia = (index: number) => {
    setMedia(media.filter((_, i) => i !== index))
  }

  const handleMoveMedia = (index: number, direction: 'up' | 'down') => {
    const arr = [...media]
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= arr.length) return
    ;[arr[index], arr[swap]] = [arr[swap], arr[index]]
    setMedia(arr)
  }

  const handleCaptionChange = (index: number, caption: string) => {
    const arr = [...media]
    arr[index] = { ...arr[index], caption }
    setMedia(arr)
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="font-body text-lg sm:text-xl font-medium text-charcoal">
          {isEditing ? `Modifier « ${event.title} »` : 'Ajouter un événement'}
        </h2>
        <button onClick={onClose} className="font-body text-sm text-warm-gray hover:text-charcoal min-h-[44px] px-2">
          ✕ Fermer
        </button>
      </div>

      {message && (
        <div className="mb-4 p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded">
          <p className="font-body text-sm text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-[#C0392B]/10 border border-[#C0392B]/30 rounded">
          <p className="font-body text-sm text-[#C0392B] font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-5">
        {/* Cover */}
        <div>
          <label className="label-field">📷 Photo de couverture</label>
          <CloudinaryUpload
            currentUrl={form.coverUrl}
            onUploaded={(url, publicId) => setForm({ ...form, coverUrl: url, coverPublicId: publicId })}
          />
        </div>

        {/* Title */}
        <div>
          <label className="label-field">📝 Titre *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-field"
            placeholder="Nom de l'exposition"
          />
        </div>

        {/* Location */}
        <div>
          <label className="label-field">📍 Lieu</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input-field"
            placeholder="ex: Galerie du Midi, Nîmes"
          />
        </div>

        {/* Date */}
        <div>
          <label className="label-field">📅 Date de l&apos;événement</label>
          <input
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            className="input-field"
          />
        </div>

        {/* Description */}
        <div>
          <label className="label-field">💬 Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field min-h-[120px] resize-y"
            rows={4}
          />
        </div>

        {/* Published toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, published: !form.published })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              form.published ? 'bg-[#2D6A4F]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-transform ${
                form.published ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="font-body text-sm text-charcoal">
            {form.published ? '👁 Publié (visible sur le site)' : '📝 Brouillon (non visible)'}
          </span>
        </div>

        {/* ── Media section ── */}
        <div className="border-t border-[var(--border)] pt-5">
          <h3 className="font-body text-base font-medium text-charcoal mb-4">
            Médias de l&apos;événement
          </h3>

          {/* Add photo */}
          <div className="mb-4">
            <label className="label-field text-sm">+ Ajouter une photo</label>
            <CloudinaryUpload
              currentUrl=""
              onUploaded={handleAddPhoto}
            />
          </div>

          {/* Add video */}
          <div className="mb-4">
            <label className="label-field text-sm">+ Ajouter une vidéo YouTube</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setVideoError('') }}
                className="input-field flex-1"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <button
                type="button"
                onClick={handleAddVideo}
                disabled={!videoUrl.trim()}
                className="btn-secondary min-h-[44px] disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
            {videoError && (
              <p className="font-body text-xs text-[#C0392B] mt-1">{videoError}</p>
            )}
          </div>

          {/* Media list */}
          {media.length > 0 && (
            <div className="space-y-3">
              {media.map((m, i) => (
                <div key={i} className="border border-[var(--border)] rounded p-3 flex flex-col sm:flex-row gap-3">
                  {/* Thumbnail */}
                  <div className="w-full sm:w-24 h-16 bg-[var(--border)] rounded overflow-hidden flex-shrink-0">
                    {m.type === 'photo' ? (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/80 text-white text-lg">
                        ▶
                      </div>
                    )}
                  </div>

                  {/* Caption + actions */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        m.type === 'photo' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.type === 'photo' ? '📷 Photo' : '🎬 Vidéo'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={m.caption || ''}
                      onChange={(e) => handleCaptionChange(i, e.target.value)}
                      className="input-field text-sm"
                      placeholder="Légende (optionnel)"
                    />
                  </div>

                  {/* Order + delete */}
                  <div className="flex sm:flex-col gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveMedia(i, 'up')}
                      disabled={i === 0}
                      className="btn-secondary text-xs min-h-[36px] min-w-[36px] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveMedia(i, 'down')}
                      disabled={i === media.length - 1}
                      className="btn-secondary text-xs min-h-[36px] min-w-[36px] disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(i)}
                      className="btn-danger text-xs min-h-[36px] min-w-[36px]"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="btn-secondary w-full sm:w-auto min-h-[52px]"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="btn-primary w-full sm:w-auto min-h-[52px] disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer l\'événement'}
          </button>
        </div>
      </div>
    </div>
  )
}
