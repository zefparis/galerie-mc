'use client'

import { useCallback, useEffect, useState } from 'react'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'

type Phase = 'idle' | 'loading' | 'running' | 'done' | 'error'
type Status = { configured: boolean; pending: number | null }

// « Traduire tout mon site » : parcourt toiles, événements et réglages.
// Idempotent — ne retraduit ni ce qui est à jour ni ce qui a été corrigé ;
// on peut le relancer sans risque, il reprend là où ça manque.
export default function TranslateAllButton() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/translate')
      if (res.status === 401) return
      if (res.ok) setStatus(await res.json())
    } catch {
      /* indicateur facultatif : on ne bloque rien */
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const run = async () => {
    setError('')
    setSummary('')
    setPhase('loading')
    try {
      // On récupère la liste des contenus à traduire.
      const [paintingsRes, eventsRes, settingsRes] = await Promise.all([
        fetch('/api/paintings'),
        fetch('/api/events?all=true'),
        fetch('/api/settings'),
      ])
      if (paintingsRes.status === 401) {
        redirectToLogin()
        return
      }
      const paintings = paintingsRes.ok ? await paintingsRes.json() : []
      const events = eventsRes.ok ? await eventsRes.json() : []
      const jobs: { entity: 'painting' | 'event' | 'settings'; id?: string }[] = [
        ...paintings.map((p: { id: string }) => ({ entity: 'painting' as const, id: p.id })),
        ...events.map((e: { id: string }) => ({ entity: 'event' as const, id: e.id })),
        ...(settingsRes.ok ? [{ entity: 'settings' as const }] : []),
      ]
      if (jobs.length === 0) {
        setPhase('done')
        setSummary('Rien à traduire pour l’instant.')
        return
      }

      setPhase('running')
      setProgress({ done: 0, total: jobs.length })
      let translated = 0
      let failures = 0
      for (const job of jobs) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job),
          })
          if (res.status === 401) {
            redirectToLogin()
            return
          }
          const data = await res.json().catch(() => ({}))
          // Un contenu compte en échec dès qu'un champ n'a pas été traduit —
          // la route renvoie 200 avec errors>0, jamais de faux succès.
          if (!res.ok || (data.errors || 0) > 0) failures++
          else translated += data.translated || 0
        } catch {
          failures++
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }))
      }
      setPhase('done')
      setSummary(
        failures === 0
          ? `C’est fait ✓ ${translated > 0 ? `${translated} texte${translated > 1 ? 's' : ''} traduit${translated > 1 ? 's' : ''}.` : 'Tout était déjà à jour.'}`
          : `Terminé, mais ${failures} contenu${failures > 1 ? 's n’ont' : ' n’a'} pas pu être traduit${failures > 1 ? 's' : ''} — relancez le bouton pour réessayer, rien n’est perdu.`
      )
      refreshStatus()
    } catch (err) {
      if (isSessionExpired(err)) {
        redirectToLogin()
        return
      }
      setPhase('error')
      setError('La traduction n’a pas pu démarrer — vérifiez votre connexion et réessayez.')
    }
  }

  const busy = phase === 'loading' || phase === 'running'
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mt-6 p-5 border border-[var(--line)] bg-[var(--surface)]">
      <p className="font-body text-base font-medium text-[var(--ink)] mb-1">
        Traduire tout mon site
      </p>
      <p className="font-body text-sm text-[var(--ink-soft)] mb-4">
        Traduit en anglais, espagnol et allemand tout ce qui n’est pas encore
        traduit — vos toiles, vos événements, votre présentation. Ce qui est
        déjà traduit ou corrigé par vous n’est pas touché.
      </p>

      {status && (
        <p className="font-body text-sm font-medium text-[var(--ink)] mb-3" role="status">
          {status.pending === null
            ? 'État des traductions indisponible pour l’instant.'
            : status.pending > 0
              ? `${status.pending} contenu${status.pending > 1 ? 's' : ''} à traduire`
              : 'Tout est traduit ✓'}
        </p>
      )}
      {status && !status.configured && (
        <p className="font-body text-sm text-[var(--danger)] mb-3" role="alert">
          La traduction automatique n’est pas configurée (clé manquante) — les
          boutons de traduction ne fonctionneront pas. Prévenez la personne qui
          s’occupe du site.
        </p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="btn-primary w-full text-base disabled:opacity-50"
      >
        {busy ? 'Traduction en cours...' : '🌐 Traduire tout mon site'}
      </button>

      {phase === 'running' && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-2 bg-[var(--line)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="font-body text-sm text-[var(--muted)] mt-2">
            {progress.done} contenu{progress.done > 1 ? 's' : ''} sur {progress.total}…
          </p>
        </div>
      )}

      {summary && (
        <p className="font-body text-sm text-[var(--ink)] mt-4" role="status">
          {summary}
        </p>
      )}
      {error && (
        <p className="font-body text-sm text-[var(--danger)] mt-4" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
