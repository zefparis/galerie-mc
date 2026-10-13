import { notFound } from 'next/navigation'
import { routing, type Locale } from '@/i18n/routing'

// Valide la langue : /xx/... inconnu → 404.
export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!routing.locales.includes(params.locale as Locale)) notFound()
  return children
}
