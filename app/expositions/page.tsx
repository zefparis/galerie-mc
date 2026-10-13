import type { Metadata } from 'next'
import { getPublishedEvents } from '@/lib/data'
import EventCard from '@/components/gallery/EventCard'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Expositions & Événements',
  description:
    'Expositions et événements de Marie-Claire Scandella, artiste peintre à Montreuil-aux-Lions.',
  openGraph: {
    title: 'Expositions & Événements — Marie-Claire Scandella',
    description: 'Expositions et événements de Marie-Claire Scandella.',
  },
}

export default async function ExpositionsPage() {
  const events = await getPublishedEvents()

  return (
    <div className="pt-16 md:pt-20">
      <header className="max-w-7xl mx-auto px-5 md:px-8 pt-10 md:pt-20 pb-10 md:pb-16">
        <Reveal>
          <p className="eyebrow">Moments partagés</p>
          <h1 className="font-display text-5xl md:text-7xl text-[var(--ink)] mt-3">
            Expositions &amp; Événements
          </h1>
        </Reveal>
      </header>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-20 md:pb-32">
        {events.length === 0 ? (
          <p className="font-body text-[var(--muted)] py-16 text-center">
            Aucune exposition pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
            {events.map((evt, i) => (
              <Reveal key={evt.id} delay={(i % 2) * 80}>
                <EventCard event={evt} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
