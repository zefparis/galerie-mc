'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'

const links = [
  { href: '/galerie', label: 'Galerie' },
  { href: '/expositions', label: 'Expositions' },
  { href: '/contact', label: 'Contact' },
]

export default function Navbar({ artistName }: { artistName: string }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const touchStartX = useRef(0)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

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
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="min-w-0" aria-label="Accueil — Marie-Claire Scandella">
            <span className="font-display text-xl md:text-2xl tracking-wide truncate block">
              {artistName}
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-9">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center">
            <ThemeToggle />
            {/* Mobile hamburger */}
            <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -mr-2"
            aria-label="Ouvrir le menu"
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
          className={`absolute top-0 right-0 h-full w-[300px] max-w-[85vw] bg-[var(--night)] text-[var(--night-ink)] flex flex-col transition-transform duration-300 ease-gallery ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-end p-4">
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-3 text-white/80 hover:text-white"
              aria-label="Fermer le menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col px-8 mt-2">
            {links.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                className={`font-display text-3xl py-5 min-h-[56px] flex items-center border-b border-white/10 transition-colors duration-200 ${
                  isActive(link.href) ? 'text-[var(--accent-soft)]' : 'text-white hover:text-white/70'
                }`}
                style={{ transitionDelay: drawerOpen ? `${i * 40}ms` : '0ms' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-auto px-8 pb-10">
            <p className="font-body text-xs text-white/40 uppercase tracking-[0.18em]">
              {artistName}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
