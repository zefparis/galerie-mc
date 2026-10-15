'use client'

import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { savePainting, updatePainting, getNextOrder, isSessionExpired, redirectToLogin, type PaintingWritePayload } from '@/lib/storage'
import { Painting, PaintingAnalysis, PaintingNotice, Technique, PriceStatus, PaintingCategory, Translations } from '@/lib/types'
import { CATEGORIES, CATEGORY_LABEL, TECHNIQUES_BY_CATEGORY } from '@/lib/catalog'
import CloudinaryUpload from './CloudinaryUpload'
import HelpTip from './HelpTip'
import TranslationPanel from './TranslationPanel'
import FormWithPreview from './PreviewShell'
import PaintingPreview from './PaintingPreview'
import AnalysePanel, {
  EMPTY_ANALYSE_STATE,
  fieldsToNotice,
  hasAnalyseDraft,
  noticeToAnalyseState,
  stateToAnalysis,
  type AnalyseFormState,
} from './AnalysePanel'

// La traduction part en arrière-plan : l'enregistrement n'attend jamais
// le service de traduction, et un échec est silencieux (le texte est déjà
// en ligne, la traduction pourra être relancée).
function translateInBackground(entity: 'painting' | 'event' | 'settings', id?: string) {
  fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity, id }),
  }).catch(() => {})
}

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
  initialPhoto?: {
    url: string
    publicId: string
    width?: number
    height?: number
  } | null
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
    category: PaintingCategory
    imageUrl: string
    imagePublicId: string
    imageWidth?: number
    imageHeight?: number
    price: number
    priceStatus: PriceStatus
    featured: boolean
    signature: string
  }
  analyse?: AnalyseFormState
}

