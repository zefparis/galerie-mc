'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useCleanPathname } from '@/i18n/pathname'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import Logo from '@/components/ui/Logo'
import type { Locale } from '@/i18n/routing'

const HREFS = ['/galerie', '/expositions', '/contact'] as const

// `locale` vient du layout serveur ([locale] ou 404 racine) : la langue
// affichée par le sélecteur est celle de la page servie, jamais un état
// client potentiellement périmé.
export default function Navbar({ artistName, locale }: { artistName: string; locale?: Locale }) {
  const t = useTranslations('nav')
  const pathname = useCleanPathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const touchStartX = useRef(0)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const labels: Record<(typeof HREFS)[number], string> = {
    '/galerie': t('galerie'),
    '/expositions': t('expositions'),
    '/contact': t('contact'),
  }
  // pathname est déjà dépréfixé (useCleanPathname lit l'URL réelle).
  const isActive = (href: string) => pathname.startsWith(href)

  // L'admin a son propre header — pas de nav publique.
  if (pathname.startsWith('/admin')) return null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientX - touchStartX.current > 80) setDrawerOpen(false)
  }

  return (
    <>
      <nav className="navbar fixed top-0 left-0 right-0 z-40 bg-[var(--bg)] text-[var(--ink)] border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto gutter-x h-16 md:h-20 flex items-center justify-between">
          <Link
            href="/"
            className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)]"
            aria-label={t('homeAria')}
          >
            <Logo className="text-[27px] md:text-[40px]" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-9">
            {HREFS.map((href) => (
              <Link
                key={href}
                href={href}
                className={`font-body text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-200 whitespace-nowrap ${
                  isActive(href)
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
                aria-current={isActive(href) ? 'page' : undefined}
              >
                {labels[href]}
              </Link>
            ))}
          </div>

          <div className="flex items-center">
            <div className="hidden md:block">
              <Suspense fallback={null}>
                <LanguageSwitcher locale={locale} />
              </Suspense>
            </div>
            <ThemeToggle />
            {/* Mobile hamburger */}
            <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -mr-2"
            aria-label={t('openMenu')}
            aria-expanded={drawerOpen}
          >
            <div className="w-6 flex flex-col gap-[7px]">
              <span className="block h-[1.5px] bg-[var(--ink)]" />
              <span className="block h-[1.5px] bg-[var(--ink)]" />
            </div>
          </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setDrawerOpen(false)}
        />
        <div
          className={`mobile-drawer absolute top-0 right-0 h-full w-[300px] max-w-[85vw] bg-[var(--night)] text-[var(--on-night)] flex flex-col transition-transform duration-300 ease-gallery ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between p-4">
            <Link
              href="/"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('homeAria')}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--on-night)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--night)]"
            >
              <Logo onNight className="text-[26px]" />
            </Link>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-3 text-[var(--on-night-muted)] hover:text-[var(--on-night)] transition-colors"
              aria-label={t('closeMenu')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col px-8 mt-2">
            {HREFS.map((href, i) => (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={`font-display text-3xl py-5 min-h-[56px] flex items-center border-b border-white/10 transition-colors duration-200 ${
                  isActive(href)
                    ? 'text-[var(--accent-on-night)]'
                    : 'text-[var(--on-night)] hover:text-[var(--on-night-muted)]'
                }`}
                style={{ transitionDelay: drawerOpen ? `${i * 40}ms` : '0ms' }}
              >
                {labels[href]}
              </Link>
            ))}
          </div>
          <div className="mt-auto px-8 pb-10">
            <Suspense fallback={null}>
              <LanguageSwitcher variant="dark" locale={locale} />
            </Suspense>
            <p className="font-body text-xs text-[var(--on-night-faint)] uppercase tracking-[0.18em] mt-6">
              {artistName}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
