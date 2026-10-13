import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// Contenu 404 partagé : utilisé par app/[locale]/not-found.tsx (notFound()
// dans une page existante) et app/not-found.tsx (URL non matchée, où le
// catch-all renvoie au /_not-found global). La langue vient de la requête —
// le middleware pose X-NEXT-INTL-LOCALE avant le routage ; repli français
// hors site public (admin, api).
export default async function NotFoundContent() {
  const t = await getTranslations('notFound')
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 pt-16 text-center">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1 className="font-display text-6xl md:text-8xl text-[var(--ink)] mt-4">404</h1>
      <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-md">
        {t('body')}
      </p>
      <Link href="/galerie" className="btn-accent mt-8">
        {t('cta')}
      </Link>
    </div>
  )
}
