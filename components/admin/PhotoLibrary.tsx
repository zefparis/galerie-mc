'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdminPhoto, AdminPhotosResponse } from '@/lib/types'
import { cloudinaryUrl } from '@/lib/images'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'

export type UsageFilter = 'all' | 'unused' | 'used'

interface PhotoLibraryProps {
  /** Mode « page » (/admin/photos) : clic sur une vignette ouvre le grand
   *  aperçu avec le bouton « Créer une toile avec cette photo ».
   *  Mode « single » (toile) : sélection d'une photo.
   *  Mode « multiple » (exposition) : sélection jusqu'à maxSelect photos. */
  mode?: 'page' | 'single' | 'multiple'
  maxSelect?: number
  onCreatePainting?: (photo: AdminPhoto) => void
  onSelectPhotos?: (photos: AdminPhoto[]) => void
  onCancelPicker?: () => void
}

function shortName(publicId: string): string {
  const parts = publicId.split('/')
  return parts[parts.length - 1] || publicId
}

function formatPhotoDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function thumbnailUrl(secureUrl: string): string {
  return cloudinaryUrl(secureUrl, 'c_fill,w_400,q_auto,f_auto')
}

export function previewLargeUrl(secureUrl: string): string {
  return cloudinaryUrl(secureUrl, 'f_auto,q_auto,w_1200,c_limit')
}

