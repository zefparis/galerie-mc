// Logotype « Scandell'Art » — vrai texte (Fraunces auto-hébergée), pas une
// image : net à toutes les densités, suit le thème via les tokens.
// `onNight` pour les surfaces toujours sombres (tiroir mobile) : l'encre
// standard serait illisible sur --night en thème clair.
export default function Logo({
  onNight = false,
  className = '',
}: {
  onNight?: boolean
  className?: string
}) {
  return (
    <span
      className={`font-brand font-normal whitespace-nowrap leading-none tracking-tight ${className} ${
        onNight ? 'text-[var(--on-night)]' : 'text-[var(--ink)]'
      }`}
      aria-hidden="true"
    >
      Scandell
      <span className={onNight ? 'text-[var(--accent-on-night)]' : 'text-[var(--accent)]'}>
        ’Art
      </span>
    </span>
  )
}