export default function PaintingWizard({
  painting,
  initialPhoto,
  onDone,
  onCancel,
}: Props) {
  const isEditing = !!painting
  const draftKey = `mc-draft-painting-${painting?.id || 'new'}`

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    title: painting?.title || '',
    year: painting?.year || new Date().getFullYear(),
    technique: painting?.technique || ('Huile sur toile' as Technique),
    dimensions: painting?.dimensions || '',
    description: painting?.description || '',
    category: painting?.category || ('peintures' as PaintingCategory),
    imageUrl: painting?.imageUrl || initialPhoto?.url || '',
    imagePublicId: painting?.imagePublicId || initialPhoto?.publicId || '',
    imageWidth: painting?.imageWidth ?? initialPhoto?.width,
    imageHeight: painting?.imageHeight ?? initialPhoto?.height,
    price: painting?.price || 0,
    priceStatus: painting?.priceStatus || ('sur_demande' as PriceStatus),
    featured: painting?.featured || false,
    signature: painting?.signature || '',
  })
  const [analyseState, setAnalyseState] = useState<AnalyseFormState>(() =>
    noticeToAnalyseState(painting?.notice, null)
  )
  const [publishedNotice, setPublishedNotice] = useState<PaintingNotice | null>(
    painting?.notice || null
  )
  const [confirmExitOpen, setConfirmExitOpen] = useState(false)
  const [draftFound, setDraftFound] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [translations, setTranslations] = useState<Translations>(painting?.translations || {})
  // Aperçu local du fichier pendant l'envoi Cloudinary (blob:).
  const [localImage, setLocalImage] = useState('')
  const restored = useRef(false)
  const analyseLoaded = useRef(false)

  // Récupération du brouillon automatique (sauf si l'artiste vient de
  // choisir une photo précise dans « Mes photos »).
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (initialPhoto?.url) return
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const draft = JSON.parse(raw) as Draft
      if (draft?.form && (draft.form.title || draft.form.imageUrl || (draft.analyse && hasAnalyseDraft(draft.analyse)))) {
        setForm((f) => ({ ...f, ...draft.form }))
        if (draft.analyse) {
          setAnalyseState(draft.analyse)
        }
        setStep(draft.step || 1)
        setDraftFound(true)
      }
    } catch {
      // brouillon illisible — on l'ignore
    }
  }, [draftKey, initialPhoto])

  // Toile existante : charge une seule fois l'analyse privée enregistrée
  // (notes_artiste, repere_prix, et brouillon si pas encore de notice publiée).
  useEffect(() => {
    if (!painting?.id || analyseLoaded.current) return
    analyseLoaded.current = true
    fetch(`/api/paintings/${painting.id}/analyse`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const a = (data.analysis as PaintingAnalysis | null) || null
        const n = (data.notice as PaintingNotice | null) || null
        if (n) setPublishedNotice(n)
        setAnalyseState((prev) => {
          // Si l'artiste a déjà commencé à modifier dans l'écran, ses
          // champs priment ; on récupère seulement les notes privées.
          if (hasAnalyseDraft(prev)) {
            return {
              ...prev,
              notes_artiste: prev.notes_artiste.length
                ? prev.notes_artiste
                : a?.notes_artiste || [],
              repere_prix: prev.repere_prix || a?.repere_prix || '',
            }
          }
          return noticeToAnalyseState(n, a)
        })
      })
      .catch(() => {})
  }, [painting?.id])

  // Sauvegarde automatique du brouillon à chaque modification (y compris le texte IA)
  useEffect(() => {
    if (isEditing) return // pas de brouillon en modification, seulement en création
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ step, form, analyse: analyseState }))
      } catch { /* stockage plein — non bloquant */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form, analyseState, step, draftKey, isEditing])

  // Garde-fou navigation navigateur : avertit si un texte généré n'est pas enregistré.
  const hasUnsavedGeneratedText =
    analyseState.generatedUnpersisted && hasAnalyseDraft(analyseState)

  useEffect(() => {
    if (!hasUnsavedGeneratedText) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedGeneratedText])

  const requestCancel = () => {
    if (hasUnsavedGeneratedText) {
      setConfirmExitOpen(true)
      return
    }
    onCancel()
  }

  const discardDraft = () => {
    localStorage.removeItem(draftKey)
    setDraftFound(false)
    setForm({
      title: '',
      year: new Date().getFullYear(),
      technique: 'Huile sur toile',
      dimensions: '',
      description: '',
      category: 'peintures' as PaintingCategory,
      imageUrl: '',
      imagePublicId: '',
      imageWidth: undefined,
      imageHeight: undefined,
      price: 0,
      priceStatus: 'sur_demande',
      featured: false,
      signature: '',
    })
    setAnalyseState(EMPTY_ANALYSE_STATE)
    setStep(1)
  }

  const canContinue = step === 1 ? !!form.imageUrl : step === 2 ? !!form.title.trim() : true
  const hasTextDraft = hasAnalyseDraft(analyseState)
  const willPublishText = hasTextDraft && analyseState.publishWithPainting

  const handlePublish = async () => {
    setError('')
    setSaving(true)
    try {
      const order = painting?.order || (await getNextOrder())
      const noticePayload: PaintingNotice | null = willPublishText
        ? fieldsToNotice(analyseState)
        : null
      const analysisPayload: PaintingAnalysis | null = stateToAnalysis(analyseState)

      const data: PaintingWritePayload = {
        id: painting?.id || uuidv4(),
        title: form.title.trim(),
        year: form.year,
        technique: form.technique,
        dimensions: form.dimensions.trim(),
        description: form.description.trim(),
        category: form.category,
        imageUrl: form.imageUrl,
        imagePublicId: form.imagePublicId,
        imageWidth: form.imageWidth,
        imageHeight: form.imageHeight,
        price: form.priceStatus === 'visible' ? form.price : undefined,
        priceStatus: form.priceStatus,
        featured: form.featured,
        signature: form.signature.trim() || undefined,
        order,
        createdAt: painting?.createdAt || new Date().toISOString(),
        notice: noticePayload,
        ...(analysisPayload ? { analysis: analysisPayload } : {}),
      }

      if (isEditing) {
        await updatePainting(data.id, data)
      } else {
        await savePainting(data)
      }
      localStorage.removeItem(draftKey)
      translateInBackground('painting', data.id)
      onDone(
        (isEditing ? 'Modifications enregistrées ✓' : 'Votre toile est en ligne ✓') +
          ' Les traductions arrivent dans quelques secondes.'
      )
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      const detail = err instanceof Error && err.message ? err.message : ''
      setError(
        detail
          ? `Je n'ai pas pu enregistrer : ${detail}. Votre toile et votre texte sont conservés ici.`
          : "Une erreur est survenue — rien n'a été perdu. Réessayez."
      )
      setSaving(false)
    }
  }

  return (
    <FormWithPreview
      preview={
        <PaintingPreview
          form={form}
          translations={translations}
          localImage={localImage}
        />
      }
    >
    <div>
      {/* Barre de progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="font-body text-sm font-medium text-[var(--ink)]">
            Étape {step} sur 3 — {STEPS[step - 1]}
          </p>
          <button
            onClick={requestCancel}
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

      {/* Confirmation avant de quitter avec du texte généré non enregistré */}
      {confirmExitOpen && (
        <div
          className="mb-6 p-4 border border-[var(--accent)]/40 bg-[var(--accent-soft)]"
          role="alertdialog"
          aria-label="Confirmer la sortie sans enregistrer"
        >
          <p className="font-body text-base text-[var(--ink)]">
            Vous avez un texte de présentation non enregistré. Voulez-vous
            quitter sans l&apos;enregistrer ?
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              type="button"
              onClick={() => setConfirmExitOpen(false)}
              className="btn-primary text-sm min-h-[44px]"
            >
              Rester sur cette toile
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn-outline text-sm min-h-[44px]"
            >
              Quitter sans enregistrer
            </button>
          </div>
        </div>
      )}

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
            onUploaded={(url, publicId, width, height) => setForm({ ...form, imageUrl: url, imagePublicId: publicId, imageWidth: width, imageHeight: height })}
            onLocalPreview={setLocalImage}
          />
        </div>
      )}

      {/* ─── Étape 2 : les informations ─── */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-3xl text-[var(--ink)] mb-2">
            Dites-en un peu plus
          </h2>

          {/* Galerie de rangement */}
          <div>
            <p className="label-field">
              Où voulez-vous la ranger ?
              <HelpTip text="« Peintures contemporaines » pour vos toiles, « Collages sur papier » pour vos collages. Les visiteurs pourront choisir la galerie à voir." />
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Galerie de rangement">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={form.category === c.value}
                  onClick={() => setForm({ ...form, category: c.value })}
                  className={`px-4 py-4 min-h-[56px] border rounded font-body text-base text-center transition-colors duration-200 ${
                    form.category === c.value
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

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
                {(TECHNIQUES_BY_CATEGORY[form.category].includes(form.technique)
                  ? TECHNIQUES_BY_CATEGORY[form.category]
                  : [form.technique, ...TECHNIQUES_BY_CATEGORY[form.category]]
                ).map((t) => (
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
            <label htmlFor="wiz-signature" className="label-field">
              Signature <span className="label-optional">— facultatif</span>
              <HelpTip text="Exemple : « signée en bas à droite ». Affichée dans la fiche technique de la toile." />
            </label>
            <input
              id="wiz-signature"
              type="text"
              value={form.signature}
              onChange={(e) => setForm({ ...form, signature: e.target.value })}
              className="input-field"
              placeholder="ex : signée en bas à droite"
              maxLength={200}
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

          {/* Récapitulatif — le rendu exact est dans l'aperçu en direct
              (à droite sur ordinateur, bouton « Aperçu » sur téléphone). */}
          <div className="border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
            <p className="font-body text-base text-[var(--ink-soft)]">
              👁 Regardez l&apos;aperçu : c&apos;est exactement ce que les
              visiteurs verront, sur l&apos;accueil et dans la galerie.
            </p>
            <ul className="mt-4 space-y-1.5 font-body text-sm text-[var(--ink-soft)]">
              <li>
                <span className="text-[var(--muted)]">Prix :</span>{' '}
                {PRICE_PREVIEW[form.priceStatus](form.price) || 'Aucun prix affiché'}
              </li>
              <li>
                <span className="text-[var(--muted)]">Galerie :</span>{' '}
                {CATEGORY_LABEL[form.category]}
              </li>
              <li>
                <span className="text-[var(--muted)]">Accueil :</span>{' '}
                {form.featured
                  ? 'Affichée en grand sur la page d’accueil'
                  : 'Dans la galerie seulement'}
              </li>
            </ul>
          </div>

          {/* Présentation de la fiche (IA, relue puis publiée à la main) —
              toujours sous les informations de l'étape Vérification. */}
          <div className="mt-6">
            <AnalysePanel
              paintingId={painting?.id}
              imageUrl={form.imageUrl}
              title={form.title}
              technique={form.technique}
              year={form.year}
              dimensions={form.dimensions}
              signature={form.signature}
              value={analyseState}
              onChange={setAnalyseState}
              publishedNotice={publishedNotice}
              onPublishedNoticeChange={setPublishedNotice}
            />
          </div>

          {error && (
            <div className="mt-5 p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
              <p className="font-body text-base text-[var(--danger)]">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Traductions — seulement pour une toile déjà enregistrée */}
      {isEditing && (
        <div className="mt-8">
          <TranslationPanel
            entity="painting"
            entityId={painting.id}
            fields={[
              { key: 'title', label: 'Titre de la toile' },
              { key: 'description', label: 'Description', multiline: true },
              // Notice publiée : ses 4 champs suivent le même pipeline.
              { key: 'notice_accroche', label: 'Accroche de la fiche' },
              { key: 'notice_texte', label: 'Texte de la fiche', multiline: true },
              { key: 'notice_ambiance', label: 'Ambiance et intérieur', multiline: true },
              {
                key: 'notice_matiere',
                label: 'Matière et technique (une puce par ligne)',
                multiline: true,
              },
            ]}
            french={{
              title: form.title,
              description: form.description,
              notice_accroche: analyseState.accroche || publishedNotice?.accroche || '',
              notice_texte: analyseState.texte || publishedNotice?.texte_client || '',
              notice_ambiance: analyseState.ambiance || publishedNotice?.ambiance || '',
              notice_matiere:
                analyseState.matiere ||
                (publishedNotice?.matiere_technique || []).join('\n'),
            }}
            translations={translations}
            onTranslationsChange={setTranslations}
          />
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
          <button onClick={requestCancel} className="btn-outline flex-1 text-base">
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
              : willPublishText
                ? '✓ Mettre en ligne avec le texte'
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
    </FormWithPreview>
  )
}
