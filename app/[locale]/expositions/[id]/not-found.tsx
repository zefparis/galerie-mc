import { getTranslations } from 'next-intl/server'
import NotFoundContent from '@/components/ui/NotFoundContent'

// 404 propre à la fiche exposition : « Événement introuvable » plutôt que le
// message générique — la page générale garde le texte neutre.
export default async function NotFound() {
  const t = await getTranslations('events')
  return <NotFoundContent body={t('notFound')} />
}
