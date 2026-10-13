'use client'

import { useEffect, useState } from 'react'
import { GalleryEvent } from '@/lib/types'
import { redirectToLogin } from '@/lib/storage'

interface Props {
  onAdd: () => void
  onEdit: (event: GalleryEvent) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EventList({ onAdd, onEdit }: Props) {
  const [events, setEvents] = useState<GalleryEvent[]>([])
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<GalleryEvent | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/events?all=true')
      if (res.ok) {
        setEvents(await res.json())
      } else {
        setError('Impossible de charger vos événements. Vérifiez votre connexion.')
      }
    } catch {
      setError('Impossible de charger vos événements. Vérifiez votre connexion.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setError('')
    try {
      const res = await fetch(`/api/events/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        setError('La suppression a échoué — rien n\'a été perdu, réessayez.')
        return
      }
      setMessage(`« ${deleteTarget.title} » a été supprimé.`)
      await loadEvents()
      setTimeout(() => setMessage(''), 4000)
    } catch {
      setDeleteTarget(null)
      setError('La suppression a échoué — rien n\'a été perdu, réessayez.')
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = events.filter(
    (e) =>
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q)
  )

  return (
    <div>
      <button onClick={onAdd} className="btn-primary w-full text-lg mb-6">
        + Ajouter un événement
      </button>

      {message && (
        <div className="mb-4 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
          <p className="font-body text-base text-[var(--ink)] font-medium">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-[#B3402F]/10 border border-[#B3402F]/30" role="alert">
          <p className="font-body text-base text-[#B3402F]">{error}</p>
        </div>
      )}

      {events.length > 1 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field mb-6"
          placeholder="🔍 Rechercher un événement..."
          aria-label="Rechercher un événement"
        />
      )}

      {events.length === 0 ? (
        <div className="text-center py-14 px-4 border border-dashed border-[var(--line)] bg-[var(--surface)]">
          <p className="font-body text-lg text-[var(--ink-soft)]">
            Vous n&apos;avez pas encore d&apos;événement.
          </p>
          <p className="font-body text-base text-[var(--muted)] mt-2">
            Touchez « + Ajouter un événement » pour annoncer une exposition, un vernissage...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center font-body text-base text-[var(--muted)] py-14">
          Aucun événement ne correspond à « {search} ».
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center gap-3 p-3 border border-[var(--line)] bg-[var(--surface)]"
            >
              {/* Vignette */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-[var(--line)] overflow-hidden">
                {evt.coverUrl ? (
                  <img src={evt.coverUrl} alt={evt.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
                    📅
                  </div>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <h3 className="font-body text-base font-medium text-[var(--ink)] truncate">
                  {evt.title}
                </h3>
                <p className="font-body text-sm text-[var(--ink-soft)] mt-0.5">
                  {evt.eventDate ? formatDate(evt.eventDate) : 'Date à préciser'}
                  {evt.location ? ` · ${evt.location}` : ''}
                </p>
                <span
                  className={`inline-block mt-1 font-body text-xs px-2 py-0.5 border ${
                    evt.published
                      ? 'bg-[#2D6A4F]/10 border-[#2D6A4F]/30 text-[#2D6A4F]'
                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                  }`}
                >
                  {evt.published ? '👁 Visible sur le site' : '📝 Brouillon — non visible'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => onEdit(evt)}
                  className="h-11 px-4 border border-[var(--line)] bg-[var(--surface)] font-body text-sm text-[var(--ink)] hover:border-[var(--accent)]"
                >
                  Modifier
                </button>
                <button
                  onClick={() => setDeleteTarget(evt)}
                  aria-label={`Supprimer « ${evt.title} »`}
                  className="h-11 px-4 border border-[var(--line)] bg-[var(--surface)] text-[#B3402F] hover:border-[#B3402F]"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation de suppression */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-[var(--surface)] max-w-md w-full p-6 sm:p-8 shadow-xl">
            {deleteTarget.coverUrl && (
              <div className="w-24 h-24 mx-auto bg-[var(--line)] overflow-hidden">
                <img
                  src={deleteTarget.coverUrl}
                  alt={deleteTarget.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h3 className="font-display text-2xl text-center text-[var(--ink)] mt-4">
              Supprimer « {deleteTarget.title} » ?
            </h3>
            <p className="font-body text-base text-center text-[#B3402F] font-medium mt-2">
              Cette action est définitive.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                autoFocus
                className="btn-primary w-full text-base"
              >
                Annuler — garder l&apos;événement
              </button>
              <button
                onClick={handleDelete}
                className="font-body text-sm text-[#B3402F] underline min-h-[48px] hover:text-[#96352a]"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
