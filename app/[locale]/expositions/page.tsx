import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getPublishedEvents } from '@/lib/data'
import { localizeEvent } from '@/lib/i18n'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import EventCard from '@/components/gallery/EventCard'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'events' })
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: alternatesFor('/expositions', locale),
    openGraph: {
      title: `${t('metaTitle')} — Marie-Claire Scandella`,
      description: t('metaDesc'),
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

export default async function ExpositionsPage(props: Props) {
  const params = await props.params;
  const t = await getTranslations('events')
  const events = (await getPublishedEvents()).map((e) =>
    localizeEvent(e, params.locale as Locale)
  )

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto gutter-x pt-10 md:pt-20 pb-10 md:pb-16">
        <Reveal>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display title-page text-[var(--ink)] mt-3">
            {t('title')}
          </h1>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto gutter-x pb-20 md:pb-32">
        {events.length === 0 ? (
          <p className="font-body text-[var(--muted)] py-16 text-center">
            {t('empty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
            {events.map((evt, i) => (
              <Reveal key={evt.id} delay={(i % 2) * 80}>
                <EventCard event={evt} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
