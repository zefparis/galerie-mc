'use client'

import { useState, useRef } from 'react'
import { uploadToCloudinary, getCloudinarySettings } from '@/lib/cloudinary'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  currentUrl: string
  onUploaded: (url: string, publicId: string) => void
}

export default function CloudinaryUpload({ currentUrl, onUploaded }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  const settings = getCloudinarySettings()

  if (!settings) {
    return (
      <div className="p-4 bg-[#FFF8E1] border border-[#FFE082] rounded">
        <p className="font-body text-sm text-[#F57F17]">
          ⚠️ Cloudinary non configuré — allez dans <strong>Paramètres</strong> pour renseigner votre Cloud Name et Upload Preset.
        </p>
      </div>
    )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setError('Le fichier dépasse 10 MB. Veuillez choisir une image plus légère.')
      setStatus('error')
      return
    }

    // Preview immédiate via URL.createObjectURL
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    // Upload
    setStatus('uploading')
    setError('')

    try {
      const result = await uploadToCloudinary(file, settings.cloudName, settings.uploadPreset)
      onUploaded(result.url, result.publicId)
      setPreview(result.url)
      setStatus('success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'upload"
      setError(message)
      setStatus('error')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={status === 'uploading'}
          className="btn-primary w-full sm:w-auto min-h-[56px] sm:min-h-[44px] disabled:opacity-50"
        >
          {status === 'uploading' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Envoi en cours...
            </span>
          ) : 'Choisir une photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {status === 'success' && (
          <span className="font-body text-sm text-[#2D6A4F] font-medium">✓ Image envoyée</span>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-[#C0392B]/10 border border-[#C0392B]/30">
          <p className="font-body text-sm text-[#C0392B]">{error}</p>
        </div>
      )}

      {preview && (
        <div className="mt-4 w-full sm:w-48 aspect-[4/3] sm:aspect-square bg-[var(--border)] overflow-hidden rounded">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  )
}
