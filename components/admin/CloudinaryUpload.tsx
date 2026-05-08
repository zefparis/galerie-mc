'use client'

import { useState, useRef } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinary'

interface Props {
  currentUrl: string
  onUploaded: (url: string, publicId: string) => void
  cloudName: string
  uploadPreset: string
}

export default function CloudinaryUpload({ currentUrl, onUploaded, cloudName, uploadPreset }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(currentUrl)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Local preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Cloudinary
    setUploading(true)
    setError('')

    try {
      const result = await uploadToCloudinary(file, cloudName, uploadPreset)
      onUploaded(result.url, result.publicId)
      setPreview(result.url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'upload"
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary disabled:opacity-50"
        >
          {uploading ? 'Upload en cours...' : 'Choisir une photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-[#C0392B]/10 border border-[#C0392B]/30">
          <p className="font-body text-sm text-[#C0392B]">{error}</p>
        </div>
      )}

      {preview && (
        <div className="mt-4 w-48 h-48 bg-[var(--border)] overflow-hidden">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  )
}
