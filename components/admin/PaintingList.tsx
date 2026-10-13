'use client'

import { useEffect, useState } from 'react'
import { getPaintings, deletePainting, reorderPainting, isSessionExpired, redirectToLogin } from '@/lib/storage'
import { Painting, Technique } from '@/lib/types'

interface Props {
  onAdd: () => void
  onEdit: (painting: Painting) => void
}

const TECHNIQUES: Technique[] = [
  'Huile sur toile', 'Acrylique', 'Aquarelle', 'Pastel', 'Fusain', 'Technique mixte', 'Autre',
]

const STATUS_LABEL: Record<Painting['priceStatus'], string> = {
  visible: 'Prix affiché',
  sur_demande: 'Sur demande',
  vendu: 'Vendue',
  non_a_vendre: 'Pas à vendre',
}

export default function PaintingList({ onAdd, onEdit }: Props) {
  const [paintings, setPaintings] = useState<Painting[]>([])
  const [search, setSearch] = useState('')
  const [technique, setTechnique] = useState<Technique | 'all'>('all')
  const [deleteTarget, setDeleteTarget] = useState<Painting | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  useEffect(() => {
    loadPaintings()
  }, [])

  const loadPaintings = async () => {
    try {
      setPaintings(await getPaintings())
    } catch {
      setError('Impossible de charger vos toiles. Vérifiez votre connexion.')
    }
  }

  const notifyError = (err: unknown, fallback: string) => {
    if (isSessionExpired(err)) {
      redirectToLogin()
      return
    }
    setError(err instanceof Error ? err.message : fallback)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setError('')
    try {
      await deletePainting(deleteTarget.id)
      setDeleteTarget(null)
      setMessage(`« ${deleteTarget.title} » a été supprimée.`)
      await loadPaintings()
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setDeleteTarget(null)
      notifyError(err, 'La suppression a échoué. Réessayez.')
    }
  }

  // Déplace un élément de `from` vers `to` — utilise l'API de permutation
  // autant de fois que nécessaire, puis recharge.
  const moveTo = async (from: number, to: number) => {
    if (from === to || busy) return
    const item = paintings[from]
    if (!item) return
    setBusy(true)
    setError('')
    try {
      const steps = Math.abs(to - from)
      const direction = to < from ? 'up' : 'down'
      for (let i = 0; i < steps; i++) {
        await reorderPainting(item.id, direction as 'up' | 'down')
      }
      await loadPaintings()
    } catch (err) {
      notifyError(err, 'Le déplacement a échoué. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const availableTechniques = TECHNIQUES.filter((t) =>
    paintings.some((p) => p.technique === t)
  )

  const q = search.trim().toLowerCase()
  const filtered = paintings.filter((p) => {
    const matchQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      String(p.year).includes(q) ||
      p.technique.toLowerCase().includes(q)
    return matchQ && (technique === 'all' || p.technique === technique)
  })

  return (
    <div>
      <button
        onClick={onAdd}
        className="btn-primary w-full text-lg mb-6"
      >
        + Ajouter une toile
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

      {/* Recherche + filtre */}
      {paintings.length > 0 && (
        <div className="space-y-3 mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            placeholder="🔍 Rechercher une toile..."
            aria-label="Rechercher une toile"
          />
          {availableTechniques.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
              <button
                onClick={() => setTechnique('all')}
                className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] border font-body text-sm transition-colors ${
                  technique === 'all'
                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] text-[var(--ink-soft)]'
                }`}
              >
                Toutes
              </button>
              {availableTechniques.map((t) => (
                <button
                  key={t}
                  onClick={() => setTechnique(t)}
                  className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] border font-body text-sm whitespace-nowrap transition-colors ${
                    technique === t
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] text-[var(--ink-soft)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {paintings.length === 0 ? (
        <div className="text-center py-14 px-4 border border-dashed border-[var(--line)] bg-[var(--surface)]">
          <p className="font-body text-lg text-[var(--ink-soft)]">
            Vous n&apos;avez pas encore de toile en ligne.
          </p>
          <p className="font-body text-base text-[var(--muted)] mt-2">
            Touchez « + Ajouter une toile » pour commencer — je vous guide pas à pas.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center font-body text-base text-[var(--muted)] py-14">
          Aucune toile ne correspond à « {search} ».
        </p>
      ) : (
        <>
          <p className="font-body text-sm text-[var(--muted)] mb-4">
            💡 Astuce : réordonnez avec les flèches ↑ ↓ (ou par glisser-déposer sur ordinateur).
          </p>
          <div className="space-y-3">
            {filtered.map((painting) => {
              const index = paintings.findIndex((p) => p.id === painting.id)
              return (
                <div
                  key={painting.id}
                  draggable={!search && technique === 'all'}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(index) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex !== null) moveTo(dragIndex, index)
                    setDragIndex(null)
                    setDragOver(null)
                  }}
                  onDragEnd={() => { setDragIndex(null); setDragOver(null) }}
                  className={`flex items-center gap-3 p-3 border bg-[var(--surface)] transition-colors ${
                    dragOver === index ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                  } ${dragIndex === index ? 'opacity-40' : ''}`}
                >
                  {/* Vignette */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-[var(--line)] overflow-hidden">
                    <img
                      src={painting.imageUrl}
                      alt={painting.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-body text-base font-medium text-[var(--ink)] truncate">
                      {painting.title}
                    </h3>
                    <p className="font-body text-sm text-[var(--ink-soft)] mt-0.5">
                      {painting.year} · {painting.technique}
                    </p>
                    <span className="inline-block mt-1 font-body text-xs px-2 py-0.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
                      {STATUS_LABEL[painting.priceStatus]}
                      {painting.featured ? ' · ⭐ accueil' : ''}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => moveTo(index, index - 1)}
                        disabled={index === 0 || busy}
                        aria-label={`Monter « ${painting.title} »`}
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-25 hover:border-[var(--accent)] text-lg"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveTo(index, index + 1)}
                        disabled={index === paintings.length - 1 || busy}
                        aria-label={`Descendre « ${painting.title} »`}
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-25 hover:border-[var(--accent)] text-lg"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onEdit(painting)}
                        className="flex-1 h-11 px-3 border border-[var(--line)] bg-[var(--surface)] font-body text-sm text-[var(--ink)] hover:border-[var(--accent)]"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget(painting)}
                        aria-label={`Supprimer « ${painting.title} »`}
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[#B3402F] hover:border-[#B3402F]"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Confirmation de suppression — vignette + Annuler mis en avant */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-5"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className="bg-[var(--surface)] max-w-md w-full p-6 sm:p-8 shadow-xl">
            <div className="w-24 h-24 mx-auto bg-[var(--line)] overflow-hidden">
              <img
                src={deleteTarget.imageUrl}
                alt={deleteTarget.title}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 id="delete-title" className="font-display text-2xl text-center text-[var(--ink)] mt-4">
              Supprimer « {deleteTarget.title} » ?
            </h3>
            <p className="font-body text-base text-center text-[#B3402F] font-medium mt-2">
              Cette action est définitive.
            </p>
            <p className="font-body text-sm text-center text-[var(--muted)] mt-2">
              La photo restera conservée sur Cloudinary.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                autoFocus
                className="btn-primary w-full text-base"
              >
                Annuler — garder la toile
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
