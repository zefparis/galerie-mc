'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getPaintings, getPaintingById } from '@/lib/storage'
import { Painting } from '@/lib/types'
import PaintingDetail from '@/components/gallery/PaintingDetail'

export default function OeuvrePage() {
  const params = useParams()
  const router = useRouter()
  const [painting, setPainting] = useState<Painting | null>(null)
  const [prevId, setPrevId] = useState<string | undefined>()
  const [nextId, setNextId] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const id = params.id as string
    const found = getPaintingById(id)
    
    if (!found) {
      router.replace('/')
      return
    }

    setPainting(found)

    const all = getPaintings()
    const currentIndex = all.findIndex((p) => p.id === id)
    if (currentIndex > 0) setPrevId(all[currentIndex - 1].id)
    if (currentIndex < all.length - 1) setNextId(all[currentIndex + 1].id)
    
    setLoaded(true)
  }, [params.id, router])

  if (!loaded || !painting) {
    return <div className="min-h-screen" />
  }

  return <PaintingDetail painting={painting} prevId={prevId} nextId={nextId} />
}
