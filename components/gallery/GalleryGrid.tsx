'use client'

import { useEffect, useState } from 'react'
import { Painting } from '@/lib/types'
import ArtworkCard from './ArtworkCard'
import Reveal from '@/components/ui/Reveal'

function columnCount(width: number) {
  if (width >= 1536) return 4
  if (width >= 1024) return 3
  if (width >= 640) return 2
  return 1
}

// Répartit les œuvres dans N colonnes EN GARDANT l'ordre admin,
// lu de gauche à droite ligne par ligne (rotation par colonne).
export default function GalleryGrid({
  paintings,
  category,
}: {
  paintings: Painting[]
  category?: string
}) {
  const [cols, setCols] = useState(0)

  useEffect(() => {
    const apply = () => setCols(columnCount(window.innerWidth))
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  const n = Math.max(cols, 1)
  const columns: Painting[][] = Array.from({ length: n }, () => [])
  paintings.forEach((p, i) => columns[i % n].push(p))

  return (
    <div
      className={`grid gap-7 md:gap-9 transition-opacity duration-300 ${cols ? 'opacity-100' : 'opacity-0'}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-col gap-7 md:gap-9">
          {col.map((p, ri) => (
            <Reveal key={p.id} delay={Math.min((ri * n + ci) * 55, 400)}>
              <ArtworkCard painting={p} category={category} />
            </Reveal>
          ))}
        </div>
      ))}
    </div>
  )
}
