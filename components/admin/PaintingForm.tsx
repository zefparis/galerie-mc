'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { savePainting, getNextOrder } from '@/lib/storage'
import { Painting, Technique, PriceStatus } from '@/lib/types'
import CloudinaryUpload from './CloudinaryUpload'

const TECHNIQUES: Technique[] = [
  'Huile sur toile',
  'Acrylique',
  'Aquarelle',
  'Pastel',
  'Fusain',
  'Technique mixte',
  'Autre',
]

interface Props {
  painting: Painting | null
  onClose: () => void
}

export default function PaintingForm({ painting, onClose }: Props) {
  const isEditing = !!painting

  const [form, setForm] = useState({
    title: painting?.title || '',
    year: painting?.year || new Date().getFullYear(),
    technique: painting?.technique || ('Huile sur toile' as Technique),
    dimensions: painting?.dimensions || '',
    description: painting?.description || '',
    imageUrl: painting?.imageUrl || '',
    imagePublicId: painting?.imagePublicId || '',
    price: painting?.price || 0,
    priceStatus: painting?.priceStatus || ('sur_demande' as PriceStatus),
    featured: painting?.featured || false,
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setError('')
    setMessage('')

    if (!form.title.trim()) {
      setError('Le titre est obligatoire.')
      return
    }
    if (!form.year) {
      setError("L'année est obligatoire.")
      return
    }
    if (!form.technique) {
      setError('La technique est obligatoire.')
      return
    }

    setSaving(true)

    const paintingData: Painting = {
      id: painting?.id || uuidv4(),
      title: form.title.trim(),
      year: form.year,
      technique: form.technique,
      dimensions: form.dimensions.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl,
      imagePublicId: form.imagePublicId,
      price: form.priceStatus === 'visible' ? form.price : undefined,
      priceStatus: form.priceStatus,
      featured: form.featured,
      order: painting?.order || getNextOrder(),
      createdAt: painting?.createdAt || new Date().toISOString(),
    }

    savePainting(paintingData)
    setMessage(isEditing ? 'Tableau modifié avec succès !' : 'Tableau ajouté avec succès !')
    setSaving(false)

    setTimeout(() => {
      onClose()
    }, 1000)
  }

  const handleImageUploaded = (url: string, publicId: string) => {
    setForm({ ...form, imageUrl: url, imagePublicId: publicId })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-body text-xl font-medium text-charcoal">
          {isEditing ? `Modifier « ${painting.title} »` : 'Ajouter un nouveau tableau'}
        </h2>
        <button
          onClick={onClose}
          className="font-body text-sm text-warm-gray hover:text-charcoal"
        >
          ← Retour à la liste
        </button>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30">
          <p className="font-body text-base text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-[#C0392B]/10 border border-[#C0392B]/30">
          <p className="font-body text-base text-[#C0392B] font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Image upload */}
        <div>
          <label className="label-field">📷 Photo du tableau *</label>
          <CloudinaryUpload
            currentUrl={form.imageUrl}
            onUploaded={handleImageUploaded}
          />
        </div>

        {/* Title */}
        <div>
          <label className="label-field">📝 Titre du tableau *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-field"
            placeholder="Titre de l'œuvre"
          />
        </div>

        {/* Year */}
        <div>
          <label className="label-field">📅 Année *</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })}
            className="input-field w-32"
            min={1900}
            max={2100}
          />
        </div>

        {/* Technique */}
        <div>
          <label className="label-field">🎨 Technique *</label>
          <select
            value={form.technique}
            onChange={(e) => setForm({ ...form, technique: e.target.value as Technique })}
            className="input-field"
          >
            {TECHNIQUES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Dimensions */}
        <div>
          <label className="label-field">📐 Dimensions</label>
          <input
            type="text"
            value={form.dimensions}
            onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
            className="input-field"
            placeholder="ex: 80 × 60 cm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="label-field">💬 Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field min-h-[120px] resize-y"
            rows={5}
            placeholder="Description de l'œuvre (optionnel)"
          />
        </div>

        {/* Price */}
        <div>
          <label className="label-field">💰 Prix</label>
          <div className="space-y-3 mt-2">
            {[
              { value: 'visible', label: 'Afficher le prix' },
              { value: 'sur_demande', label: 'Prix sur demande' },
              { value: 'vendu', label: 'Vendu' },
              { value: 'non_a_vendre', label: 'Non à vendre' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="priceStatus"
                  value={option.value}
                  checked={form.priceStatus === option.value}
                  onChange={(e) => setForm({ ...form, priceStatus: e.target.value as PriceStatus })}
                  className="w-5 h-5 accent-[#2D6A4F]"
                />
                <span className="font-body text-base text-charcoal">{option.label}</span>
              </label>
            ))}
          </div>
          {form.priceStatus === 'visible' && (
            <div className="mt-4">
              <label className="label-field">Montant en euros</label>
              <input
                type="number"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                className="input-field w-40"
                placeholder="0"
                min={0}
              />
            </div>
          )}
        </div>

        {/* Featured */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              className="w-5 h-5 accent-[#2D6A4F]"
            />
            <span className="font-body text-base text-charcoal">
              ⭐ Mettre en avant sur la page d&apos;accueil
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-6 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.imageUrl}
            className="btn-primary text-lg px-8 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Enregistrer le tableau'}
          </button>
        </div>
      </div>
    </div>
  )
}
