'use client'

import { useRef, useState } from 'react'
import type { EventImage } from '@/lib/types'
import {
  compressImage,
  getCloudinarySettings,
  isTooBig,
  uploadToCloudinaryProgress,
} from '@/lib/cloudinary'
import PhotoPickerModal from './PhotoPickerModal'

interface Props {
  images: EventImage[]
  onChange: (images: EventImage[]) => void
  max?: number
}

const ALT_MAX = 120

interface Pending {
  id: number
  name: string
  progress: number
  error?: string
}

// Section « Photos » du formulaire d'événement : envoi multiple (bouton ou
// glisser-déposer), progression par fichier, erreur isolée par fichier,
// réordonnancement par boutons, description (alt) par photo, 10 maximum.
// La première photo est la couverture de l'événement.
export default function EventPhotosField({ images, onChange, max = 10 }: Props) {
  const [pending, setPending] = useState<Pending[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const counter = useRef(0)

  const settings = getCloudinarySettings()
  const remaining = max - images.length

  const update = (id: number, patch: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const done = (id: number) => setPending((list) => list.filter((p) => p.id !== id))

  const handleFiles = async (files: FileList | File[]) => {
    const all = Array.from(files)
    const slots = Math.max(0, max - images.length - pending.length)
    const picked = all.slice(0, slots)
    // Rejet visible pour chaque fichier au-delà du maximum (10 photos).
    all.slice(slots).forEach((file) => {
      const id = ++counter.current
      setPending((l) => [
        ...l,
        { id, name: file.name, progress: 0, error: `Ignorée — ${max} photos maximum.` },
      ])
    })
    for (const file of picked) {
      const id = ++counter.current
      if (!file.type.startsWith('image/')) {
        setPending((l) => [
          ...l,
          { id, name: file.name, progress: 0, error: "Ce fichier n'est pas une photo." },
        ])
        continue
      }
      setPending((l) => [...l, { id, name: file.name, progress: 0 }])
      try {
        const blob = await compressImage(file)
        if (isTooBig(blob)) {
          update(id, {
            error:
              'Photo trop lourde même réduite — recadrez-la puis renvoyez-la.',
          })
          continue
        }
        const r = await uploadToCloudinaryProgress(
          blob,
          settings!.cloudName,
          settings!.uploadPreset,
          (ratio) => update(id, { progress: Math.round(ratio * 100) })
        )
        done(id)
        onChange([
          // `images` peut avoir changé pendant l'envoi : on se base sur le
          // dernier état via le setter interne — onChange reçoit la liste
          // courante du parent, on ajoute en fin de file.
          ...imagesRef.current,
          { url: r.url, publicId: r.publicId, width: r.width, height: r.height, alt: '' },
        ])
      } catch {
        update(id, { error: "L'envoi a échoué — réessayez, rien n'a été perdu." })
      }
    }
  }

  // La liste de référence pour les ajouts asynchrones (un envoi peut durer
  // pendant que d'autres se terminent).
  const imagesRef = useRef(images)
  imagesRef.current = images

  const move = (index: number, dir: -1 | 1) => {
    const swap = index + dir
    if (swap < 0 || swap >= images.length) return
    const arr = [...images]
    ;[arr[index], arr[swap]] = [arr[swap], arr[index]]
    onChange(arr)
  }

  const setAlt = (index: number, alt: string) => {
    const arr = [...images]
    arr[index] = { ...arr[index], alt }
    onChange(arr)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="font-body text-sm font-medium text-[var(--ink)]">
          {images.length} / {max} photos
        </span>
        {images.length >= max && (
          <span className="font-body text-xs text-[var(--muted)]">
            Supprimez une photo pour en ajouter une autre.
          </span>
        )}
      </div>

      {/* Zone d'envoi multiple + sélection depuis la photothèque */}
      {remaining > 0 && (
        <div className="space-y-3">
          {settings ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
              }}
              className={`border-2 border-dashed transition-colors duration-200 ${
                dragOver
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40'
                  : 'border-[var(--line)] bg-[var(--surface)]'
              }`}
            >
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full min-h-[120px] flex flex-col items-center justify-center gap-2 p-5"
              >
                <span className="text-3xl" aria-hidden="true">📷</span>
                <span className="font-body text-base font-medium text-[var(--ink)]">
                  Envoyer une photo
                </span>
                <span className="font-body text-sm text-[var(--muted)] text-center">
                  Plusieurs à la fois, depuis le téléphone ou l&apos;ordinateur — ou
                  glissez-les ici.
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning-line)] rounded">
              <p className="font-body text-base text-[var(--warning-ink)]">
                ⚠️ L&apos;envoi de photos n&apos;est pas configuré. Contactez la personne
                qui s&apos;occupe du site.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn-secondary w-full min-h-[52px] text-base"
          >
            🗂 Choisir dans mes photos
          </button>
        </div>
      )}

      {/* Envois en cours / erreurs — une ligne par fichier */}
      {pending.length > 0 && (
        <div className="mt-4 space-y-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className={`p-3 border ${
                p.error
                  ? 'border-[var(--danger-line)] bg-[var(--danger-bg)]'
                  : 'border-[var(--line)] bg-[var(--surface)]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-sm text-[var(--ink)] truncate">{p.name}</p>
                {p.error ? (
                  <button
                    type="button"
                    onClick={() => done(p.id)}
                    className="font-body text-xs text-[var(--ink-soft)] underline min-h-[44px] flex-shrink-0"
                  >
                    Retirer
                  </button>
                ) : (
                  <span className="font-body text-xs text-[var(--muted)] flex-shrink-0">
                    {p.progress}%
                  </span>
                )}
              </div>
              {p.error ? (
                <p className="font-body text-sm text-[var(--danger)] mt-1">{p.error}</p>
              ) : (
                <div className="w-full h-1.5 bg-[var(--line)] overflow-hidden mt-2">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-200"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vignettes : ordre, suppression, description */}
      {images.length > 0 && (
        <div className="mt-5 space-y-3">
          {images.map((img, i) => (
            <div key={img.publicId || img.url} className="border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-[var(--line)] overflow-hidden flex-shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette admin */}
                  <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-[var(--ink)]">
                    Photo {i + 1}
                    {i === 0 && (
                      <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-[var(--accent-soft)] text-[var(--accent)] font-medium">
                        Couverture
                      </span>
                    )}
                  </p>
                  <p className="font-body text-xs text-[var(--muted)] mt-0.5">
                    {i === 0
                      ? 'Affichée en premier et en couverture de l’exposition.'
                      : 'Glissez-la en premier pour en faire la couverture.'}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Déplacer la photo ${i + 1} avant`}
                    className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    aria-label={`Déplacer la photo ${i + 1} après`}
                    className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(images.filter((_, j) => j !== i))}
                    aria-label={`Supprimer la photo ${i + 1}`}
                    className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--danger)] hover:border-[var(--danger)]"
                  >
                    🗑
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <input
                  type="text"
                  value={img.alt || ''}
                  maxLength={ALT_MAX}
                  onChange={(e) => setAlt(i, e.target.value)}
                  className="input-field text-base flex-1"
                  placeholder="Description de la photo — facultatif"
                  aria-label={`Description de la photo ${i + 1}`}
                />
                <span className="font-body text-xs text-[var(--muted)] flex-shrink-0" aria-hidden="true">
                  {(img.alt || '').length}/{ALT_MAX}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <PhotoPickerModal
        open={pickerOpen}
        mode="multiple"
        maxSelect={Math.max(1, remaining)}
        onClose={() => setPickerOpen(false)}
        onSelect={(chosen) => {
          const existingKeys = new Set(images.map((i) => i.publicId || i.url))
          const added = chosen
            .filter(
              (p) =>
                !existingKeys.has(p.public_id) &&
                !existingKeys.has(p.secure_url)
            )
            .slice(0, Math.max(0, max - images.length))
            .map((p) => ({
              url: p.secure_url,
              publicId: p.public_id,
              width: p.width > 0 ? p.width : undefined,
              height: p.height > 0 ? p.height : undefined,
              alt: '',
            }))
          if (added.length > 0) {
            onChange([...images, ...added])
          }
        }}
      />
    </div>
  )
}
