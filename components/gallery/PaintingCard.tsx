'use client'

import { Painting } from '@/lib/types'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface Props {
  painting: Painting
  index: number
}

export default function PaintingCard({ painting, index }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link href={`/oeuvre/${painting.id}`} className="group block overflow-hidden">
        {/* Image */}
        <div className="relative aspect-[4/3] lg:aspect-[4/5] overflow-hidden bg-[var(--border)]">
          <img
            src={painting.imageUrl}
            alt={painting.title}
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="w-full h-full object-cover transition-transform duration-700 ease-gallery group-hover:scale-[1.03]"
          />
          {/* Overlay hover — only on devices with hover (mouse) */}
          <div className="absolute inset-0 bg-[var(--overlay)] opacity-0 transition-opacity duration-500 hidden lg:flex items-end p-6 group-hover:opacity-100">
            <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
              <h3 className="font-display text-xl text-white mb-1">
                {painting.title}
              </h3>
              <p className="font-body text-xs text-white/70 uppercase tracking-[0.12em]">
                {painting.year} · {painting.technique}
              </p>
            </div>
          </div>
        </div>
        {/* Info below image — visible on mobile/tablet, hidden on desktop */}
        <div className="lg:hidden pt-3 pb-4">
          <h3 className="font-display text-lg text-charcoal leading-tight">
            {painting.title}
          </h3>
          <p className="font-body text-xs text-warm-gray mt-1 uppercase tracking-[0.08em]">
            {painting.year} · {painting.technique}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}
