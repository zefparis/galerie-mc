interface Props {
  /** Sur-titre éditorial (bioShort avec « | » normalisé en « · »). */
  eyebrow: string
  /** Nom de l'artiste — grand titre de la page d'accueil. */
  name: string
  /** Phrase d'accroche éditable ; vide → rien n'est affiché. */
  tagline?: string
}

// Bloc titre du hero (sur-titre, nom, accroche) — partagé entre la page
// d'accueil et l'aperçu admin « Présentation » pour ne jamais diverger.
export default function HeroHeading({ eyebrow, name, tagline }: Props) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display title-page mt-4 md:mt-5 leading-[0.98] text-balance text-[var(--ink)]">
        {name}
      </h1>
      {tagline && (
        <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 max-w-md">
          {tagline}
        </p>
      )}
    </>
  )
}
