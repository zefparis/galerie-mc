'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navbar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const touchStartX = useRef(0)

  const links = [
    { href: '/', label: 'Galerie' },
    { href: '/contact', label: 'Contact' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (diff > 80) setDrawerOpen(false)
  }

  return (
    <>
      <nav className="navbar w-full border-b border-[var(--border)] bg-[var(--cream)]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 md:px-6 py-4 md:py-6 flex items-center justify-between relative">
          <Link href="/" className="text-center flex-1 min-w-0">
            <h1 className="font-display text-2xl xs:text-3xl md:text-4xl tracking-wide text-charcoal truncate">
              Marie-Claire Scandella
            </h1>
            <p className="font-body text-xs sm:text-sm text-warm-gray italic mt-0.5">
              Peintre | Alès, France
            </p>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body text-xs uppercase tracking-[0.15em] transition-colors duration-300 ${
                  isActive(link.href)
                    ? 'text-gold'
                    : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -mr-2"
            aria-label="Ouvrir le menu"
          >
            <div className="w-6 flex flex-col gap-1.5">
              <span className="block h-[2px] bg-charcoal" />
              <span className="block h-[2px] bg-charcoal" />
              <span className="block h-[2px] bg-charcoal" />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 z-50 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-[280px] bg-[var(--charcoal)] z-50 md:hidden flex flex-col"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex justify-end p-5">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-white p-2"
                  aria-label="Fermer le menu"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2 px-6 mt-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`font-body text-lg uppercase tracking-[0.1em] py-4 min-h-[52px] flex items-center border-b border-white/10 ${
                      isActive(link.href)
                        ? 'text-[var(--gold-light)]'
                        : 'text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
