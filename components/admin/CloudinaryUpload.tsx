'use client'

import { useState, useRef } from 'react'
import { uploadToCloudinaryProgress, compressImage, isTooBig, getCloudinarySettings } from '@/lib/cloudinary'

interface Props {
  currentUrl: string
  onUploaded: (url: string, publicId: string, width?: number, height?: number) => void
  /** URL locale (blob:) du fichier choisi, avant la fin de l'envoi —
      utilisée par l'aperçu en direct. '' quand elle n'est plus d'actualité. */
  onLocalPreview?: (url: string) => void
}

type Status = 'idle' | 'preparing' | 'uploading' | 'success' | 'error'

// Grande zone tactile : choix de photo, réduction automatique des grosses
// photos de téléphone, barre de progression réelle.
export default function CloudinaryUpload({ currentUrl, onUploaded, onLocalPreview }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  const settings = getCloudinarySettings()

  if (!settings) {
    return (
      <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning-line)] rounded">
        <p className="font-body text-base text-[var(--warning-ink)]">
          ⚠️ L&apos;envoi de photos n&apos;est pas configuré. Contactez la personne
          qui s&apos;occupe du site.
        </p>
      </div>
    )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-choisir le même fichier
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError("Ce fichier n'est pas une photo. Choisissez une image.")
      setStatus('error')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    onLocalPreview?.(objectUrl)
    setError('')
    setStatus('preparing')

    try {
      // Réduction automatique des grosses photos de téléphone
      const blob = await compressImage(file)
      if (isTooBig(blob)) {
        setStatus('error')
        setError('La photo est vraiment trop lourde. Essayez de la recadrer dans votre galerie photo, puis renvoyez-la.')
        setPreview('')
        onLocalPreview?.('')
        return
      }

      setStatus('uploading')
      setProgress(0)
      const result = await uploadToCloudinaryProgress(
        blob,
        settings.cloudName,
        settings.uploadPreset,
        (ratio) => setProgress(Math.round(ratio * 100))
      )
      onUploaded(result.url, result.publicId, result.width, result.height)
      setPreview(result.url)
      onLocalPreview?.('')
      setStatus('success')
    } catch {
      setStatus('error')
      setError("L'envoi de la photo a échoué. Vérifiez votre connexion internet et réessayez — rien n'a été perdu.")
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={status === 'uploading' || status === 'preparing'}
          className="w-full min-h-[160px] sm:min-h-[200px] border-2 border-dashed border-[var(--line)] bg-[var(--surface)] flex flex-col items-center justify-center gap-3 p-6 transition-colors duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/30 disabled:opacity-60"
        >
          {status === 'preparing' ? (
            <>
              <span className="text-3xl" aria-hidden="true">⏳</span>
              <span className="font-body text-lg text-[var(--ink)]">Préparation de la photo...</span>
            </>
          ) : status === 'uploading' ? (
            <>
              <span className="text-3xl" aria-hidden="true">📤</span>
              <span className="font-body text-lg text-[var(--ink)]">Envoi en cours... {progress}%</span>
              <span className="w-full max-w-xs h-2 bg-[var(--line)] overflow-hidden">
                <span
                  className="block h-full bg-[var(--accent)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </span>
            </>
          ) : (
            <>
              <span className="text-4xl" aria-hidden="true">📷</span>
              <span className="font-body text-lg font-medium text-[var(--ink)]">
                Touchez ici pour choisir une photo
              </span>
              <span className="font-body text-sm text-[var(--muted)]">
                Depuis votre téléphone ou votre ordinateur
              </span>
            </>
          )}
        </button>
      ) : (
        <div>
          <div className="w-full sm:max-w-md bg-[var(--line)] overflow-hidden">
            <img src={preview} alt="Aperçu de la photo choisie" className="w-full h-auto max-h-80 object-contain bg-[var(--surface)]" />
          </div>
          {status === 'uploading' && (
            <div className="mt-3">
              <p className="font-body text-base text-[var(--ink-soft)]">Envoi en cours... {progress}%</p>
              <div className="w-full max-w-md h-2 bg-[var(--line)] overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {status === 'success' && (
            <p className="mt-3 font-body text-base font-medium text-[var(--accent)]">
              ✓ Photo envoyée
            </p>
          )}
          {status !== 'uploading' && status !== 'preparing' && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-outline mt-4 text-sm"
            >
              Changer la photo
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
          <p className="font-body text-base text-[var(--danger)]">{error}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary mt-3 text-sm"
          >
            Réessayer avec une autre photo
          </button>
        </div>
      )}
    </div>
  )
}
