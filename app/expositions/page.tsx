'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GalleryEvent } from '@/lib/types'
import { motion } from 'framer-motion'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

export default function ExpositionsPage() {
  const [events, setEvents] = useState<GalleryEvent[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/events')
      if (res.ok) setEvents(await res.json())
      setLoaded(true)
    }
    load()
  }, [])

  if (!loaded) return <div className="min-h-screen" />

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="text-center py-12 md:py-20 px-5">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-3xl md:text-5xl text-charcoal"
        >
          Expositions &amp; Événements
        </motion.h1>
        <p className="font-body text-sm md:text-base text-warm-gray italic mt-3">
          Moments partagés
        </p>
      </section>

      {/* Event cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 md:pb-20">
        {events.length === 0 && (
          <p className="text-center font-body text-warm-gray py-12">
            Aucune exposition pour le moment.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {events.map((evt, i) => (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Link href={`/expositions/${evt.id}`} className="group block">
                <div className="aspect-[16/9] bg-[var(--border)] rounded overflow-hidden">
                  {evt.coverUrl ? (
                    <img
                      src={evt.coverUrl}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-warm-gray font-body text-sm">
                      Pas de couverture
                    </div>
                  )}
                </div>
                <div className="mt-3 sm:mt-4">
                  <h2 className="font-display text-lg md:text-xl text-charcoal group-hover:text-[var(--accent)] transition-colors">
                    {evt.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {evt.eventDate && (
                      <span className="font-body text-xs uppercase tracking-wider text-warm-gray">
                        {formatDate(evt.eventDate)}
                      </span>
                    )}
                    {evt.location && (
                      <span className="font-body text-xs text-warm-gray">
                        📍 {evt.location}
                      </span>
                    )}
                  </div>
                  {evt.description && (
                    <p className="font-body text-sm text-warm-gray mt-2 line-clamp-2">
                      {evt.description}
                    </p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
