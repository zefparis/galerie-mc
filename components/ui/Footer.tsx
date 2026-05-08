'use client'

import { useEffect, useState } from 'react'
import { getSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'

export default function Footer() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--cream)] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10 text-center">
        <div className="flex flex-col items-center gap-4">
          {settings?.email && (
            <a
              href={`mailto:${settings.email}`}
              className="font-body text-sm text-warm-gray hover:text-gold transition-colors duration-300"
            >
              {settings.email}
            </a>
          )}
          {settings?.instagram && (
            <a
              href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-sm text-warm-gray hover:text-gold transition-colors duration-300"
            >
              Instagram
            </a>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <p className="font-body text-xs text-warm-gray tracking-wide">
            © {new Date().getFullYear()} {settings?.artistName || 'Marie-Claire Scandella'} — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  )
}
