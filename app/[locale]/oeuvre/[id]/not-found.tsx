import { getTranslations } from 'next-intl/server'
import NotFoundContent from '@/components/ui/NotFoundContent'

// 404 propre à la fiche œuvre : « Œuvre introuvable » plutôt que le message
// générique — la page générale garde le texte neutre dans les 4 langues.
export default async function NotFound() {
  const t = await getTranslations('detail')
  return <NotFoundContent body={t('notFound')} />
}
