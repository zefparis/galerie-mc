'use client'

import { useEffect, useState } from 'react'
import { getPaintings, deletePainting, reorderPainting } from '@/lib/storage'
import { Painting } from '@/lib/types'

interface Props {
  onEdit: (painting: Painting) => void
}

export default function PaintingList({ onEdit }: Props) {
  const [paintings, setPaintings] = useState<Painting[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPaintings()
  }, [])

  const loadPaintings = () => {
    const all = getPaintings()
    setPaintings(all)
  }

  const handleDelete = (id: string) => {
    deletePainting(id)
    setDeleteConfirm(null)
    setMessage('Tableau supprimé avec succès.')
    loadPaintings()
    setTimeout(() => setMessage(''), 3000)
  }

  const handleReorder = (id: string, direction: 'up' | 'down') => {
    reorderPainting(id, direction)
    loadPaintings()
  }

  const getPriceLabel = (painting: Painting) => {
    switch (painting.priceStatus) {
      case 'visible': return painting.price ? `${painting.price} €` : ''
      case 'sur_demande': return 'Sur demande'
      case 'vendu': return 'Vendu'
      case 'non_a_vendre': return 'Non à vendre'
    }
  }

  return (
    <div>
      {message && (
        <div className="mb-4 p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30">
          <p className="font-body text-sm text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}

      {paintings.length === 0 ? (
        <p className="font-body text-base text-warm-gray py-12 text-center">
          Aucun tableau pour le moment. Cliquez sur &quot;Ajouter un nouveau tableau&quot; pour commencer.
        </p>
      ) : (
        <div className="space-y-3">
          {paintings.map((painting, index) => (
            <div
              key={painting.id}
              className="flex items-center gap-4 p-4 bg-[var(--cream)] border border-[var(--border)] rounded"
            >
              {/* Thumbnail */}
              <div className="w-[60px] h-[60px] flex-shrink-0 bg-[var(--border)] overflow-hidden">
                <img
                  src={painting.imageUrl}
                  alt={painting.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-body text-base font-medium text-charcoal truncate">
                  {painting.title}
                </h3>
                <p className="font-body text-sm text-warm-gray">
                  {painting.year} · {painting.technique}
                </p>
              </div>

              {/* Price badge */}
              <span className="hidden sm:inline-block font-body text-xs px-3 py-1 bg-white border border-[var(--border)] text-warm-gray">
                {getPriceLabel(painting)}
              </span>

              {/* Reorder buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleReorder(painting.id, 'up')}
                  disabled={index === 0}
                  className="w-8 h-8 flex items-center justify-center border border-[var(--border)] bg-white text-charcoal disabled:opacity-30 hover:bg-[var(--cream)] transition-colors text-sm"
                  title="Monter"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleReorder(painting.id, 'down')}
                  disabled={index === paintings.length - 1}
                  className="w-8 h-8 flex items-center justify-center border border-[var(--border)] bg-white text-charcoal disabled:opacity-30 hover:bg-[var(--cream)] transition-colors text-sm"
                  title="Descendre"
                >
                  ↓
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(painting)}
                  className="px-4 py-2 font-body text-sm bg-white border border-[var(--border)] text-charcoal hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors min-h-[44px]"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setDeleteConfirm(painting.id)}
                  className="px-4 py-2 font-body text-sm bg-white border border-[var(--border)] text-[#C0392B] hover:border-[#C0392B] hover:bg-[#C0392B]/5 transition-colors min-h-[44px]"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white max-w-md w-full p-8 shadow-xl">
            <h3 className="font-body text-lg font-medium text-charcoal mb-4">
              Confirmer la suppression
            </h3>
            <p className="font-body text-base text-charcoal mb-6">
              Êtes-vous sûre de vouloir supprimer «&nbsp;
              <strong>{paintings.find((p) => p.id === deleteConfirm)?.title}</strong>
              &nbsp;» ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn-danger"
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
