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
    async function load() {
      const [p] = await Promise.all([getPaintings()])
      setPaintings(p)
      setSettings(getSettings())
      setLoaded(true)
    }
    load()
  }, [])

  const featuredPainting = paintings.find((p) => p.featured)

  if (!loaded) {
    return <div className="min-h-screen" />
  }

  return (
    <div className="min-h-screen">
      {/* Header — mobile: centered name + subtitle */}
      <div className="pt-10 pb-6 px-5 md:hidden text-center">
        <h2 className="font-display text-[32px] text-charcoal leading-tight">
          {settings?.artistName || 'Marie-Claire Scandella'}
        </h2>
        <p className="font-body text-sm text-warm-gray mt-2">
          {settings?.bioShort || 'Peintre | Alès, France'}
        </p>
      </div>

      {/* Hero with featured painting */}
      {featuredPainting && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative w-full aspect-[4/3] md:aspect-[16/7] md:max-h-[500px] overflow-hidden"
        >
          <img
            src={featuredPainting.imageUrl}
            alt={featuredPainting.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 md:bottom-12 md:left-12">
            <h2 className="font-display text-xl sm:text-2xl md:text-4xl text-white mb-1">
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
        <section className="max-w-3xl mx-auto px-5 md:px-6 py-10 md:py-16 text-center">
          <p className="font-body text-sm md:text-base text-warm-gray leading-relaxed">
            {settings.bioShort || settings.bio.substring(0, 200)}
          </p>
        </section>
      )}

      {/* Gallery grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 pb-16 md:pb-20">
        <MasonryGrid paintings={paintings} />
      </section>
    </div>
  )
}
