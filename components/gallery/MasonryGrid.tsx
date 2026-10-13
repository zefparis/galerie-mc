import { Painting } from '@/lib/types'
import PaintingCard from './PaintingCard'
import Reveal from '@/components/ui/Reveal'

// Colonnes CSS : chaque toile garde son ratio naturel, aucun recadrage.
export default function MasonryGrid({ paintings }: { paintings: Painting[] }) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 md:gap-8">
      {paintings.map((painting, i) => (
        <Reveal key={painting.id} delay={Math.min(i * 60, 300)}>
          <PaintingCard painting={painting} />
        </Reveal>
      ))}
    </div>
  )
}
