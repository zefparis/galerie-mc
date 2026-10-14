import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { alternatesFor } from '@/lib/seo'
import { formatDate, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { id: 'mentions-legales', title: 's1Title', body: 's1Body' },
  { id: 'vie-privee', title: 's2Title', body: 's2Body' },
  { id: 'acheter', title: 's3Title', body: 's3Body' },
] as const

// Date de la dernière révision du contenu — affichée localisée.
const UPDATED = new Date(2026, 9, 14)

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'legal' })
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: alternatesFor('/informations-legales', locale),
  }
}

export default async function LegalPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'legal' })

  return (
    <div className="pt-16 md:pt-20">
      <div className="max-w-[65ch] mx-auto gutter-x pt-10 md:pt-16 pb-20 md:pb-28">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display title-page text-[var(--ink)] mt-3">{t('title')}</h1>
          <p className="font-body text-sm text-[var(--muted)] mt-4">
            {t('updated', { date: formatDate(UPDATED, locale) })}
          </p>

          {/* Les versions traduites sont indicatives : le français fait foi. */}
          {locale !== 'fr' && (
            <p className="font-body text-sm italic text-[var(--ink-soft)] mt-6 p-4 border-l-2 border-[var(--accent)] bg-[var(--surface)]">
              {t('disclaimer')}
            </p>
          )}

          {/* Sommaire — ancres vers les trois sections */}
          <nav aria-label={t('title')} className="mt-8">
            <ul className="space-y-1.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="font-body text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors underline-offset-4 hover:underline"
                  >
                    {t(s.title)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.id} className="mt-14 md:mt-16">
            <h2
              id={s.id}
              className="font-display text-3xl md:text-4xl text-[var(--ink)] scroll-mt-24"
            >
              {t(s.title)}
            </h2>
            <div className="mt-6 space-y-5">
              {t(s.body)
                .split(/\n+/)
                .filter((p) => p.trim())
                .map((p, i) => (
                  <p
                    key={i}
                    className="font-display text-lg text-[var(--ink-soft)] leading-[1.85]"
                  >
                    {p}
                  </p>
                ))}
            </div>
            {s.id === 'mentions-legales' && (
              <p className="mt-6">
                <Link
                  href="/contact"
                  className="font-body text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors underline underline-offset-4"
                >
                  {t('contactCta')} →
                </Link>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
