'use client'

import { useEffect, useState } from 'react'
import { getSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'

export default function Footer() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  if (!settings) return null

  return (
    <footer className="footer w-full border-t border-[var(--border)] bg-[var(--cream)] py-8 px-5 md:px-6 pb-8">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <p className="font-body text-xs text-warm-gray text-center">
          &copy; {new Date().getFullYear()} {settings.artistName}
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="font-body text-xs text-warm-gray hover:text-charcoal transition-colors">
              {settings.email}
            </a>
          )}
          {settings.instagram && (
            <a
              href={`https://instagram.com/${settings.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-xs text-warm-gray hover:text-charcoal transition-colors"
            >
              Instagram
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}
