import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Logo from '@/components/ui/Logo'
import OfflineRetry from '@/components/pwa/OfflineRetry'
import type { Locale } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({
    locale: params.locale as Locale,
    namespace: 'offline',
  })
  // Page utilitaire : jamais indexée.
  return { title: t('title'), robots: { index: false, follow: false } }
}

// Repli servi par le service worker quand le réseau est absent. La mise en
// cache se fait à l'installation du worker (voir public/sw.js) — la page
// doit rester légère et sans donnée.
export default async function OfflinePage() {
  const t = await getTranslations('offline')
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center gutter-x pt-24 pb-16">
      <Logo className="text-3xl" />
      <h1 className="mt-10 font-display text-3xl md:text-4xl text-[var(--ink)]">
        {t('title')}
      </h1>
      <p className="mt-4 max-w-md font-body text-base text-[var(--muted)]">
        {t('message')}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <OfflineRetry label={t('retry')} />
        <Link
          href="/"
          className="inline-flex items-center justify-center px-7 py-3.5 border border-[var(--line)] text-[var(--ink)] font-body text-sm font-medium min-h-[48px] hover:border-[var(--ink)] transition-colors duration-300"
        >
          {t('home')}
        </Link>
      </div>
    </div>
  )
}
