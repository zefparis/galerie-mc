import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPaintingById, getPaintings } from '@/lib/data'
import PaintingDetail from '@/components/gallery/PaintingDetail'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const painting = await getPaintingById(params.id)
  if (!painting) return { title: 'Œuvre introuvable' }

  const description = [
    `${painting.technique}, ${painting.year}`,
    painting.dimensions,
    painting.description?.slice(0, 140),
  ]
    .filter(Boolean)
    .join(' — ')

  return {
    title: painting.title,
    description,
    openGraph: {
      title: `${painting.title} — Marie-Claire Scandella`,
      description,
      images: [painting.imageUrl],
      type: 'article',
    },
  }
}

export default async function OeuvrePage({ params }: Props) {
  const [painting, all] = await Promise.all([
    getPaintingById(params.id),
    getPaintings(),
  ])
  if (!painting) notFound()

  const index = all.findIndex((p) => p.id === painting.id)
  const prevId = index > 0 ? all[index - 1].id : undefined
  const nextId = index >= 0 && index < all.length - 1 ? all[index + 1].id : undefined

  return <PaintingDetail painting={painting} prevId={prevId} nextId={nextId} />
}
