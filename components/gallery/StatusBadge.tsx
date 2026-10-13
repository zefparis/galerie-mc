import { PriceStatus } from '@/lib/types'

const LABELS: Partial<Record<PriceStatus, string>> = {
  vendu: 'Vendue',
  // 'réservée' n'existe pas encore en base — prévu ici si le statut arrive.
}

// Badge verre posé sur l'image — lisible sur n'importe quelle couleur de toile.
export default function StatusBadge({ status }: { status: PriceStatus }) {
  const label = LABELS[status]
  if (!label) return null
  return <span className="glass-badge absolute top-3 right-3 z-10">{label}</span>
}
