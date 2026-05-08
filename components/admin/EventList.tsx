'use client'

import { useEffect, useState } from 'react'
import { GalleryEvent } from '@/lib/types'

interface Props {
  onEdit: (event: GalleryEvent) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EventList({ onEdit }: Props) {
  const [events, setEvents] = useState<GalleryEvent[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    const res = await fetch('/api/events?all=true')
    if (res.ok) setEvents(await res.json())
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    setMessage('Événement supprimé.')
    await loadEvents()
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div>
      {message && (
        <div className="mb-4 p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded">
          <p className="font-body text-sm text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}

      {events.length === 0 && (
        <p className="font-body text-warm-gray text-center py-12">
          Aucun événement. Cliquez sur &quot;Ajouter&quot; pour commencer.
        </p>
      )}

      <div className="space-y-4">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="border border-[var(--border)] rounded p-4 flex flex-col sm:flex-row gap-4"
          >
            {/* Thumbnail */}
            <div className="w-full sm:w-28 h-20 sm:h-20 bg-[var(--border)] rounded overflow-hidden flex-shrink-0">
              {evt.coverUrl ? (
                <img src={evt.coverUrl} alt={evt.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-warm-gray text-xs">
                  —
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h3 className="font-body font-medium text-charcoal text-base truncate">
                  {evt.title}
                </h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    evt.published
                      ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {evt.published ? 'Publié' : 'Brouillon'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {evt.eventDate && (
                  <span className="font-body text-xs text-warm-gray">{formatDate(evt.eventDate)}</span>
                )}
                {evt.location && (
                  <span className="font-body text-xs text-warm-gray">📍 {evt.location}</span>
                )}
                <span className="font-body text-xs text-warm-gray">
                  {evt.media.length} média{evt.media.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-row sm:flex-col gap-2 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => onEdit(evt)}
                className="btn-secondary text-sm flex-1 sm:flex-none min-h-[44px]"
              >
                Modifier
              </button>
              {deleteConfirm === evt.id ? (
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <button
                    onClick={() => handleDelete(evt.id)}
                    className="btn-danger text-xs flex-1 min-h-[44px]"
                  >
                    Confirmer
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="btn-secondary text-xs flex-1 min-h-[44px]"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(evt.id)}
                  className="btn-danger text-sm flex-1 sm:flex-none min-h-[44px]"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
