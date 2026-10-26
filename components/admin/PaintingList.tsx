'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getPaintings, deletePainting, reorderPainting, updatePainting, isSessionExpired, redirectToLogin } from '@/lib/storage'
import { Painting, PaintingCategory } from '@/lib/types'
import { CATEGORIES, CATEGORY_SHORT } from '@/lib/catalog'
import { FRAME_LABEL_FR } from '@/lib/frames'

interface Props {
  // La galerie de l'onglet actif est présélectionnée dans le formulaire.
  onAdd: (category?: PaintingCategory) => void
  onEdit: (painting: Painting) => void
}

type CategoryFilter = 'all' | PaintingCategory

const STATUS_LABEL: Record<Painting['priceStatus'], string> = {
  visible: 'Prix affiché',
  sur_demande: 'Sur demande',
  vendu: 'Vendue',
  non_a_vendre: 'Pas à vendre',
}

export default function PaintingList({ onAdd, onEdit }: Props) {
  const [paintings, setPaintings] = useState<Painting[]>([])
  const [search, setSearch] = useState('')
  const [technique, setTechnique] = useState<string | 'all'>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [moveTarget, setMoveTarget] = useState<PaintingCategory | null>(null)
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

  // Déplace un élément de `from` vers `to` — indices dans la liste affichée
  // (même catégorie, même tri que le site public). L'API permute au sein de
  // la catégorie, autant de fois que nécessaire, puis on recharge.
  const moveTo = async (from: number, to: number) => {
    if (from === to || busy) return
    const item = sortable[from]
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

  const toggleSelected = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
    setMoveTarget(null)
  }

  // Déplace les toiles cochées vers l'autre galerie (updatePainting envoie
  // la fiche complète — seule la catégorie change, rien d'autre n'est touché).
  const moveSelected = async () => {
    if (!moveTarget || selected.size === 0 || busy) return
    const count = selected.size
    const label = CATEGORIES.find((c) => c.value === moveTarget)?.label || ''
    setBusy(true)
    setError('')
    try {
      for (const p of paintings) {
        if (selected.has(p.id) && p.category !== moveTarget) {
          await updatePainting(p.id, { ...p, category: moveTarget })
        }
      }
      exitSelectMode()
      setMessage(`${count} toile${count > 1 ? 's' : ''} déplacée${count > 1 ? 's' : ''} vers « ${label} » ✓`)
      await loadPaintings()
      setTimeout(() => setMessage(''), 5000)
    } catch (err) {
      notifyError(err, 'Le déplacement a échoué — rien n\'a été perdu, réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const q = search.trim().toLowerCase()

  // Toiles de la catégorie affichée, dans l'ordre du site — c'est cette liste
  // que le réordonnancement (↑↓ / glisser-déposer) manipule.
  const sortable = paintings.filter((p) => category === 'all' || p.category === category)

  const filtered = sortable.filter((p) => {
    const matchQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      String(p.year).includes(q) ||
      p.technique.toLowerCase().includes(q)
    return matchQ && (technique === 'all' || p.technique === technique)
  })

  const availableTechniques = Array.from(new Set(sortable.map((p) => p.technique).filter(Boolean) as string[]))

  return (
    <div>
      <button
        onClick={() => onAdd(category === 'all' ? undefined : category)}
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
        <div className="mb-4 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
          <p className="font-body text-base text-[var(--danger)]">{error}</p>
        </div>
      )}

      {/* Recherche + filtres */}
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
          {/* Galerie */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide" role="group" aria-label="Filtrer par galerie">
            <button
              onClick={() => setCategory('all')}
              className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] border font-body text-sm transition-colors ${
                category === 'all'
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] text-[var(--ink-soft)]'
              }`}
            >
              Toutes ({paintings.length})
            </button>
            {CATEGORIES.map((c) => {
              const n = paintings.filter((p) => p.category === c.value).length
              return (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex-shrink-0 px-4 py-2.5 min-h-[44px] border font-body text-sm whitespace-nowrap transition-colors ${
                    category === c.value
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] text-[var(--ink-soft)]'
                  }`}
                >
                  {c.label} ({n})
                </button>
              )
            })}
          </div>
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="font-body text-sm text-[var(--muted)]">
              💡 Astuce : réordonnez avec les flèches ↑ ↓ (ou par glisser-déposer sur ordinateur).
            </p>
            <button
              onClick={selectMode ? exitSelectMode : () => setSelectMode(true)}
              className="font-body text-sm min-h-[44px] px-4 border border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
            >
              {selectMode ? 'Terminer la sélection' : 'Choisir plusieurs toiles'}
            </button>
          </div>

          {/* Barre d'action du mode sélection */}
          {selectMode && (
            <div className="mb-4 p-4 border border-[var(--accent)] bg-[var(--accent-soft)] space-y-3">
              <p className="font-body text-base text-[var(--ink)]">
                {selected.size === 0
                  ? 'Touchez les toiles à déplacer pour les cocher.'
                  : `${selected.size} toile${selected.size > 1 ? 's' : ''} cochée${selected.size > 1 ? 's' : ''}`}
              </p>
              {selected.size > 0 && !moveTarget && (
                <div className="flex flex-col sm:flex-row gap-2">
                  {CATEGORIES.filter(
                    (c) => category === 'all' || c.value !== category
                  ).map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setMoveTarget(c.value)}
                      disabled={busy}
                      className="btn-primary flex-1 text-base disabled:opacity-50"
                    >
                      Déplacer vers {c.label}
                    </button>
                  ))}
                </div>
              )}
              {moveTarget && (
                <div className="p-4 border border-[var(--accent)] bg-[var(--surface)]">
                  <p className="font-body text-base text-[var(--ink)]">
                    Déplacer {selected.size} toile{selected.size > 1 ? 's' : ''} vers{' '}
                    <strong>« {CATEGORIES.find((c) => c.value === moveTarget)?.label} »</strong> ?
                  </p>
                  <p className="font-body text-sm text-[var(--ink-soft)] mt-1">
                    Elles quitteront leur galerie actuelle — tout le reste reste identique.
                  </p>
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      onClick={() => setMoveTarget(null)}
                      autoFocus
                      className="btn-secondary w-full text-base"
                    >
                      Annuler — garder où elles sont
                    </button>
                    <button
                      onClick={moveSelected}
                      disabled={busy}
                      className="btn-accent w-full text-base disabled:opacity-50"
                    >
                      {busy ? 'Déplacement en cours...' : '✓ Oui, déplacer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {filtered.map((painting) => {
              const index = sortable.findIndex((p) => p.id === painting.id)
              return (
                <div
                  key={painting.id}
                  draggable={!search && technique === 'all' && !selectMode}
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
                  {/* Case à cocher en mode sélection */}
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelected(painting.id)}
                      aria-label={`${selected.has(painting.id) ? 'Décocher' : 'Cocher'} « ${painting.title} »`}
                      aria-pressed={selected.has(painting.id)}
                      className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                        selected.has(painting.id)
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-transparent'
                      }`}
                    >
                      <span className="text-xl" aria-hidden="true">✓</span>
                    </button>
                  )}

                  {/* Vignette */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-[var(--line)] overflow-hidden relative">
                    <Image
                      src={painting.imageUrl}
                      alt={painting.title}
                      fill
                      sizes="80px"
                      className="object-cover"
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
                    <span className="inline-block mt-1 ml-1.5 font-body text-xs px-2 py-0.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink-soft)]">
                      {CATEGORY_SHORT[painting.category || 'peintures']}
                    </span>
                    {painting.frame && (
                      <span className="inline-block mt-1 ml-1.5 font-body text-xs px-2 py-0.5 bg-[var(--accent-soft)] border border-[var(--accent)]/40 text-[var(--ink-soft)]">
                        Cadre : {FRAME_LABEL_FR[painting.frame] || 'personnalisé'}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {!selectMode && (
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
                        disabled={index === sortable.length - 1 || busy}
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
                        className="w-11 h-11 flex items-center justify-center border border-[var(--line)] bg-[var(--surface)] text-[var(--danger)] hover:border-[var(--danger)]"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  )}
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
            <div className="w-24 h-24 mx-auto bg-[var(--line)] overflow-hidden relative">
              <Image
                src={deleteTarget.imageUrl}
                alt={deleteTarget.title}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <h3 id="delete-title" className="font-display text-2xl text-center text-[var(--ink)] mt-4">
              Supprimer « {deleteTarget.title} » ?
            </h3>
            <p className="font-body text-base text-center text-[var(--danger)] font-medium mt-2">
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
                className="font-body text-sm text-[var(--danger)] underline min-h-[48px] hover:text-[var(--danger-hover)]"
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
