'use client'

import { useEffect, useRef, useState } from 'react'
import type { PaintingAnalysis, PaintingNotice } from '@/lib/types'
import NoticeView from '@/components/gallery/NoticeView'
import { formatDimensions } from '@/lib/i18n'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'

// Carte « Présentation de cette toile » : l'IA rédige un brouillon à
// partir de la photo, l'artiste relit/corrige dans des champs modifiables,
// puis publie explicitement. Les notes pour l'artiste restent privées —
// rien n'est jamais publié automatiquement.

interface Props {
  paintingId?: string // absent en création (toile pas encore enregistrée)
  imageUrl: string
  title: string
  technique: string
  year: number
  dimensions: string
  signature?: string
  publishedNotice?: PaintingNotice // notice en ligne (peinture existante)
}

interface DraftFields {
  accroche: string
  texte: string
  ambiance: string
  matiere: string // une puce par ligne
}

const EMPTY: DraftFields = { accroche: '', texte: '', ambiance: '', matiere: '' }

function fieldsToNotice(f: DraftFields): PaintingNotice {
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

function noticeToFields(n: PaintingNotice): DraftFields {
  return {
    accroche: n.accroche,
    texte: n.texte_client,
    ambiance: n.ambiance,
    matiere: (n.matiere_technique || []).join('\n'),
  }
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
  publishedNotice,
}: Props) {
  const [fields, setFields] = useState<DraftFields>(() =>
    publishedNotice ? noticeToFields(publishedNotice) : EMPTY
  )
  const [notes, setNotes] = useState<string[]>([])
  const [reperePrix, setReperePrix] = useState('')
  const [published, setPublished] = useState<PaintingNotice | null>(publishedNotice || null)
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
  const loaded = useRef(false)

  const hasDraft = !!(
    fields.accroche.trim() ||
    fields.texte.trim() ||
    fields.ambiance.trim() ||
    fields.matiere.trim()
  )
  const draftDiffers = published ? !sameNotice(fieldsToNotice(fields), published) : false

  // Analyse privée enregistrée (toile existante) : on recharge la dernière
  // sortie du modèle pour remplir le brouillon et le bloc « Pour vous seule ».
  useEffect(() => {
    if (!paintingId || loaded.current) return
    loaded.current = true
    fetch(`/api/paintings/${paintingId}/analyse`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const a = data.analysis as PaintingAnalysis | null
        if (data.notice) setPublished(data.notice)
        if (a) {
          setNotes(a.notes_artiste || [])
          setReperePrix(a.repere_prix || '')
          // Priorité au texte publié/retouché — l'analyse ne pré-remplit
          // qu'un panneau encore vide.
          if (!hasDraft) setFields(noticeToFields(a))
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintingId])

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
      setFields(noticeToFields(a))
      setNotes(a.notes_artiste || [])
      setReperePrix(a.repere_prix || '')
      setEdited(false)
      setInfo('Brouillon prêt — relisez et corrigez à votre façon, puis publiez.')
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
    if (!paintingId) return
    setSaving('publish')
    setError('')
    setInfo('')
    try {
      const res = await fetch(`/api/paintings/${paintingId}/notice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldsToNotice(fields)),
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
      setPublished(data.notice)
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
    if (!paintingId) return
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
      setPublished(null)
      setConfirming('')
      setInfo('Retiré de la fiche ✓ Votre brouillon reste ici, rien n’est perdu.')
    } catch {
      setError('Impossible de retirer le texte — vérifiez votre connexion.')
    } finally {
      setSaving('')
    }
  }

  const composedText = () => {
    const n = fieldsToNotice(fields)
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

  const set = (key: keyof DraftFields, v: string) => {
    setEdited(true)
    setFields((f) => ({ ...f, [key]: v }))
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-[var(--ink)]">Présentation de la fiche</h3>
        {published ? (
          <span className="font-body text-[11px] font-medium uppercase tracking-[0.14em] px-3 py-1.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40">
            {draftDiffers ? 'Publiée — brouillon modifié' : 'Publiée sur la fiche'}
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
        <p className="font-body text-sm text-[var(--ink)] mt-4" role="status">
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
              value={fields.accroche}
              onChange={(e) => set('accroche', e.target.value)}
              className="input-field"
              maxLength={300}
            />
            <div className="flex justify-end mt-1">
              <Counter value={fields.accroche.length} max={120} />
            </div>
          </div>

          <div>
            <label htmlFor="an-texte" className="label-field">
              Texte de présentation — deux paragraphes
            </label>
            <textarea
              id="an-texte"
              value={fields.texte}
              onChange={(e) => set('texte', e.target.value)}
              className="input-field min-h-[150px] resize-y"
              rows={6}
            />
            <div className="flex justify-end mt-1">
              <Counter value={wordCount(fields.texte)} max={130} unit="mots" />
            </div>
          </div>

          <div>
            <label htmlFor="an-ambiance" className="label-field">
              Ambiance et intérieur — où la toile prend sa place
            </label>
            <textarea
              id="an-ambiance"
              value={fields.ambiance}
              onChange={(e) => set('ambiance', e.target.value)}
              className="input-field min-h-[90px] resize-y"
              rows={3}
            />
            <div className="flex justify-end mt-1">
              <Counter value={fields.ambiance.length} max={1500} />
            </div>
          </div>

          <div>
            <label htmlFor="an-matiere" className="label-field">
              Matière et technique — une puce par ligne
            </label>
            <textarea
              id="an-matiere"
              value={fields.matiere}
              onChange={(e) => set('matiere', e.target.value)}
              className="input-field min-h-[90px] resize-y"
              rows={4}
            />
            <div className="flex justify-end mt-1">
              <Counter
                value={fieldsToNotice(fields).matiere_technique.length}
                max={8}
                unit="puces"
              />
            </div>
          </div>

          {(notes.length > 0 || reperePrix) && (
            <details className="border border-[var(--line)] bg-[var(--bg)]/40 p-4">
              <summary className="font-body text-sm font-medium text-[var(--ink)] cursor-pointer min-h-[44px] flex items-center">
                Pour vous seule
              </summary>
              <p className="font-body text-[11px] text-[var(--muted)] italic mb-3">
                Ce bloc n&apos;est jamais visible sur le site.
              </p>
              {notes.length > 0 && (
                <ul className="space-y-1.5 font-body text-sm text-[var(--ink-soft)]">
                  {notes.map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">·</span>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
              {reperePrix && (
                <p className="font-body text-sm text-[var(--ink-soft)] mt-3">
                  <span className="text-[var(--muted)]">Repère de prix :</span> {reperePrix}
                </p>
              )}
            </details>
          )}

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
                notice={{ ...fieldsToNotice(fields), accroche: fields.accroche }}
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
            {paintingId ? (
              <button
                type="button"
                onClick={publish}
                disabled={saving === 'publish'}
                className="btn-accent text-base min-h-[52px] disabled:opacity-50"
              >
                {saving === 'publish'
                  ? 'Publication…'
                  : published
                    ? '✓ Republier sur la fiche'
                    : '✓ Publier sur la fiche'}
              </button>
            ) : (
              <p className="font-body text-sm text-[var(--muted)] w-full">
                Enregistrez d&apos;abord la toile (bouton « Mettre en ligne ») pour
                pouvoir publier ce texte.
              </p>
            )}
            <button type="button" onClick={copy} className="btn-outline text-base min-h-[52px]">
              {copied ? 'Copié ✓' : 'Copier'}
            </button>
            <button type="button" onClick={whatsapp} className="btn-outline text-base min-h-[52px]">
              Envoyer par WhatsApp
            </button>
            {published && (
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
              onClick={() => (edited || published ? setConfirming('regen') : generate())}
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
