'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'

export default function Footer() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  if (!settings) return null

  return (
    <footer className="footer w-full border-t border-[var(--line)] bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
          {/* Identité */}
          <div className="max-w-xs">
            <p className="font-display text-2xl text-[var(--ink)]">
              {settings.artistName}
            </p>
            <p className="font-body text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">
              {settings.bioShort}
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label="Pied de page">
            <p className="eyebrow mb-4">Navigation</p>
            <div className="flex flex-col gap-2">
              <Link href="/galerie" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Galerie
              </Link>
              <Link href="/expositions" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Expositions
              </Link>
              <Link href="/contact" className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Contact
              </Link>
            </div>
          </nav>

          {/* Contact */}
          <div>
            <p className="eyebrow mb-4">Contact</p>
            <div className="flex flex-col gap-2">
              {settings.email && (
                <a
                  href={`mailto:${settings.email}`}
                  className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors"
                >
                  {settings.email}
                </a>
              )}
              {settings.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="font-body text-xs text-[var(--muted)]">
            &copy; {new Date().getFullYear()} {settings.artistName} — Tous droits réservés
          </p>
          <p className="font-body text-xs text-[var(--muted)]">
            Œuvres originales — reproduction interdite sans autorisation
          </p>
        </div>
      </div>
    </footer>
  )
}
