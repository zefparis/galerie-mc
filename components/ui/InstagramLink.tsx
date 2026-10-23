// Lien vers le compte Instagram de l'artiste : icône SVG inline +
// libellé « Instagram », nouvel onglet sécurisé (noopener) et marqueur
// « me » pour la vérification de propriétaire. Rien n'est rendu si
// aucune URL n'est configurée dans les réglages.
export default function InstagramLink({
  url,
  ariaLabel,
  className = '',
}: {
  url?: string | null
  ariaLabel: string
  className?: string
}) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer me"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.25" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <span>Instagram</span>
    </a>
  )
}
