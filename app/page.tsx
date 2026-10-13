import Image from 'next/image'
import Link from 'next/link'
import { getPaintings, getPublishedEvents } from '@/lib/data'
import { getSettings } from '@/lib/storage'
import { blurDataUrl } from '@/lib/images'
import MasonryGrid from '@/components/gallery/MasonryGrid'
import EventCard from '@/components/gallery/EventCard'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [paintings, events] = await Promise.all([getPaintings(), getPublishedEvents()])
  const settings = getSettings()

  const featured = paintings.find((p) => p.featured) || paintings[0]
  const selection = paintings.slice(0, 6)

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.eventDate && e.eventDate >= today)
    .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1))
  const homeEvents = upcoming.length > 0 ? upcoming.slice(0, 3) : events.slice(0, 2)

  return (
    <div>
      {/* ─── Hero plein écran ─────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex items-end">
        {featured && (
          <Image
            src={featured.imageUrl}
            alt={featured.title}
            fill
            priority
            sizes="100vw"
            placeholder="blur"
            blurDataURL={blurDataUrl(featured.imageUrl)}
            className="object-cover"
          />
        )}
        <div className={`absolute inset-0 ${featured ? 'bg-gradient-to-t from-black/70 via-black/20 to-black/30' : 'bg-[var(--ink)]'}`} />

        <div className="relative w-full max-w-7xl mx-auto px-5 md:px-8 pb-16 md:pb-24">
          <Reveal delay={200}>
            <p className="eyebrow !text-white/70">
              {settings.bioShort || 'Artiste peintre'}
            </p>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl mt-4 leading-[0.95] text-balance text-white">
              {settings.artistName}
            </h1>
            {featured && (
              <p className="font-body text-sm md:text-base text-white/75 mt-5 max-w-md">
                « {featured.title} » — {featured.technique}, {featured.year}
              </p>
            )}
            <div className="mt-8 md:mt-10 flex flex-wrap gap-4">
              <Link
                href="/galerie"
                className="inline-flex items-center justify-center px-8 py-4 font-body text-sm font-medium tracking-wide transition-colors duration-300 min-h-[52px] bg-white text-[var(--ink)] hover:bg-white/85"
              >
                Découvrir la galerie
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 font-body text-sm font-medium tracking-wide border border-white/50 text-white transition-colors duration-300 min-h-[52px] hover:bg-white/10"
              >
                Contacter l&apos;artiste
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Indicateur scroll */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:block text-white/60">
          <svg width="20" height="28" viewBox="0 0 20 28" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="1" y="1" width="18" height="26" rx="9" />
            <line x1="10" y1="8" x2="10" y2="13" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      {/* ─── Sélection d'œuvres ───────────────────────────────────────── */}
      {selection.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-28">
          <Reveal>
            <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
              <div>
                <p className="eyebrow">Œuvres</p>
                <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                  Sélection
                </h2>
              </div>
              <Link
                href="/galerie"
                className="hidden sm:inline-flex font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
              >
                Toute la galerie →
              </Link>
            </div>
          </Reveal>
          <MasonryGrid paintings={selection} />
          <Reveal className="sm:hidden mt-6 text-center">
            <Link
              href="/galerie"
              className="inline-flex font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]"
            >
              Toute la galerie →
            </Link>
          </Reveal>
        </section>
      )}

      {/* ─── Prochaines expositions ───────────────────────────────────── */}
      {homeEvents.length > 0 && (
        <section className="border-t border-[var(--line)]">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-28">
            <Reveal>
              <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
                <div>
                  <p className="eyebrow">Agenda</p>
                  <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                    {upcoming.length > 0 ? 'Prochaines expositions' : 'Expositions récentes'}
                  </h2>
                </div>
                <Link
                  href="/expositions"
                  className="hidden sm:inline-flex font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  Tout voir →
                </Link>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
              {homeEvents.map((evt, i) => (
                <Reveal key={evt.id} delay={i * 80}>
                  <EventCard event={evt} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Présentation ─────────────────────────────────────────────── */}
      <section className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-28 text-center">
          <Reveal>
            <p className="eyebrow">L&apos;artiste</p>
            <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
              {settings.artistName}
            </h2>
            <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 md:mt-8">
              {settings.bio}
            </p>
            <Link href="/contact" className="btn-outline mt-8 md:mt-10">
              Me contacter
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
