'use client'

import { useState } from 'react'
import type { PaintingAnalysis, PaintingNotice } from '@/lib/types'
import NoticeView from '@/components/gallery/NoticeView'
import { formatDimensions } from '@/lib/i18n'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'

// Carte « Présentation de cette toile » : l'IA rédige un brouillon à
// partir de la photo, l'artiste relit/corrige dans des champs modifiables,
// et choisit via la case si le texte est publié en même temps que la toile
// (ou gardé en brouillon privé). Les notes pour l'artiste restent dans
// `analysis` et ne sont jamais visibles sur le site.

export interface AnalyseFormState {
  accroche: string
  texte: string
  ambiance: string
  matiere: string // une puce par ligne
  notes_artiste: string[]
  repere_prix: string
  publishWithPainting: boolean
  generatedUnpersisted: boolean
}

export const EMPTY_ANALYSE_STATE: AnalyseFormState = {
  accroche: '',
  texte: '',
  ambiance: '',
  matiere: '',
  notes_artiste: [],
  repere_prix: '',
  publishWithPainting: false,
  generatedUnpersisted: false,
}

export function hasAnalyseDraft(s: AnalyseFormState): boolean {
  return !!(
    s.accroche.trim() ||
    s.texte.trim() ||
    s.ambiance.trim() ||
    s.matiere.trim()
  )
}

export function fieldsToNotice(f: {
  accroche: string
  texte: string
  ambiance: string
  matiere: string
}): PaintingNotice {
  return {
    accroche: f.accroche.trim(),
    texte_client: f.texte.trim(),
    ambiance: f.ambiance.trim(),
    matiere_technique: f.matiere
      .split('\n')
      .map((l) => l.trim().replace(/^[-•—]\s*/, ''))
      .filter(Boolean),
  }
}

export function noticeToAnalyseState(
  n?: PaintingNotice | null,
  a?: PaintingAnalysis | null
): AnalyseFormState {
  const src = n || a
  if (!src) return EMPTY_ANALYSE_STATE
  return {
    accroche: src.accroche || '',
    texte: src.texte_client || '',
    ambiance: src.ambiance || '',
    matiere: (src.matiere_technique || []).join('\n'),
    notes_artiste: a?.notes_artiste || [],
    repere_prix: a?.repere_prix || '',
    publishWithPainting: !!n,
    generatedUnpersisted: false,
  }
}

export function stateToAnalysis(s: AnalyseFormState): PaintingAnalysis | null {
  const notice = fieldsToNotice(s)
  const notes = (s.notes_artiste || []).map((n) => n.trim()).filter(Boolean)
  const repere = (s.repere_prix || '').trim()
  const hasAny =
    notice.accroche ||
    notice.texte_client ||
    notice.ambiance ||
    notice.matiere_technique.length > 0 ||
    notes.length > 0 ||
    repere
  if (!hasAny) return null
  return {
    ...notice,
    ...(notes.length > 0 ? { notes_artiste: notes } : {}),
    ...(repere ? { repere_prix: repere } : {}),
  }
}

interface Props {
  paintingId?: string // absent en création (toile pas encore enregistrée)
  imageUrl: string
  title: string
  technique: string
  year: number
  dimensions: string
  signature?: string
  value: AnalyseFormState
  onChange: (next: AnalyseFormState) => void
  publishedNotice: PaintingNotice | null
  onPublishedNoticeChange: (next: PaintingNotice | null) => void
}

const sameNotice = (a: PaintingNotice, b: PaintingNotice) =>
  a.accroche === b.accroche &&
  a.texte_client === b.texte_client &&
  a.ambiance === b.ambiance &&
  a.matiere_technique.join('\n') === b.matiere_technique.join('\n')

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

function Counter({ value, max, unit = 'caractères' }: { value: number; max: number; unit?: string }) {
  return (
    <span
      className={`font-body text-xs ${value > max ? 'text-[var(--danger)] font-medium' : 'text-[var(--muted)]'}`}
    >
      {value} / {max} {unit}
    </span>
  )
}

