'use client'

import { useCallback, useEffect, useState } from 'react'
import { isSessionExpired, redirectToLogin } from '@/lib/storage'
import {
  buildJobs,
  failedResults,
  failureLine,
  jobsToRetry,
  summaryText,
  type ContentJob,
  type JobResult,
  type LocaleJob,
} from '@/lib/translate-all'

type Phase = 'idle' | 'loading' | 'running' | 'done' | 'error'
type Status = { configured: boolean; pending: number | null }

const TRANSIENT = new Set([408, 409, 425, 429])
const isTransientStatus = (s: number) => TRANSIENT.has(s) || s >= 500
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Une requête par couple (contenu, langue). Si le budget serveur laisse
// des champs restants, on relance la même requête (idempotent).
const MAX_CONTINUATIONS = 8
// 1 retry automatique sur erreur transitoire, en plus des continuations.
const RETRY_DELAY_MS = 2_000

// « Traduire tout mon site » : parcourt toiles, événements et réglages,
// une petite requête à la fois. Les champs réussis sont écrits au fil de
// l'eau ; les échecs sont détaillés (contenu, langue, cause) et peuvent
// être relancés seuls — jamais ce qui a déjà réussi ou été corrigé.
export default function TranslateAllButton() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<JobResult[]>([])
  const [translated, setTranslated] = useState(0)
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

  // Un couple (contenu, langue) — continuations incluses, 1 retry
  // transitoire (429/5xx/coupure), puis le verdict.
  const runJob = async (job: LocaleJob): Promise<JobResult> => {
    const failures: JobResult['failures'] = []
    let translated = 0
    let retried = false
    for (let step = 0; step < MAX_CONTINUATIONS; step++) {
      let res: Response
      try {
        res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: job.entity, id: job.id, locales: [job.locale] }),
        })
      } catch (netErr) {
        if (!retried) {
          retried = true
          await sleep(RETRY_DELAY_MS)
          step--
          continue
        }
        return {
          job,
          translated,
          failures: [{ field: '(tout)', raison: 'La connexion a été coupée — réessayez' }],
          detail: String(netErr),
        }
      }
      if (res.status === 401) {
        redirectToLogin()
        return { job, translated, failures: [] }
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (isTransientStatus(res.status) && !retried) {
          retried = true
          await sleep(RETRY_DELAY_MS)
          step--
          continue
        }
        const raison =
          res.status === 504 || res.status === 502
            ? 'La requête a pris trop de temps — réessayez'
            : data.error || 'La requête a échoué — réessayez'
        return { job, translated, failures: [{ field: '(tout)', raison }], detail: `HTTP ${res.status}` }
      }
      translated += data.translated || 0
      for (const f of data.failures || []) failures.push(f)
      if ((data.remaining || 0) <= 0) {
        return { job, translated, failures }
      }
      // Budget serveur épuisé : on relance la même requête, planField
      // reprend exactement là où on s'était arrêté.
    }
    return {
      job,
      translated,
      failures: [
        ...failures,
        { field: '(tout)', raison: 'Texte trop long pour une seule passe — réessayez' },
      ],
      detail: 'trop de continuations',
    }
  }

  const run = async (jobs: LocaleJob[]) => {
    setError('')
    setPhase('running')
    try {
      const out: JobResult[] = []
      let translatedCount = 0
      for (let i = 0; i < jobs.length; i++) {
        setProgress({ done: i, total: jobs.length })
        const r = await runJob(jobs[i])
        out.push(r)
        translatedCount += r.translated
        setProgress({ done: i + 1, total: jobs.length })
      }
      setResults(out)
      setTranslated(translatedCount)
      setPhase('done')
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

  const start = async () => {
    setError('')
    setPhase('loading')
    try {
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
      const contents: ContentJob[] = [
        ...paintings.map((p: { id: string; title?: string }) => ({
          entity: 'painting' as const,
          id: p.id,
          label: p.title || 'Toile sans titre',
        })),
        ...events.map((e: { id: string; title?: string }) => ({
          entity: 'event' as const,
          id: e.id,
          label: e.title || 'Événement sans titre',
        })),
        ...(settingsRes.ok
          ? [{ entity: 'settings' as const, label: 'Votre présentation et vos légendes' }]
          : []),
      ]
      const jobs = buildJobs(contents)
      if (jobs.length === 0) {
        setPhase('done')
        setResults([])
        return
      }
      setResults([])
      await run(jobs)
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
  const failedJobs = jobsToRetry(results)
  const failureLines = failedResults(results).flatMap(failureLine)

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
        onClick={start}
        disabled={busy}
        className="btn-primary w-full text-base disabled:opacity-50"
      >
        {busy ? 'Traduction en cours…' : '🌐 Traduire tout mon site'}
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
            Traduction {progress.done} sur {progress.total}…
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-4" role="status">
          <p className="font-body text-sm text-[var(--ink)]">
            {results.length === 0
              ? 'Rien à traduire pour l’instant.'
              : summaryText(results, translated)}
          </p>
          {failureLines.length > 0 && (
            <ul className="mt-2 space-y-1">
              {failureLines.map((l, i) => (
                <li key={i} className="font-body text-sm text-[var(--danger)]">
                  {l}
                </li>
              ))}
            </ul>
          )}
          {failedJobs.length > 0 && (
            <button
              type="button"
              onClick={() => run(failedJobs)}
              disabled={busy}
              className="btn-primary w-full text-base mt-3 disabled:opacity-50"
            >
              ↻ Réessayer seulement ceux qui ont échoué
            </button>
          )}
          {results.some((r) => r.detail) && (
            <details className="mt-3">
              <summary className="font-body text-xs text-[var(--muted)] cursor-pointer">
                Détails techniques
              </summary>
              <ul className="mt-1 space-y-0.5">
                {results
                  .filter((r) => r.detail)
                  .map((r, i) => (
                    <li key={i} className="font-body text-xs text-[var(--muted)]">
                      {r.job.label} / {r.job.locale} — {r.detail}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {error && (
        <p className="font-body text-sm text-[var(--danger)] mt-4" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
