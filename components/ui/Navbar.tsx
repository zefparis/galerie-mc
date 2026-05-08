'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: '/', label: 'Galerie' },
    { href: '/contact', label: 'Contact' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="w-full border-b border-[var(--border)] bg-[var(--cream)]">
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="text-center flex-1">
          <h1 className="font-display text-3xl md:text-4xl tracking-wide text-charcoal">
            Marie-Claire Scandella
          </h1>
          <p className="font-body text-sm text-warm-gray italic mt-1">
            Peintre | Alès, France
          </p>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 absolute right-6">
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
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden absolute right-6 p-2"
          aria-label="Menu"
        >
          <div className="w-6 flex flex-col gap-1.5">
            <span className={`block h-px bg-charcoal transition-transform duration-300 ${menuOpen ? 'rotate-45 translate-y-[3.5px]' : ''}`} />
            <span className={`block h-px bg-charcoal transition-opacity duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-px bg-charcoal transition-transform duration-300 ${menuOpen ? '-rotate-45 -translate-y-[3.5px]' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border)] px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`font-body text-sm uppercase tracking-[0.15em] ${
                isActive(link.href)
                  ? 'text-gold'
                  : 'text-warm-gray'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