export default function AnalysePanel({
  paintingId,
  imageUrl,
  title,
  technique,
  year,
  dimensions,
  signature,
  value,
  onChange,
  publishedNotice,
  onPublishedNoticeChange,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState<'publish' | 'remove' | ''>('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState<'regen' | 'remove' | ''>('')
  const [showPreview, setShowPreview] = useState(false)
  // Vrai dès que l'artiste a retouché un champ après une génération —
  // « Régénérer » ne les écrase alors qu'après confirmation explicite.
  const [edited, setEdited] = useState(false)

  const hasDraft = hasAnalyseDraft(value)
  const draftDiffers = publishedNotice
    ? !sameNotice(fieldsToNotice(value), publishedNotice)
    : false

  const generate = async () => {
    setBusy(true)
    setError('')
    setInfo('')
    setConfirming('')
    try {
      const res = await fetch('/api/paintings/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paintingId,
          imageUrl: imageUrl || undefined,
          title: title || undefined,
          technique: technique || undefined,
          year: year || undefined,
          dimensions: dimensions || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        setError(
          data.error ||
            'L\u2019analyse n\u2019a pas abouti — réessayez dans un instant.'
        )
        return
      }
      const a = data.analysis as PaintingAnalysis
      onChange({
        accroche: a.accroche || '',
        texte: a.texte_client || '',
        ambiance: a.ambiance || '',
        matiere: (a.matiere_technique || []).join('\n'),
        notes_artiste: a.notes_artiste || [],
        repere_prix: a.repere_prix || '',
        publishWithPainting: true,
        generatedUnpersisted: true,
      })
      setEdited(false)
      setInfo(
        'Votre texte est prêt. Il sera enregistré avec votre toile en cliquant sur Mettre en ligne.'
      )
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setError('L\u2019analyse n\u2019a pas abouti — vérifiez votre connexion et réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    setError('')
    // Sur une nouvelle toile (pas encore d'id en base), le bouton active
    // la case de publication groupée et l'indique clairement.
    if (!paintingId) {
      onChange({ ...value, publishWithPainting: true })
      setInfo('Sera publié avec la toile.')
      return
    }
    setSaving('publish')
    setInfo('')
    try {
      const res = await fetch(`/api/paintings/${paintingId}/notice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldsToNotice(value)),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        setError(data.error || 'La publication a échoué — réessayez.')
        return
      }
      onPublishedNoticeChange(data.notice)
      onChange({ ...value, publishWithPainting: true, generatedUnpersisted: false })
      setInfo('Publié sur la fiche ✓ Les traductions arrivent dans quelques secondes.')
      // Traduction en arrière-plan — jamais bloquant.
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'painting', id: paintingId }),
      }).catch(() => {})
    } catch {
      setError('La publication a échoué — vérifiez votre connexion.')
    } finally {
      setSaving('')
    }
  }

  const unpublish = async () => {
    if (!paintingId) {
      onChange({ ...value, publishWithPainting: false })
      setConfirming('')
      setInfo('Gardé en brouillon — ne sera pas publié sur la fiche.')
      return
    }
    setSaving('remove')
    setError('')
    setInfo('')
    try {
      const res = await fetch(`/api/paintings/${paintingId}/notice`, { method: 'DELETE' })
      if (!res.ok) {
        if (res.status === 401) {
          redirectToLogin()
          return
        }
        setError('Impossible de retirer le texte — réessayez.')
        return
      }
      onPublishedNoticeChange(null)
      onChange({ ...value, publishWithPainting: false })
      setConfirming('')
      setInfo('Retiré de la fiche ✓ Votre brouillon reste ici, rien n’est perdu.')
    } catch {
      setError('Impossible de retirer le texte — vérifiez votre connexion.')
    } finally {
      setSaving('')
    }
  }

  const composedText = () => {
    const n = fieldsToNotice(value)
    const parts = [n.accroche, n.texte_client, n.ambiance]
    if (n.matiere_technique.length) {
      parts.push(n.matiere_technique.map((p) => `· ${p}`).join('\n'))
    }
    return parts.filter(Boolean).join('\n\n')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(composedText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('La copie a échoué — sélectionnez le texte à la main.')
    }
  }

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(composedText())}`, '_blank', 'noopener')
  }

  const setField = (key: 'accroche' | 'texte' | 'ambiance' | 'matiere', v: string) => {
    setEdited(true)
    const next: AnalyseFormState = {
      ...value,
      [key]: v,
      generatedUnpersisted: true,
    }
    // Si l'artiste commence à écrire alors qu'aucun texte n'existait, on
    // coche la case de publication par défaut.
    if (!hasDraft && v.trim()) {
      next.publishWithPainting = true
    }
    onChange(next)
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">Présentation de la fiche</h3>
        {publishedNotice && value.publishWithPainting ? (
          <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-1.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40">
            {draftDiffers ? 'Publiée — brouillon modifié' : 'Publiée sur la fiche'}
          </span>
        ) : hasDraft && value.publishWithPainting ? (
          <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-1.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40">
            Sera publié avec la toile
          </span>
        ) : (
          <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-1.5 border border-[var(--line)] text-[var(--muted)]">
            Brouillon — rien en ligne
          </span>
        )}
      </div>
      <p className="font-body text-sm text-[var(--ink-soft)] mt-2">
        Le texte est rédigé pour les visiteurs qui découvrent la toile. Vous le
        relisez, le corrigez, puis vous décidez de le publier — rien ne part en
        ligne tout seul.
      </p>

      {!hasDraft && !busy && (
        <div className="mt-5">
          <button
            type="button"
            onClick={generate}
            disabled={!imageUrl}
            className="btn-primary w-full sm:w-auto text-base min-h-[52px] disabled:opacity-40"
          >
            ✨ Rédiger la présentation de cette toile
          </button>
          {!imageUrl && (
            <p className="font-body text-sm text-[var(--muted)] mt-2">
              Ajoutez d&apos;abord une photo de la toile.
            </p>
          )}
        </div>
      )}

      {busy && (
        <p className="font-body text-base text-[var(--ink-soft)] mt-5" role="status" aria-live="polite">
          Je regarde votre toile, cela prend une vingtaine de secondes…
        </p>
      )}

      {error && (
        <p className="font-body text-sm text-[var(--danger)] mt-4" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="font-body text-sm text-[var(--ink)] mt-4 p-3 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
          {info}
        </p>
      )}

      {hasDraft && !busy && (
        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="an-accroche" className="label-field">
              Accroche — une phrase sous le titre
            </label>
            <input
              id="an-accroche"
              type="text"
              value={value.accroche}
              onChange={(e) => setField('accroche', e.target.value)}
              className="input-field"
              maxLength={300}
            />
            <div className="flex justify-end mt-1">
              <Counter value={value.accroche.length} max={120} />
            </div>
          </div>

          <div>
            <label htmlFor="an-texte" className="label-field">
              Texte de présentation — deux paragraphes
            </label>
            <textarea
              id="an-texte"
              value={value.texte}
              onChange={(e) => setField('texte', e.target.value)}
              className="input-field min-h-[150px] resize-y"
              rows={6}
            />
            <div className="flex justify-end mt-1">
              <Counter value={wordCount(value.texte)} max={130} unit="mots" />
            </div>
          </div>

          <div>
            <label htmlFor="an-ambiance" className="label-field">
              Ambiance et intérieur — où la toile prend sa place
            </label>
            <textarea
              id="an-ambiance"
              value={value.ambiance}
              onChange={(e) => setField('ambiance', e.target.value)}
              className="input-field min-h-[90px] resize-y"
              rows={3}
            />
            <div className="flex justify-end mt-1">
              <Counter value={value.ambiance.length} max={1500} />
            </div>
          </div>

          <div>
            <label htmlFor="an-matiere" className="label-field">
              Matière et technique — une puce par ligne
            </label>
            <textarea
              id="an-matiere"
              value={value.matiere}
              onChange={(e) => setField('matiere', e.target.value)}
              className="input-field min-h-[90px] resize-y"
              rows={4}
            />
            <div className="flex justify-end mt-1">
              <Counter
                value={fieldsToNotice(value).matiere_technique.length}
                max={8}
                unit="puces"
              />
            </div>
          </div>

          {(value.notes_artiste.length > 0 || value.repere_prix) && (
            <details className="border border-[var(--line)] bg-[var(--bg)]/40 p-4">
              <summary className="font-body text-sm font-medium text-[var(--ink)] cursor-pointer min-h-[44px] flex items-center">
                Pour vous seule
              </summary>
              <p className="font-body text-[11px] text-[var(--muted)] italic mb-3">
                Ce bloc n&apos;est jamais visible sur le site.
              </p>
              {value.notes_artiste.length > 0 && (
                <ul className="space-y-1.5 font-body text-sm text-[var(--ink-soft)]">
                  {value.notes_artiste.map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">·</span>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
              {value.repere_prix && (
                <p className="font-body text-sm text-[var(--ink-soft)] mt-3">
                  <span className="text-[var(--muted)]">Repère de prix :</span> {value.repere_prix}
                </p>
              )}
            </details>
          )}

          {/* Case claire de publication simultanée (cochée par défaut dès qu'un texte existe) */}
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-[var(--line)] bg-[var(--bg)]">
            <input
              type="checkbox"
              checked={value.publishWithPainting}
              onChange={(e) =>
                onChange({ ...value, publishWithPainting: e.target.checked })
              }
              className="w-6 h-6 mt-0.5 accent-[var(--accent)] flex-shrink-0"
            />
            <span>
              <span className="block font-body text-base font-medium text-[var(--ink)]">
                Publier ce texte sur la fiche en même temps que la toile
              </span>
              <span className="block font-body text-sm text-[var(--ink-soft)] mt-0.5">
                {value.publishWithPainting
                  ? 'Sera publié avec la toile — visible sur la fiche publique.'
                  : 'Gardé en brouillon privé — ne s’affichera pas encore sur le site.'}
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="font-body text-sm text-[var(--ink-soft)] underline underline-offset-2 min-h-[44px]"
            aria-expanded={showPreview}
          >
            {showPreview ? 'Masquer l\u2019aperçu de la fiche' : '👁 Aperçu de la fiche'}
          </button>
          {showPreview && (
            <div className="border border-dashed border-[var(--line)] p-4 sm:p-6">
              <p className="font-body text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mb-4">
                Aperçu — pas encore publié
              </p>
              <NoticeView
                notice={{ ...fieldsToNotice(value), accroche: value.accroche }}
                labels={{
                  ambiance: 'Ambiance et intérieur',
                  matiere: 'Matière et technique',
                  fiche: 'Fiche technique',
                  dimensionsLabel: 'Dimensions',
                  techniqueLabel: 'Technique',
                  yearLabel: 'Année',
                  signatureLabel: 'Signature',
                }}
                dimensions={formatDimensions(dimensions) || undefined}
                technique={technique || undefined}
                year={year || undefined}
                signature={signature || undefined}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={publish}
              disabled={saving === 'publish'}
              className="btn-accent text-base min-h-[52px] disabled:opacity-50"
            >
              {saving === 'publish'
                ? 'Publication…'
                : paintingId
                  ? publishedNotice
                    ? '✓ Republier sur la fiche'
                    : '✓ Publier sur la fiche'
                  : value.publishWithPainting
                    ? '✓ Sera publié avec la toile'
                    : '✓ Publier sur la fiche'}
            </button>
            <button type="button" onClick={copy} className="btn-outline text-base min-h-[52px]">
              {copied ? 'Copié ✓' : 'Copier'}
            </button>
            <button type="button" onClick={whatsapp} className="btn-outline text-base min-h-[52px]">
              Envoyer par WhatsApp
            </button>
            {publishedNotice && (
              <button
                type="button"
                onClick={() => setConfirming('remove')}
                className="btn-danger text-base min-h-[52px]"
              >
                Retirer de la fiche
              </button>
            )}
            <button
              type="button"
              onClick={() => (edited || publishedNotice ? setConfirming('regen') : generate())}
              disabled={!imageUrl}
              className="btn-outline text-base min-h-[52px] disabled:opacity-40"
            >
              ↻ Régénérer
            </button>
          </div>

          {/* Confirmations en deux temps — jamais de clic qui écrase sans
              prévenir (corrections de l'artiste prioritaires). */}
          {confirming === 'regen' && (
            <div className="p-4 border border-[var(--accent)]/40 bg-[var(--accent-soft)]" role="alertdialog" aria-label="Confirmer la régénération">
              <p className="font-body text-sm text-[var(--ink)]">
                {edited
                  ? 'Vous avez retouché ce texte — régénérer remplacera vos modifications. Continuer ?'
                  : 'Régénérer remplacera le texte actuel. Continuer ?'}
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button type="button" onClick={generate} className="btn-primary text-sm min-h-[44px]">
                  Oui, tout remplacer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming('')}
                  className="btn-outline text-sm min-h-[44px]"
                >
                  Garder mon texte
                </button>
              </div>
            </div>
          )}
          {confirming === 'remove' && (
            <div className="p-4 border border-[var(--danger-line)] bg-[var(--danger-bg)]" role="alertdialog" aria-label="Confirmer le retrait">
              <p className="font-body text-sm text-[var(--ink)]">
                Le texte disparaîtra de la fiche publique. Votre brouillon reste
                ici — vous pourrez republier.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button
                  type="button"
                  onClick={unpublish}
                  disabled={saving === 'remove'}
                  className="btn-danger text-sm min-h-[44px] disabled:opacity-50"
                >
                  {saving === 'remove' ? 'Retrait…' : 'Oui, retirer de la fiche'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming('')}
                  className="btn-outline text-sm min-h-[44px]"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
