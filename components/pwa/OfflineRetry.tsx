'use client'

// Bouton « Réessayer » de la page hors ligne : recharge l'URL demandée à
// l'origine (le service worker a répondu le repli sur la même adresse).
export default function OfflineRetry({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="btn-accent"
    >
      {label}
    </button>
  )
}
