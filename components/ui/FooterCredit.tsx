interface Props {
  label: string
  ariaLabel: string
}

// Mention discrète du développeur dans la barre basse du pied de page :
// texte atténué, accent au survol, lien externe en nouvel onglet.
export default function FooterCredit({ label, ariaLabel }: Props) {
  return (
    <a
      href="https://ia-solution.fr/?utm_source=scandellart&utm_medium=footer"
      target="_blank"
      rel="noopener"
      aria-label={ariaLabel}
      className="font-body text-xs text-[var(--muted)] hover:text-[var(--accent-hover)] transition-colors"
    >
      {label}
    </a>
  )
}
