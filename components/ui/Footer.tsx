import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { headers } from 'next/headers'
import Logo from '@/components/ui/Logo'
import InstallLink from '@/components/pwa/InstallLink'
import { GallerySettings } from '@/lib/types'
import type { Locale } from '@/i18n/routing'

export default async function Footer({
  settings,
  locale,
}: {
  settings: GallerySettings
  locale?: Locale
}) {
  const t = await getTranslations('footer')
  const tn = await getTranslations('nav')
  const tl = await getTranslations('lang')
  const ti = await getTranslations('install')
  // /informations-legales : aucun e-mail ni téléphone affiché sur la page.
  const isLegalPage = headers().get('x-legal-page') === '1'

  return (
    <footer className="footer w-full border-t border-[var(--line)] bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto gutter-x py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          {/* Identité */}
          <div className="max-w-xs">
            <Link
              href="/"
              aria-label={tn('homeAria')}
              className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
            >
              <Logo className="text-[30px]" />
            </Link>
            <p className="font-body text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">
              {settings.bioShort}
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label={t('navigation')}>
            <p className="eyebrow mb-4">{t('navigation')}</p>
            <div className="flex flex-col gap-2">
              <Link href="/galerie" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                {tn('galerie')}
              </Link>
              <Link href="/expositions" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                {tn('expositions')}
              </Link>
              <Link href="/contact" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                {tn('contact')}
              </Link>
            </div>
          </nav>

          {/* Contact — masqué sur /informations-legales (aucun e-mail affiché) */}
          {!isLegalPage && (
            <div>
              <p className="eyebrow mb-4">{t('contact')}</p>
            <div className="flex flex-col gap-2">
              {settings.email && (
                <a
                  href={`mailto:${settings.email}`}
                  className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  {settings.email}
                </a>
              )}
              {settings.phone && (
                <a
                  href={`tel:${settings.phone.replace(/\s/g, '')}`}
                  className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  {settings.phone}
                </a>
              )}
              {settings.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  Instagram
                </a>
              )}
            </div>
            </div>
          )}

          {/* Langues */}
          <nav aria-label={tl('label')}>
            <p className="eyebrow mb-4">{tl('label')}</p>
            <div className="flex flex-col gap-2">
              <Suspense fallback={null}>
                <LanguageSwitcher variant="list" locale={locale} />
              </Suspense>
            </div>
          </nav>
        </div>

        {/* Installation de l'app — mobile uniquement */}
        <div className="mt-8 md:hidden">
          <InstallLink label={ti('link')} />
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <p className="font-body text-xs text-[var(--muted)]">
              &copy; {new Date().getFullYear()} {settings.artistName} — {t('rights')}
            </p>
            <Link
              href="/informations-legales"
              className="font-body text-xs text-[var(--muted)] hover:text-[var(--accent-hover)] transition-colors underline-offset-4 hover:underline"
            >
              {t('legal')}
            </Link>
          </div>
          <p className="font-body text-xs text-[var(--muted)]">
            {t('originals')}
          </p>
        </div>
      </div>
    </footer>
  )
}
