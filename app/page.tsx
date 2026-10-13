import Link from 'next/link'
import { getPaintings, getPublishedEvents, getGallerySettings } from '@/lib/data'
import MasonryGrid from '@/components/gallery/MasonryGrid'
import EventCard from '@/components/gallery/EventCard'
import ArtistPhotos from '@/components/gallery/ArtistPhotos'
import HeroArtwork from '@/components/gallery/HeroArtwork'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [paintings, events, settings] = await Promise.all([
    getPaintings(),
    getPublishedEvents(),
    getGallerySettings(),
  ])

  const featuredList = paintings.filter((p) => p.featured)
  if (featuredList.length === 0 && paintings.length > 0) featuredList.push(paintings[0])
  const selection = paintings.slice(0, 6)

  // Première phrase de la présentation comme accroche du hero.
  const accroche = (settings.bio || '').split(/(?<=[.!?])\s/)[0] || ''

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.eventDate && e.eventDate >= today)
    .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1))
  const homeEvents = upcoming.length > 0 ? upcoming.slice(0, 3) : events.slice(0, 2)

  return (
    <div>
      {/* ─── Hero : texte + toile encadrée ────────────────────────────── */}
      <section className="pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 sm:py-16 md:py-24 lg:py-32 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">
          {/* Texte */}
          <div className="hero-fade">
            <p className="eyebrow">
              {settings.bioShort || 'Artiste peintre'}
            </p>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl mt-4 md:mt-5 leading-[0.98] text-balance text-[var(--ink)]">
              {settings.artistName}
            </h1>
            {accroche && (
              <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 max-w-md">
                {accroche}
              </p>
            )}
            <div className="mt-8 md:mt-10 flex flex-wrap gap-4">
              <Link href="/galerie" className="btn-primary">
                Découvrir la galerie
              </Link>
              <Link href="/contact" className="btn-outline">
                Contacter l&apos;artiste
              </Link>
            </div>
          </div>

          {/* Œuvre mise en avant, présentée encadrée */}
          {featuredList.length > 0 && (
            <div className="hero-fade" style={{ animationDelay: '0.25s' }}>
              <HeroArtwork paintings={featuredList} />
            </div>
          )}
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
              <div className="hidden sm:flex items-end gap-6">
                <Link
                  href="/galerie?categorie=peintures"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  Peintures →
                </Link>
                <Link
                  href="/galerie?categorie=collages"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  Collages →
                </Link>
                <Link
                  href="/galerie"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  Toute la galerie →
                </Link>
              </div>
            </div>
          </Reveal>
          <MasonryGrid paintings={selection} />
          <Reveal className="sm:hidden mt-6 flex flex-col items-center gap-4">
            <Link
              href="/galerie?categorie=peintures"
              className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)]"
            >
              Peintures contemporaines →
            </Link>
            <Link
              href="/galerie?categorie=collages"
              className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)]"
            >
              Collages sur papier →
            </Link>
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
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-16 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-start">
            {/* Photos de l'artiste */}
            {(settings.photos?.length ?? 0) > 0 && (
              <Reveal>
                <ArtistPhotos photos={settings.photos!} artistName={settings.artistName} />
              </Reveal>
            )}

            {/* Texte */}
            <Reveal delay={120}>
              <p className="eyebrow">Présentation</p>
              <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                {settings.artistName}
              </h2>
              <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 md:mt-8 whitespace-pre-line">
                {settings.bio}
              </p>
              <Link href="/contact" className="btn-outline mt-8 md:mt-10">
                Me contacter
              </Link>
            </Reveal>
          </div>

          {/* Ma démarche picturale */}
          {settings.processText && (
            <Reveal className="mt-14 md:mt-20">
              <div className="border-t border-[var(--line)] pt-10 md:pt-14 max-w-3xl mx-auto text-center">
                <p className="eyebrow mb-6">Ma démarche picturale</p>
                <p className="font-display text-2xl md:text-3xl text-[var(--ink-soft)] leading-relaxed italic whitespace-pre-line">
                  {settings.processText}
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  )
}
