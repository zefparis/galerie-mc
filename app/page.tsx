'use client'

import { useEffect, useState } from 'react'
import { getPaintings, getSettings } from '@/lib/storage'
import { Painting, GallerySettings } from '@/lib/types'
import MasonryGrid from '@/components/gallery/MasonryGrid'
import { motion } from 'framer-motion'

export default function Home() {
  const [paintings, setPaintings] = useState<Painting[]>([])
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPaintings(getPaintings())
    setSettings(getSettings())
    setLoaded(true)
  }, [])

  const featuredPainting = paintings.find((p) => p.featured)

  if (!loaded) {
    return <div className="min-h-screen" />
  }

  return (
    <div className="min-h-screen">
      {/* Hero with featured painting */}
      {featuredPainting && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative w-full aspect-[16/7] max-h-[500px] overflow-hidden"
        >
          <img
            src={featuredPainting.imageUrl}
            alt={featuredPainting.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12">
            <h2 className="font-display text-2xl md:text-4xl text-white mb-2">
              {featuredPainting.title}
            </h2>
            <p className="font-body text-xs text-white/70 uppercase tracking-[0.12em]">
              {featuredPainting.technique} · {featuredPainting.year}
            </p>
          </div>
        </motion.section>
      )}

      {/* Bio short */}
      {settings?.bio && (
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="font-body text-base text-warm-gray leading-relaxed">
            {settings.bioShort || settings.bio.substring(0, 200)}
          </p>
        </section>
      )}

      {/* Gallery grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <MasonryGrid paintings={paintings} />
      </section>
    </div>
  )
}
