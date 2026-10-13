import { useTranslations } from 'next-intl'
import { PriceStatus } from '@/lib/types'

const KEYS: Partial<Record<PriceStatus, string>> = {
  vendu: 'vendu',
  // 'réservée' n'existe pas encore en base — prévu ici si le statut arrive.
}

// Badge verre posé sur l'image — lisible sur n'importe quelle couleur de toile.
export default function StatusBadge({ status }: { status: PriceStatus }) {
  const t = useTranslations('status')
  const key = KEYS[status]
  if (!key) return null
  return <span className="glass-badge absolute top-3 right-3 z-10">{t(key)}</span>
}
