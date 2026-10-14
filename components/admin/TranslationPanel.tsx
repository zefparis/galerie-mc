'use client'

import { useState } from 'react'
import { fieldStatus } from '@/lib/translations-core'
import type { TargetLocale, Translations } from '@/lib/types'

const LOCALE_TABS: { locale: TargetLocale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'es', label: 'Español' },
  { locale: 'de', label: 'Deutsch' },
]

const STATUS_LABEL: Record<string, string> = {
  auto: 'Traduit',
  corrige: 'Corrigé par vous',
  a_mettre_a_jour: 'À mettre à jour',
  echec: 'Échec',
  non_traduit: 'Non traduit',
}

export interface TranslatableField {
  key: string
  label: string
  multiline?: boolean
}

interface Props {
  entity: 'painting' | 'event' | 'settings'
  entityId?: string
  fields: TranslatableField[]
  // Valeurs françaises actuelles (le formulaire en cours de saisie).
  french: Record<string, string>
  translations: Translations | undefined
  onTranslationsChange: (t: Translations) => void
}

// Panneau replié « Voir les traductions » : trois onglets, texte modifiable,
// état par langue, bouton « Retraduire ». Les corrections sont enregistrées
// via /api/translate (statut « Corrigé par vous », jamais écrasées ensuite).
export default function TranslationPanel({
  entity,
  entityId,
  fields,
  french,
  translations,
  onTranslationsChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TargetLocale>('en')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const shownFields = fields.filter((f) => (french[f.key] || '').trim() !== '')
  const fieldKey = (f: string) => `${tab}:${f}`

  const valueOf = (f: string) =>
    dirty[fieldKey(f)] ? drafts[fieldKey(f)] : (translations?.[tab]?.[f] ?? '')

  const setValue = (f: string, v: string) => {
    setDrafts({ ...drafts, [fieldKey(f)]: v })
    setDirty({ ...dirty, [fieldKey(f)]: true })
  }

  const hasCorrections = shownFields.some(
    (f) => dirty[fieldKey(f.key)] && valueOf(f.key) !== (translations?.[tab]?.[f.key] ?? '')
  )

  const saveCorrections = async () => {
    setBusy('save')
    setError('')
    setNotice('')
    const corrections: Record<string, string> = {}
    for (const f of shownFields) {
      if (dirty[fieldKey(f.key)]) corrections[f.key] = valueOf(f.key)
    }
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, id: entityId, corrections: { [tab]: corrections } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'error')
      onTranslationsChange(data.translations)
      setDirty({})
      setDrafts({})
      setNotice('Vos corrections sont enregistrées ✓')
    } catch {
      setError("Impossible d'enregistrer — réessayez, rien n'a été perdu.")
    } finally {
      setBusy('')
    }
  }

  const retranslate = async (field?: string) => {
    setBusy(field || 'all')
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity,
          id: entityId,
          locales: [tab],
          ...(field ? { fields: [field] } : {}),
          force: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          data.error === 'migration-needed'
            ? 'La traduction n’est pas encore prête côté base de données.'
            : 'La traduction automatique n’est pas configurée pour l’instant. Vous pouvez écrire la traduction vous-même puis « Enregistrer mes corrections ».'
        )
        return
      }
      onTranslationsChange(data.translations)
      setDirty({})
      setDrafts({})
      // La route renvoie 200 même si certains champs ont échoué — on lit
      // errors pour ne jamais afficher un succès à tort.
      if ((data.errors || 0) > 0) {
        setError(
          'Certains champs n’ont pas pu être traduits — leur état passe en « Échec », ' +
            'vous pouvez les réessayer un par un.'
        )
      } else {
        setNotice(field ? 'Traduction refaite ✓' : 'Tout a été retraduit ✓')
      }
    } catch {
      setError('La traduction a échoué — réessayez dans un instant.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 min-h-[52px] text-left"
      >
        <span className="font-body text-base font-medium text-[var(--ink)]">
          🌐 Voir les traductions
        </span>
        <span className="font-body text-sm text-[var(--muted)]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--line)]">
          <p className="font-body text-sm text-[var(--ink-soft)] mt-4 mb-4">
            Vos textes français sont traduits automatiquement. Vous pouvez
            corriger une traduction — votre version ne sera jamais écrasée.
          </p>

          {/* Onglets langue */}
          <div className="flex gap-2 mb-4" role="tablist">
            {LOCALE_TABS.map((t) => (
              <button
                key={t.locale}
                type="button"
                role="tab"
                aria-selected={tab === t.locale}
                onClick={() => {
                  setTab(t.locale)
                  setDirty({})
                  setDrafts({})
                  setNotice('')
                  setError('')
                }}
                className={`px-4 py-3 min-h-[48px] border font-body text-sm transition-colors ${
                  tab === t.locale
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium'
                    : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {shownFields.length === 0 ? (
            <p className="font-body text-sm text-[var(--muted)]">
              Rien à traduire pour l’instant — remplissez d’abord le français.
            </p>
          ) : (
            <div className="space-y-5">
              {shownFields.map((f) => {
                const status = fieldStatus(translations, f.key, tab, french[f.key] || '')
                const raison = translations?._meta?.[f.key]?.[tab]?.erreur
                const running = busy === f.key || busy === 'all'
                return (
                  <div key={f.key}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="font-body text-sm font-medium text-[var(--ink)]">
                        {f.label}
                      </p>
                      <span
                        className={`font-body text-[11px] uppercase tracking-wide px-2 py-1 border ${
                          running
                            ? 'border-[var(--line)] text-[var(--muted)]'
                            : status === 'a_mettre_a_jour' || status === 'echec'
                              ? 'border-[var(--warning-line)] text-[var(--warning-ink)]'
                              : status === 'corrige'
                                ? 'border-[var(--accent)] text-[var(--accent)]'
                                : status === 'non_traduit'
                                  ? 'border-[var(--line)] text-[var(--muted)]'
                                  : 'border-[var(--line)] text-[var(--ink-soft)]'
                        }`}
                      >
                        {running ? 'En cours…' : STATUS_LABEL[status]}
                      </span>
                    </div>
                    {status === 'echec' && raison && (
                      <p className="font-body text-xs text-[var(--danger)] mb-1.5" role="status">
                        {raison}
                      </p>
                    )}
                    <p className="font-body text-xs text-[var(--muted)] italic mb-2 line-clamp-2">
                      « {french[f.key]} »
                    </p>
                    {f.multiline ? (
                      <textarea
                        value={valueOf(f.key)}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        rows={3}
                        className="input-field text-sm resize-y"
                        placeholder="Pas encore traduit"
                      />
                    ) : (
                      <input
                        type="text"
                        value={valueOf(f.key)}
                        onChange={(e) => setValue(f.key, e.target.value)}
                        className="input-field text-sm"
                        placeholder="Pas encore traduit"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => retranslate(f.key)}
                      disabled={busy !== ''}
                      className="mt-1.5 font-body text-xs text-[var(--ink-soft)] underline min-h-[44px] disabled:opacity-40"
                    >
                      {busy === f.key
                        ? 'Traduction en cours...'
                        : status === 'echec'
                          ? '↻ Réessayer ce champ'
                          : 'Retraduire ce champ'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {notice && (
            <p className="font-body text-sm text-[var(--ink)] mt-4" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="font-body text-sm text-[var(--danger)] mt-4" role="alert">
              {error}
            </p>
          )}

          {shownFields.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button
                type="button"
                onClick={saveCorrections}
                disabled={busy !== '' || !hasCorrections}
                className="btn-secondary flex-1 text-sm disabled:opacity-40"
              >
                {busy === 'save' ? 'Enregistrement...' : '✓ Enregistrer mes corrections'}
              </button>
              <button
                type="button"
                onClick={() => retranslate()}
                disabled={busy !== ''}
                className="btn-outline flex-1 text-sm disabled:opacity-40"
              >
                {busy === 'all' ? 'Traduction en cours...' : 'Retraduire cette langue'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
