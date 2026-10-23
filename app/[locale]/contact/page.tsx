import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import ContactForm from '@/components/contact/ContactForm'
import { getGallerySettings } from '@/lib/data'
import { mailConfigured } from '@/lib/mail'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'contact' })
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: alternatesFor('/contact', locale),
    openGraph: {
      title: `${t('metaTitle')} — Marie-Claire Scandella`,
      description: t('metaDesc'),
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

export default async function ContactPage() {
  const t = await getTranslations('contact')
  const tf = await getTranslations('footer')
  const settings = await getGallerySettings()
  return (
    <div className="pt-16 md:pt-20">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <p className="font-body text-sm text-[var(--muted)]">{t('loading')}</p>
          </div>
        }
      >
        <ContactForm
          artistEmail={settings.email}
          instagramUrl={settings.instagramUrl}
          instagramAria={tf('instagramAria')}
          mailConfigured={mailConfigured()}
        />
      </Suspense>
    </div>
  )
}
