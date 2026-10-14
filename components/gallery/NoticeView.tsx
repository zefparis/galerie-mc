import type { PaintingNotice } from '@/lib/types'

// Notice publique d'une toile — composant d'affichage pur, réutilisé
// tel quel par la page œuvre (public) et par l'aperçu de la carte
// « Présentation de cette toile » (admin). Tout le texte est rendu en
// React échappé : jamais de HTML injecté.

export interface NoticeLabels {
  ambiance: string
  matiere: string
  fiche: string
  dimensionsLabel: string
  techniqueLabel: string
  yearLabel: string
  signatureLabel: string
  // « Pas encore traduit — texte français affiché » (mention discrète).
  notTranslated?: string
}

interface Props {
  notice: PaintingNotice
  labels: NoticeLabels
  // Fiche technique (données de la toile, affichées si renseignées).
  dimensions?: string
  technique?: string
  year?: number
  signature?: string
  // Vrai quand la langue courante n'a pas de traduction de la notice :
  // le français s'affiche avec la mention notTranslated.
  untranslated?: boolean
}

const sectionTitle =
  'font-body text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--accent)]'

export default function NoticeView({
  notice,
  labels,
  dimensions,
  technique,
  year,
  signature,
  untranslated,
}: Props) {
  const hasFiche = !!(dimensions || technique || year || signature)
  return (
    <div className="notice-view">
      {untranslated && labels.notTranslated && (
        <p className="font-body text-[11px] italic text-[var(--muted)] mb-4">
          {labels.notTranslated}
        </p>
      )}

      {notice.accroche ? (
        <p className="font-display text-xl md:text-2xl text-[var(--ink)] leading-snug italic">
          {notice.accroche}
        </p>
      ) : null}

      {notice.texte_client ? (
        <div className="max-w-[65ch] mt-6 space-y-5">
          {notice.texte_client
            .split(/\n+/)
            .filter((p) => p.trim())
            .map((p, i) => (
              <p
                key={i}
                className="font-display text-lg text-[var(--ink-soft)] leading-[1.85]"
              >
                {p}
              </p>
            ))}
        </div>
      ) : null}

      {notice.ambiance ? (
        <div className="mt-10">
          <h2 className={sectionTitle}>{labels.ambiance}</h2>
          <p className="font-display text-lg text-[var(--ink-soft)] leading-[1.85] max-w-[65ch] mt-3 whitespace-pre-line">
            {notice.ambiance}
          </p>
        </div>
      ) : null}

      {notice.matiere_technique.length > 0 && (
        <div className="mt-10">
          <h2 className={sectionTitle}>{labels.matiere}</h2>
          <ul className="mt-3 space-y-2 max-w-[65ch]">
            {notice.matiere_technique.map((p, i) => (
              <li
                key={i}
                className="font-body text-[15px] text-[var(--ink-soft)] leading-relaxed flex gap-3"
              >
                <span aria-hidden="true" className="text-[var(--accent)] flex-shrink-0">
                  —
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasFiche && (
        <div className="mt-10 pt-6 border-t border-[var(--line)]">
          <h2 className={sectionTitle}>{labels.fiche}</h2>
          <dl className="mt-3 space-y-1.5 max-w-[65ch]">
            {dimensions && (
              <div className="flex gap-2 font-body text-sm">
                <dt className="text-[var(--muted)]">{labels.dimensionsLabel}</dt>
                <dd className="text-[var(--ink-soft)]">{dimensions}</dd>
              </div>
            )}
            {technique && (
              <div className="flex gap-2 font-body text-sm">
                <dt className="text-[var(--muted)]">{labels.techniqueLabel}</dt>
                <dd className="text-[var(--ink-soft)]">{technique}</dd>
              </div>
            )}
            {year ? (
              <div className="flex gap-2 font-body text-sm">
                <dt className="text-[var(--muted)]">{labels.yearLabel}</dt>
                <dd className="text-[var(--ink-soft)]">{year}</dd>
              </div>
            ) : null}
            {signature && (
              <div className="flex gap-2 font-body text-sm">
                <dt className="text-[var(--muted)]">{labels.signatureLabel}</dt>
                <dd className="text-[var(--ink-soft)]">{signature}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