export default function PhotoLibrary({
  mode = 'page',
  maxSelect = 1,
  onCreatePainting,
  onSelectPhotos,
  onCancelPicker,
}: PhotoLibraryProps) {
  const [photos, setPhotos] = useState<AdminPhoto[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState<UsageFilter>('all')
  const [search, setSearch] = useState('')

  // En mode « page » : photo ouverte en grand aperçu (modale détail).
  const [activePhoto, setActivePhoto] = useState<AdminPhoto | null>(null)
  const lastClickedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const detailCloseBtnRef = useRef<HTMLButtonElement | null>(null)
  const detailDialogRef = useRef<HTMLDivElement | null>(null)

  // En mode « single » ou « multiple » : photos cochées.
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [limitNotice, setLimitNotice] = useState('')

  const loadPage = useCallback(async (cursor?: string) => {
    const isFirst = !cursor
    if (isFirst) {
      setLoading(true)
      setError('')
    } else {
      setLoadingMore(true)
    }

    try {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
      const res = await fetch(`/api/admin/photos${qs}`)
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      if (!res.ok) {
        throw new Error('fetch-failed')
      }
      const data = (await res.json()) as AdminPhotosResponse
      setConfigured(data.configured)
      setNextCursor(data.nextCursor || null)
      setPhotos((prev) => {
        if (isFirst) return data.photos || []
        const seen = new Set(prev.map((p) => p.public_id))
        const added = (data.photos || []).filter((p) => !seen.has(p.public_id))
        return [...prev, ...added]
      })
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError(
        "Je n'arrive pas à joindre votre espace photos, réessayez dans un instant."
      )
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  // Gestion du focus et de la touche Échap pour la modale de détail (mode page).
  useEffect(() => {
    if (!activePhoto) return
    const prevFocus = lastClickedTriggerRef.current
    const t = setTimeout(() => detailCloseBtnRef.current?.focus(), 20)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setActivePhoto(null)
        return
      }
      if (e.key === 'Tab' && detailDialogRef.current) {
        const focusables = detailDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
      prevFocus?.focus()
    }
  }, [activePhoto])

  const filteredPhotos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return photos.filter((p) => {
      if (filter === 'unused' && p.used) return false
      if (filter === 'used' && !p.used) return false
      if (q && !p.public_id.toLowerCase().includes(q)) return false
      return true
    })
  }, [photos, filter, search])

  const countLabel = `${filteredPhotos.length} photo${filteredPhotos.length > 1 ? 's' : ''}`

  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => photos.find((p) => p.public_id === id))
        .filter((p): p is AdminPhoto => !!p),
    [selectedIds, photos]
  )

  const handleCardClick = (photo: AdminPhoto, btn: HTMLButtonElement) => {
    if (mode === 'page') {
      lastClickedTriggerRef.current = btn
      setActivePhoto(photo)
      return
    }

    setLimitNotice('')
    if (mode === 'single') {
      setSelectedIds((prev) =>
        prev[0] === photo.public_id ? [] : [photo.public_id]
      )
      return
    }

    // Mode multiple
    setSelectedIds((prev) => {
      if (prev.includes(photo.public_id)) {
        return prev.filter((id) => id !== photo.public_id)
      }
      if (prev.length >= maxSelect) {
        setLimitNotice(
          `Vous pouvez choisir au maximum ${maxSelect} photo${maxSelect > 1 ? 's' : ''}.`
        )
        return prev
      }
      return [...prev, photo.public_id]
    })
  }

  const handleConfirmSelection = () => {
    if (!selectedPhotos.length) return
    onSelectPhotos?.(selectedPhotos)
  }

  if (loading) {
    return (
      <div className="py-12 text-center" role="status" aria-live="polite">
        <p className="font-body text-base text-[var(--ink-soft)]">
          Chargement de vos photos…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="p-6 bg-[var(--danger-bg)] border border-[var(--danger-line)]"
        role="alert"
      >
        <p className="font-body text-base text-[var(--danger)]">{error}</p>
        <button
          type="button"
          onClick={() => loadPage()}
          className="btn-secondary mt-4 text-sm min-h-[48px]"
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (configured === false) {
    return (
      <div
        className="p-6 bg-[var(--warning-bg)] border border-[var(--warning-line)]"
        role="status"
      >
        <p className="font-body text-lg font-medium text-[var(--warning-ink)]">
          Photothèque non configurée
        </p>
        <p className="font-body text-sm text-[var(--warning-ink)] mt-2">
          Les clés de lecture de votre espace photo ne sont pas encore
          configurées sur le serveur. Vous pouvez toujours envoyer une photo
          depuis votre appareil.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Barre de filtres en pastilles + recherche + compteur */}
      <div className="space-y-4 mb-6">
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filtrer les photos"
        >
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'unused', label: 'Pas encore utilisées sur le site' },
              { id: 'used', label: 'Utilisées' },
            ] as const
          ).map((pill) => {
            const active = filter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(pill.id)}
                className={`filter-pill ${active ? 'is-active' : ''}`}
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="photo-lib-search" className="sr-only">
              Rechercher par nom de fichier
            </label>
            <input
              id="photo-lib-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom de fichier…"
              className="input-field pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            )}
          </div>

          <p
            className="font-body text-sm font-medium text-[var(--ink-soft)]"
            aria-live="polite"
          >
            {countLabel}
          </p>
        </div>
      </div>

      {limitNotice && (
        <div
          className="mb-4 p-3 bg-[var(--warning-bg)] border border-[var(--warning-line)]"
          role="status"
        >
          <p className="font-body text-sm text-[var(--warning-ink)]">
            {limitNotice}
          </p>
        </div>
      )}

      {/* Grille de vignettes */}
      {filteredPhotos.length === 0 ? (
        <div className="p-8 border border-[var(--line)] bg-[var(--surface)] text-center">
          <p className="font-body text-base text-[var(--ink-soft)]">
            {photos.length === 0
              ? 'Aucune photo dans votre espace pour le moment.'
              : filter === 'unused'
                ? "Toutes vos photos affichées sont déjà utilisées sur le site."
                : 'Aucune photo ne correspond à votre recherche.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredPhotos.map((photo) => {
            const name = shortName(photo.public_id)
            const selectedIndex = selectedIds.indexOf(photo.public_id)
            const isSelected = selectedIndex !== -1
            const statusText =
              photo.used && photo.usedBy.length > 0
                ? `Utilisée par : ${photo.usedBy.join(', ')}`
                : 'Pas encore utilisée'

            return (
              <button
                key={photo.public_id}
                type="button"
                aria-pressed={mode !== 'page' ? isSelected : undefined}
                aria-label={`${name} — ${statusText}`}
                onClick={(e) => handleCardClick(photo, e.currentTarget)}
                className={`group text-left border transition-all duration-150 bg-[var(--surface)] flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isSelected
                    ? 'border-2 border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                    : 'border-[var(--line)] hover:border-[var(--ink-soft)]'
                }`}
              >
                <div className="relative w-full aspect-square bg-[var(--line)] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette Cloudinary admin */}
                  <img
                    src={thumbnailUrl(photo.secure_url)}
                    alt={name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  {/* Pastille d'état d'utilisation */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-body font-medium rounded-sm ${
                      photo.used
                        ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] shadow-sm'
                        : 'bg-[var(--accent)] text-[var(--on-accent)]'
                    }`}
                  >
                    {photo.used ? 'Utilisée' : 'Disponible'}
                  </span>

                  {/* Coche de sélection en mode sélecteur */}
                  {mode !== 'page' && (
                    <span
                      aria-hidden="true"
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-body font-bold border shadow-sm ${
                        isSelected
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]'
                          : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)]'
                      }`}
                    >
                      {isSelected
                        ? mode === 'multiple'
                          ? selectedIndex + 1
                          : '✓'
                        : ''}
                    </span>
                  )}
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between gap-1">
                  <p className="font-body text-xs font-medium text-[var(--ink)] truncate">
                    {name}
                  </p>
                  <p className="font-body text-[11px] text-[var(--muted)] truncate">
                    {statusText}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Chargement progressif */}
      {nextCursor && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => loadPage(nextCursor)}
            disabled={loadingMore}
            className="btn-secondary min-h-[48px] px-6 text-base"
          >
            {loadingMore ? 'Chargement…' : 'Voir plus de photos'}
          </button>
        </div>
      )}

      {/* Barre d'action en mode sélecteur (single / multiple) */}
      {mode !== 'page' && (
        <div className="sticky bottom-0 z-10 mt-6 pt-4 pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-[var(--bg)] border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-body text-sm text-[var(--ink-soft)]">
            {selectedPhotos.length === 0 ? (
              <span>Touchez une photo pour la choisir.</span>
            ) : mode === 'single' ? (
              <span>
                Photo choisie :{' '}
                <strong className="text-[var(--ink)]">
                  {shortName(selectedPhotos[0].public_id)}
                </strong>
                {selectedPhotos[0].width > 0 && selectedPhotos[0].height > 0 && (
                  <>
                    {' '}
                    ({selectedPhotos[0].width} × {selectedPhotos[0].height} px)
                  </>
                )}
              </span>
            ) : (
              <span>
                <strong className="text-[var(--ink)]">
                  {selectedPhotos.length} photo
                  {selectedPhotos.length > 1 ? 's' : ''}
                </strong>{' '}
                sélectionnée{selectedPhotos.length > 1 ? 's' : ''} (max{' '}
                {maxSelect})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onCancelPicker && (
              <button
                type="button"
                onClick={onCancelPicker}
                className="btn-secondary min-h-[48px] px-4 text-sm"
              >
                Annuler
              </button>
            )}
            <button
              type="button"
              disabled={selectedPhotos.length === 0}
              onClick={handleConfirmSelection}
              className="btn-accent min-h-[48px] px-6 text-base disabled:opacity-40"
            >
              {mode === 'multiple' && selectedPhotos.length > 1
                ? `✓ Choisir ces ${selectedPhotos.length} photos`
                : '✓ Choisir cette photo'}
            </button>
          </div>
        </div>
      )}

      {/* Modale de détail en mode page (/admin/photos) */}
      {mode === 'page' && activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setActivePhoto(null)}
        >
          <div
            ref={detailDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-detail-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[var(--bg)] border border-[var(--line)] p-5 sm:p-6 my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2
                  id="photo-detail-title"
                  className="font-display text-2xl text-[var(--ink)] truncate"
                >
                  {shortName(activePhoto.public_id)}
                </h2>
                <p className="font-body text-xs text-[var(--muted)] truncate mt-0.5">
                  {activePhoto.public_id}
                </p>
              </div>
              <button
                ref={detailCloseBtnRef}
                type="button"
                onClick={() => setActivePhoto(null)}
                aria-label="Fermer l'aperçu"
                className="min-h-[44px] min-w-[44px] px-3 border border-[var(--line)] font-body text-sm text-[var(--ink)] hover:border-[var(--ink)]"
              >
                Fermer ✕
              </button>
            </div>

            <div className="w-full bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- grand aperçu admin */}
              <img
                src={previewLargeUrl(activePhoto.secure_url)}
                alt={shortName(activePhoto.public_id)}
                className="w-full h-auto max-h-[52vh] object-contain"
              />
            </div>

            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[var(--surface)] border border-[var(--line)] font-body text-sm">
              <div>
                <dt className="text-xs text-[var(--muted)]">État sur le site</dt>
                <dd className="text-[var(--ink)] font-medium mt-0.5">
                  {activePhoto.used && activePhoto.usedBy.length > 0
                    ? `Utilisée par : ${activePhoto.usedBy.join(', ')}`
                    : 'Pas encore utilisée'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Dimensions</dt>
                <dd className="text-[var(--ink)] mt-0.5">
                  {activePhoto.width > 0 && activePhoto.height > 0
                    ? `${activePhoto.width} × ${activePhoto.height} px`
                    : 'Non renseignées'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Date d&apos;envoi</dt>
                <dd className="text-[var(--ink)] mt-0.5">
                  {formatPhotoDate(activePhoto.created_at) || '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="btn-secondary min-h-[48px] px-5 text-sm"
              >
                Retour aux photos
              </button>
              {onCreatePainting && (
                <button
                  type="button"
                  onClick={() => {
                    const chosen = activePhoto
                    setActivePhoto(null)
                    onCreatePainting(chosen)
                  }}
                  className="btn-accent min-h-[48px] px-6 text-base"
                >
                  ＋ Créer une toile avec cette photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
