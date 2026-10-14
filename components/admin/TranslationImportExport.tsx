'use client'

import { useRef, useState } from 'react'
import { redirectToLogin } from '@/lib/storage'

interface Preview {
  ok: boolean
  total: number
  parLangue: { en: number; es: number; de: number }
  conserves: number
  erreurs: string[]
  avertissements: string[]
}

// « Traduire à la main » : exporte les textes français en JSON, réimporte
// les traductions relues (statut « Traduit et relu », jamais écrasées).
// Tout est vérifié avant écriture ; une sauvegarde permet d'annuler.
export default function TranslationImportExport() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [fileData, setFileData] = useState<unknown>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setFileData(null)
    setFileName('')
    setPreview(null)
    setNotice('')
    setError('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const download = async () => {
    setBusy('export')
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/translations')
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'textes-a-traduire.json'
      a.click()
      URL.revokeObjectURL(url)
      setNotice('Fichier téléchargé ✓ Ouvrez-le, remplissez les cases en, es, de, puis réimportez-le ici.')
    } catch {
      setError('Le téléchargement a échoué — réessayez dans un instant.')
    } finally {
      setBusy('')
    }
  }

  const pickFile = async (file: File | undefined) => {
    reset()
    if (!file) return
    setBusy('lecture')
    setFileName(file.name)
    try {
      const data = JSON.parse(await file.text())
      setFileData(data)
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', contenus: data?.contenus }),
      })
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      const p: Preview = await res.json().catch(() => null)
      if (!res.ok || !p) {
        setError(
          (p as { error?: string })?.error ||
            'Le fichier n’est pas lisible — vérifiez que c’est bien le fichier exporté depuis cet écran.'
        )
        return
      }
      setPreview(p)
    } catch {
      setError('Ce fichier n’est pas un fichier JSON lisible — reprenez le fichier exporté.')
      setFileData(null)
    } finally {
      setBusy('')
    }
  }

  const apply = async () => {
    if (!fileData) return
    setBusy('apply')
    setError('')
    try {
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', contenus: (fileData as { contenus?: unknown }).contenus }),
      })
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'error')
      setNotice(data.message || 'Traductions enregistrées ✓')
      setPreview(null)
      setFileData(null)
      setFileName('')
      if (fileInput.current) fileInput.current.value = ''
    } catch (err) {
      setError(
        (err as Error).message ||
          'L’import a échoué — rien n’a été enregistré, réessayez dans un instant.'
      )
    } finally {
      setBusy('')
    }
  }

  const undo = async () => {
    setBusy('undo')
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo' }),
      })
      if (res.status === 401) {
        redirectToLogin()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(data.error || 'Impossible d’annuler — rien n’a été modifié.')
        return
      }
      setNotice(data.message || 'Dernier import annulé ✓')
    } catch {
      setError('L’annulation a échoué — rien n’a été modifié, réessayez.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mt-6 p-5 border border-[var(--line)] bg-[var(--surface)]">
      <p className="font-body text-base font-medium text-[var(--ink)] mb-1">
        Traduire mes textes à la main
      </p>
      <p className="font-body text-sm text-[var(--ink-soft)] mb-4">
        Pour traduire tout votre site une fois pour toutes : exportez vos
        textes français, faites-les relire, puis réimportez le fichier. Ces
        traductions sont marquées « Traduit et relu » et ne seront jamais
        écrasées. La traduction automatique continue de fonctionner pour vos
        futurs ajouts.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={download}
          disabled={busy !== ''}
          className="btn-primary flex-1 text-base disabled:opacity-50"
        >
          {busy === 'export' ? 'Préparation...' : '⬇ Exporter mes textes'}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== ''}
          className="btn-secondary flex-1 text-base disabled:opacity-50"
        >
          {busy === 'lecture' ? 'Lecture...' : '⬆ Importer les traductions'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      {/* Récapitulatif avant enregistrement */}
      {preview && (
        <div className="mt-4 p-4 border border-[var(--line)] bg-[var(--bg)]">
          <p className="font-body text-sm font-medium text-[var(--ink)]">
            {fileName} : {preview.total} traduction{preview.total > 1 ? 's' : ''} prête
            {preview.total > 1 ? 's' : ''} ({preview.parLangue.en} EN,{' '}
            {preview.parLangue.es} ES, {preview.parLangue.de} DE)
            {' — '}
            {preview.erreurs.length} erreur{preview.erreurs.length > 1 ? 's' : ''}
          </p>
          {preview.conserves > 0 && (
            <p className="font-body text-sm text-[var(--ink-soft)] mt-1">
              {preview.conserves} champ{preview.conserves > 1 ? 's' : ''} corrigé
              {preview.conserves > 1 ? 's' : ''} par vous seront conservés tels quels.
            </p>
          )}
          {preview.erreurs.map((e, i) => (
            <p key={i} className="font-body text-sm text-[var(--danger)] mt-1" role="alert">
              ✗ {e}
            </p>
          ))}
          {preview.avertissements.map((a, i) => (
            <p key={i} className="font-body text-xs text-[var(--muted)] mt-1">
              {a}
            </p>
          ))}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            {preview.ok && preview.total > 0 && (
              <button
                type="button"
                onClick={apply}
                disabled={busy !== ''}
                className="btn-primary flex-1 text-sm disabled:opacity-50"
              >
                {busy === 'apply' ? 'Enregistrement...' : '✓ Confirmer l’import'}
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={busy !== ''}
              className="btn-outline flex-1 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
          {preview.erreurs.length > 0 && (
            <p className="font-body text-xs text-[var(--muted)] mt-2">
              Corrigez le fichier puis réimportez-le — rien n’a été enregistré.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={undo}
          disabled={busy !== ''}
          className="font-body text-sm text-[var(--ink-soft)] underline min-h-[44px] disabled:opacity-40"
        >
          {busy === 'undo' ? 'Annulation...' : '↩ Annuler le dernier import'}
        </button>
      </div>

      {notice && (
        <p className="font-body text-sm text-[var(--ink)] mt-3" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="font-body text-sm text-[var(--danger)] mt-3" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
