import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getPaintings } from '@/lib/data'
import { CATEGORY_LABEL, isCategory } from '@/lib/catalog'
import GalleryClient from '@/components/gallery/GalleryClient'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: { categorie?: string }
}

const INTRO: Record<string, string> = {
  peintures: 'Toiles originales — chaque œuvre est une pièce unique.',
  collages: 'Collages et techniques mixtes sur papier — chaque œuvre est une pièce unique.',
  toutes: 'Chaque toile est une pièce unique.',
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cat = isCategory(searchParams.categorie) ? searchParams.categorie : null
  const label = cat ? CATEGORY_LABEL[cat] : 'Galerie'
  const description =
    cat === 'collages'
      ? 'Collages sur papier de Marie-Claire Scandella — œuvres originales.'
      : cat === 'peintures'
        ? 'Peintures contemporaines de Marie-Claire Scandella — œuvres originales.'
        : 'Toutes les œuvres originales de Marie-Claire Scandella : peintures contemporaines et collages sur papier.'
  return {
    title: label,
    description,
    openGraph: { title: `${label} — Marie-Claire Scandella`, description },
  }
}

export default async function GaleriePage({ searchParams }: Props) {
  const paintings = await getPaintings()
  const cat = isCategory(searchParams.categorie) ? searchParams.categorie : null
  const title = cat ? CATEGORY_LABEL[cat] : 'Galerie'

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-8 md:pb-12">
        <Reveal>
          <p className="eyebrow">Œuvres originales</p>
          <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
            {title}
          </h1>
          <p className="font-body text-sm md:text-base text-[var(--ink-soft)] mt-4 max-w-lg">
            {INTRO[cat || 'toutes']}
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
