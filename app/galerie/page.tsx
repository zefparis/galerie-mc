import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPaintings } from '@/lib/data'
import GalleryClient from '@/components/gallery/GalleryClient'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Galerie',
  description:
    'Toutes les œuvres originales de Marie-Claire Scandella : huile sur toile, acrylique, aquarelle. Disponibles, vendues et prix sur demande.',
  openGraph: {
    title: 'Galerie — Marie-Claire Scandella',
    description: 'Toutes les œuvres originales de Marie-Claire Scandella.',
  },
}

export default async function GaleriePage() {
  const paintings = await getPaintings()

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-8 md:pb-12">
        <Reveal>
          <p className="eyebrow">Œuvres originales</p>
          <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
            Galerie
          </h1>
          <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-lg">
            Chaque toile est une pièce unique.
          </p>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-20 md:pb-32">
        <Suspense>
          <GalleryClient paintings={paintings} />
        </Suspense>
      </section>
    </div>
  )
}
