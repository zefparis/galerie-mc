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
        <div className="space-y-4">
          {paintings.map((painting, index) => (
            <div
              key={painting.id}
              className="bg-[var(--cream)] border border-[var(--border)] rounded overflow-hidden"
            >
              {/* Mobile: card layout */}
              <div className="flex items-start gap-3 p-3 sm:p-4">
                {/* Thumbnail with reorder */}
                <div className="relative flex-shrink-0">
                  <div className="w-[80px] h-[60px] sm:w-[100px] sm:h-[70px] bg-[var(--border)] overflow-hidden rounded">
                    <img
                      src={painting.imageUrl}
                      alt={painting.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-body text-sm sm:text-base font-medium text-charcoal line-clamp-2">
                    {painting.title}
                  </h3>
                  <p className="font-body text-xs sm:text-sm text-warm-gray mt-0.5">
                    {painting.year} · {painting.technique}
                  </p>
                  <span className="inline-block mt-1 font-body text-xs px-2 py-0.5 bg-white border border-[var(--border)] text-warm-gray">
                    {getPriceLabel(painting)}
                  </span>
                </div>

                {/* Reorder buttons */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleReorder(painting.id, 'up')}
                    disabled={index === 0}
                    className="w-9 h-9 flex items-center justify-center border border-[var(--border)] bg-white text-charcoal disabled:opacity-30 hover:bg-[var(--cream)] transition-colors text-sm rounded"
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleReorder(painting.id, 'down')}
                    disabled={index === paintings.length - 1}
                    className="w-9 h-9 flex items-center justify-center border border-[var(--border)] bg-white text-charcoal disabled:opacity-30 hover:bg-[var(--cream)] transition-colors text-sm rounded"
                    title="Descendre"
                  >
                    ↓
                  </button>
                </div>
              </div>

              {/* Action buttons — full width on mobile, inline on desktop */}
              <div className="flex flex-col sm:flex-row gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
                <button
                  onClick={() => onEdit(painting)}
                  className="flex-1 px-4 py-3 sm:py-2 font-body text-sm bg-white border border-[var(--border)] text-charcoal hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors min-h-[52px] sm:min-h-[44px] rounded"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setDeleteConfirm(painting.id)}
                  className="flex-1 px-4 py-3 sm:py-2 font-body text-sm bg-white border border-[var(--border)] text-[#C0392B] hover:border-[#C0392B] hover:bg-[#C0392B]/5 transition-colors min-h-[52px] sm:min-h-[44px] rounded"
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
            <p className="font-body text-base text-charcoal mb-4">
              Êtes-vous sûre de vouloir supprimer «&nbsp;
              <strong>{paintings.find((p) => p.id === deleteConfirm)?.title}</strong>
              &nbsp;» ? Cette action est irréversible.
            </p>
            <p className="font-body text-sm text-warm-gray mb-6">
              Note : L&apos;image reste sur Cloudinary — vous pouvez la supprimer manuellement depuis votre dashboard Cloudinary si nécessaire.
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
