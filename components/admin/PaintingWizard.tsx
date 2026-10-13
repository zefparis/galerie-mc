'use client'

import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { savePainting, updatePainting, getNextOrder, isSessionExpired, redirectToLogin } from '@/lib/storage'
import { Painting, Technique, PriceStatus } from '@/lib/types'
import CloudinaryUpload from './CloudinaryUpload'
import HelpTip from './HelpTip'

const TECHNIQUES: Technique[] = [
  'Huile sur toile',
  'Acrylique',
  'Aquarelle',
  'Pastel',
  'Fusain',
  'Technique mixte',
  'Autre',
]

const PRICE_OPTIONS: { value: PriceStatus; label: string }[] = [
  { value: 'visible', label: 'Afficher le prix' },
  { value: 'sur_demande', label: 'Prix sur demande' },
  { value: 'vendu', label: 'Vendue' },
  { value: 'non_a_vendre', label: 'Pas à vendre' },
]

const PRICE_PREVIEW: Record<PriceStatus, (p?: number) => string> = {
  visible: (p) => (p ? `${new Intl.NumberFormat('fr-FR').format(p)} €` : 'Prix affiché'),
  sur_demande: () => 'Prix sur demande',
  vendu: () => 'Vendu',
  non_a_vendre: () => '',
}

const STEPS = ['La photo', 'Les informations', 'Vérification']

interface Props {
  painting: Painting | null // null = nouvelle toile
  onDone: (message: string) => void
  onCancel: () => void
}

interface Draft {
  step: number
  form: {
    title: string
    year: number
    technique: Technique
    dimensions: string
    description: string
    imageUrl: string
    imagePublicId: string
    price: number
    priceStatus: PriceStatus
    featured: boolean
  }
}

export default function PaintingWizard({ painting, onDone, onCancel }: Props) {
  const isEditing = !!painting
  const draftKey = `mc-draft-painting-${painting?.id || 'new'}`

  const [step, setStep] = useState(1)
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
  const [draftFound, setDraftFound] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const restored = useRef(false)

  // Récupération du brouillon automatique
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const draft = JSON.parse(raw) as Draft
      if (draft?.form && (draft.form.title || draft.form.imageUrl)) {
        setForm(draft.form)
        setStep(draft.step || 1)
        setDraftFound(true)
      }
    } catch {
      // brouillon illisible — on l'ignore
    }
  }, [draftKey])

  // Sauvegarde automatique du brouillon à chaque modification
  useEffect(() => {
    if (isEditing) return // pas de brouillon en modification, seulement en création
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ step, form }))
      } catch { /* stockage plein — non bloquant */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form, step, draftKey, isEditing])

  const discardDraft = () => {
    localStorage.removeItem(draftKey)
    setDraftFound(false)
    setForm({
      title: '',
      year: new Date().getFullYear(),
      technique: 'Huile sur toile',
      dimensions: '',
      description: '',
      imageUrl: '',
      imagePublicId: '',
      price: 0,
      priceStatus: 'sur_demande',
      featured: false,
    })
    setStep(1)
  }

  const canContinue = step === 1 ? !!form.imageUrl : step === 2 ? !!form.title.trim() : true

  const handlePublish = async () => {
    setError('')
    setSaving(true)
    try {
      const order = painting?.order || (await getNextOrder())
      const data: Painting = {
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
        order,
        createdAt: painting?.createdAt || new Date().toISOString(),
      }

      if (isEditing) {
        await updatePainting(data.id, data)
      } else {
        await savePainting(data)
      }
      localStorage.removeItem(draftKey)
      onDone(isEditing ? 'Modifications enregistrées ✓' : 'Votre toile est en ligne ✓')
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError("Une erreur est survenue — rien n'a été perdu. Réessayez.")
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Barre de progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="font-body text-sm font-medium text-[var(--ink)]">
            Étape {step} sur 3 — {STEPS[step - 1]}
          </p>
          <button
            onClick={onCancel}
            className="font-body text-sm text-[var(--muted)] hover:text-[var(--ink)] min-h-[44px] px-2"
          >
            Annuler
          </button>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 transition-colors duration-300 ${
                i < step ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Brouillon retrouvé */}
      {draftFound && (
        <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="font-body text-base text-[var(--ink)]">
            J&apos;ai retrouvé le brouillon que vous aviez commencé.
          </p>
          <button
            onClick={discardDraft}
            className="font-body text-sm text-[var(--ink-soft)] underline min-h-[44px] text-left sm:text-right"
          >
            Recommencer à zéro
          </button>
        </div>
      )}

      {/* ─── Étape 1 : la photo ─── */}
      {step === 1 && (
        <div>
          <h2 className="font-display text-3xl text-[var(--ink)] mb-2">
            Choisissez la photo de votre toile
          </h2>
          <p className="font-body text-base text-[var(--ink-soft)] mb-6">
            Une photo nette, prise de face, avec une belle lumière. Elle sera
            automatiquement allégée si elle est lourde.
          </p>
          <CloudinaryUpload
            currentUrl={form.imageUrl}
            onUploaded={(url, publicId) => setForm({ ...form, imageUrl: url, imagePublicId: publicId })}
          />
        </div>
      )}

      {/* ─── Étape 2 : les informations ─── */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-3xl text-[var(--ink)] mb-2">
            Dites-en un peu plus
          </h2>

          <div>
            <label htmlFor="wiz-title" className="label-field">
              Titre de la toile *
            </label>
            <input
              id="wiz-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="ex : Jardin en fleurs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="wiz-year" className="label-field">
                Année
              </label>
              <input
                id="wiz-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })}
                className="input-field"
                min={1900}
                max={2100}
                inputMode="numeric"
              />
            </div>
            <div>
              <label htmlFor="wiz-technique" className="label-field">
                Technique
              </label>
              <select
                id="wiz-technique"
                value={form.technique}
                onChange={(e) => setForm({ ...form, technique: e.target.value as Technique })}
                className="input-field"
              >
                {TECHNIQUES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="wiz-dimensions" className="label-field">
              Dimensions <span className="label-optional">— facultatif</span>
              <HelpTip text="La taille de la toile, par exemple « 80 × 60 cm ». Elle s'affiche à côté de la technique sur votre site." />
            </label>
            <input
              id="wiz-dimensions"
              type="text"
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              className="input-field"
              placeholder="ex : 80 × 60 cm"
            />
          </div>

          <div>
            <label htmlFor="wiz-description" className="label-field">
              Description <span className="label-optional">— facultatif</span>
              <HelpTip text="Quelques phrases sur cette toile : ce qui vous a inspirée, les couleurs, l'histoire. Visible sur la page de l'œuvre." />
            </label>
            <textarea
              id="wiz-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[120px] resize-y"
              rows={4}
              placeholder="Quelques mots sur cette œuvre..."
            />
          </div>

          <div>
            <p className="label-field">
              Prix
              <HelpTip text="Choisissez ce que les visiteurs verront : le prix affiché, « prix sur demande », « vendue » ou rien du tout." />
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, priceStatus: opt.value })}
                  aria-pressed={form.priceStatus === opt.value}
                  className={`px-3 py-3.5 font-body text-base border rounded text-center min-h-[52px] transition-colors duration-200 ${
                    form.priceStatus === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.priceStatus === 'visible' && (
              <div className="mt-4">
                <label htmlFor="wiz-price" className="label-field">Prix en euros</label>
                <input
                  id="wiz-price"
                  type="number"
                  value={form.price || ''}
                  onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                  className="input-field w-full sm:w-48"
                  placeholder="ex : 650"
                  min={0}
                  inputMode="numeric"
                />
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-[var(--line)] bg-[var(--surface)]">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              className="w-6 h-6 mt-0.5 accent-[var(--accent)] flex-shrink-0"
            />
            <span>
              <span className="block font-body text-base font-medium text-[var(--ink)]">
                Afficher en grand sur la page d&apos;accueil
              </span>
              <span className="block font-body text-sm text-[var(--ink-soft)] mt-0.5">
                Cette toile apparaîtra en tout premier, en grande image.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* ─── Étape 3 : vérification ─── */}
      {step === 3 && (
        <div>
          <h2 className="font-display text-3xl text-[var(--ink)] mb-2">
            Voici ce que verront les visiteurs
          </h2>
          <p className="font-body text-base text-[var(--ink-soft)] mb-6">
            Vérifiez que tout vous convient. Vous pourrez encore modifier ensuite.
          </p>

          {/* Aperçu façon fiche visiteur */}
          <div className="border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
            <div className="bg-[var(--line)] overflow-hidden">
              <img
                src={form.imageUrl}
                alt={`Aperçu — ${form.title}`}
                className="w-full h-auto max-h-[45vh] object-contain bg-[var(--surface)]"
              />
            </div>
            <h3 className="font-display text-3xl sm:text-4xl text-[var(--ink)] mt-5 leading-tight">
              {form.title || 'Sans titre'}
            </h3>
            <p className="font-body text-sm text-[var(--ink-soft)] mt-2">
              {form.year} · {form.technique}
              {form.dimensions ? ` · ${form.dimensions}` : ''}
            </p>
            <p className="font-body text-lg text-[var(--ink)] font-medium mt-4">
              {PRICE_PREVIEW[form.priceStatus](form.price)}
            </p>
            {form.description && (
              <p className="font-body text-sm text-[var(--ink-soft)] leading-relaxed mt-4 whitespace-pre-line">
                {form.description}
              </p>
            )}
            {form.featured && (
              <p className="font-body text-xs text-[var(--accent)] mt-4 uppercase tracking-[0.14em]">
                ⭐ Affichée en grand sur l&apos;accueil
              </p>
            )}
          </div>

          {error && (
            <div className="mt-5 p-4 bg-[#B3402F]/10 border border-[#B3402F]/30" role="alert">
              <p className="font-body text-base text-[#B3402F]">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Navigation ─── */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 pt-6 border-t border-[var(--line)]">
        {step > 1 ? (
          <button
            onClick={() => setStep(step - 1)}
            className="btn-outline flex-1 text-base"
          >
            ← Retour
          </button>
        ) : (
          <button onClick={onCancel} className="btn-outline flex-1 text-base">
            Annuler
          </button>
        )}

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canContinue}
            className="btn-primary flex-1 text-base disabled:opacity-40"
          >
            Continuer →
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={saving}
            className="btn-accent flex-1 text-base disabled:opacity-50"
          >
            {saving
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : '✓ Mettre en ligne'}
          </button>
        )}
      </div>

      {step === 1 && !form.imageUrl && (
        <p className="font-body text-sm text-[var(--muted)] text-center mt-4">
          La photo est obligatoire pour continuer.
        </p>
      )}
    </div>
  )
}
