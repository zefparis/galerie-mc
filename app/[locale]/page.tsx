import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getPaintings, getPublishedEvents, getGallerySettings } from '@/lib/data'
import { localizeEvent, localizePainting, localizeSettings } from '@/lib/i18n'
import { alternatesFor, OG_LOCALE } from '@/lib/seo'
import { routing, type Locale } from '@/i18n/routing'
import MasonryGrid from '@/components/gallery/MasonryGrid'
import EventCard from '@/components/gallery/EventCard'
import ArtistPhotos from '@/components/gallery/ArtistPhotos'
import HeroArtwork from '@/components/gallery/HeroArtwork'
import Reveal from '@/components/ui/Reveal'

export const dynamic = 'force-dynamic'

interface Props {
  params: { locale: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = params.locale as Locale
  const t = await getTranslations({ locale, namespace: 'home' })
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDesc'),
    alternates: alternatesFor('', locale),
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDesc'),
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
  }
}

export default async function Home({ params }: Props) {
  const locale = params.locale as Locale
  const t = await getTranslations('home')
  const th = await getTranslations('hero')
  const td = await getTranslations('defaults')
  const [paintings, rawEvents, rawSettings] = await Promise.all([
    getPaintings(),
    getPublishedEvents(),
    getGallerySettings(),
  ])
  const events = rawEvents.map((e) => localizeEvent(e, locale))
  const settings = localizeSettings(rawSettings, locale, {
    bio: td('bio'),
    bioShort: td('bioShort'),
  })
  const localized = paintings.map((p) => localizePainting(p, locale))

  const featuredList = localized.filter((p) => p.featured)
  if (featuredList.length === 0 && localized.length > 0) featuredList.push(localized[0])
  const selection = localized.slice(0, 6)

  // Ligne d'accroche au-dessus du titre : séparateur « · ».
  const eyebrowText = (settings.bioShort || th('defaultEyebrow')).replace(/\s*\|\s*/g, ' · ')

  // Accroche courte sous le titre : bioShort si elle apporte autre chose
  // que la ligne d'accroche (sinon ce serait une redite), sinon la
  // première phrase de la bio qui ne répète pas le nom de l'artiste,
  // sinon le texte par défaut localisé. Tout vide → rien.
  const normTxt = (s: string) =>
    s.toLowerCase().replace(/[|·]/g, ' ').replace(/\s+/g, ' ').trim()
  const TAILLE_STOP = new Set(
    'qui que quand où et ou de du des la le les un une en au aux à a sur dans par pour avec sans the and or of a an in on with for der die das den dem und oder mit el los las una un por'.split(' ')
  )
  const cap140 = (s: string) => {
    if (s.length <= 140) return s
    let t = s.slice(0, 140).replace(/\s+\S*$/, '')
    // Pas de mot-outil pendu avant les points de suspension.
    while (TAILLE_STOP.has(t.split(' ').pop()!.toLowerCase().replace(/[.,;:]/g, ''))) {
      t = t.replace(/\s+\S*$/, '')
    }
    return `${t}…`
  }
  let accroche = ''
  if (settings.bioShort && normTxt(settings.bioShort) !== normTxt(eyebrowText)) {
    accroche = settings.bioShort
  }
  if (!accroche && settings.bio) {
    accroche =
      settings.bio
        .split(/(?<=[.!?])\s/)
        .find((s) => !normTxt(s).includes(normTxt(settings.artistName))) || ''
  }
  if (!accroche) accroche = th('defaultTagline')
  accroche = accroche ? cap140(accroche) : ''

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.eventDate && e.eventDate >= today)
    .sort((a, b) => (a.eventDate! < b.eventDate! ? -1 : 1))
  const homeEvents = upcoming.length > 0 ? upcoming.slice(0, 3) : events.slice(0, 2)

  return (
    <div>
      {/* ─── Hero : texte + toile encadrée ────────────────────────────── */}
      <section className="pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto gutter-x py-14 sm:py-16 md:py-24 lg:py-32 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">
          {/* Texte */}
          <div className="hero-fade">
            <p className="eyebrow">{eyebrowText}</p>
            <h1 className="font-display title-page mt-4 md:mt-5 leading-[0.98] text-balance text-[var(--ink)]">
              {settings.artistName}
            </h1>
            {accroche && (
              <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 max-w-md">
                {accroche}
              </p>
            )}
            <div className="mt-8 md:mt-10 flex flex-wrap gap-4">
              <Link href="/galerie" className="btn-primary min-h-[44px]">
                {th('ctaGallery')}
              </Link>
              <Link href="/contact" className="btn-outline min-h-[44px]">
                {th('ctaContact')}
              </Link>
            </div>
          </div>

          {/* Œuvre mise en avant, « accrochée au mur » */}
          {featuredList.length > 0 && (
            <div className="hero-fade" style={{ animationDelay: '0.25s' }}>
              <HeroArtwork paintings={featuredList} artistName={settings.artistName} />
            </div>
          )}
        </div>
      </section>

      {/* ─── Sélection d'œuvres ───────────────────────────────────────── */}
      {selection.length > 0 && (
        <section className="max-w-7xl mx-auto gutter-x py-16 md:py-28">
          <Reveal>
            <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
              <div>
                <p className="eyebrow">{t('worksEyebrow')}</p>
                <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                  {t('selection')}
                </h2>
              </div>
              <div className="hidden sm:flex items-end gap-6">
                <Link
                  href="/galerie?categorie=peintures"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  {t('peinturesShort')}
                </Link>
                <Link
                  href="/galerie?categorie=collages"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  {t('collagesShort')}
                </Link>
                <Link
                  href="/galerie"
                  className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  {t('allGallery')}
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
              {t('peinturesLink')}
            </Link>
            <Link
              href="/galerie?categorie=collages"
              className="font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)]"
            >
              {t('collagesLink')}
            </Link>
            <Link
              href="/galerie"
              className="inline-flex font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]"
            >
              {t('allGallery')}
            </Link>
          </Reveal>
        </section>
      )}

      {/* ─── Prochaines expositions ───────────────────────────────────── */}
      {homeEvents.length > 0 && (
        <section className="border-t border-[var(--line)]">
          <div className="max-w-7xl mx-auto gutter-x py-16 md:py-28">
            <Reveal>
              <div className="flex items-end justify-between gap-6 mb-10 md:mb-14">
                <div>
                  <p className="eyebrow">{t('agenda')}</p>
                  <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                    {upcoming.length > 0 ? t('upcoming') : t('recent')}
                  </h2>
                </div>
                <Link
                  href="/expositions"
                  className="hidden sm:inline-flex font-body text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors duration-200 pb-1"
                >
                  {t('seeAll')}
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
        <div className="max-w-5xl mx-auto gutter-x py-16 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-start">
            {/* Photos de l'artiste */}
            {(settings.photos?.length ?? 0) > 0 && (
              <Reveal>
                <ArtistPhotos photos={settings.photos!} artistName={settings.artistName} />
              </Reveal>
            )}

            {/* Texte */}
            <Reveal delay={120}>
              <p className="eyebrow">{t('presentation')}</p>
              <h2 className="font-display text-4xl md:text-5xl text-[var(--ink)] mt-2">
                {settings.artistName}
              </h2>
              <p className="font-body text-base md:text-lg text-[var(--ink-soft)] leading-relaxed mt-6 md:mt-8 whitespace-pre-line">
                {settings.bio}
              </p>
              <Link href="/contact" className="btn-outline mt-8 md:mt-10">
                {t('contactMe')}
              </Link>
            </Reveal>
          </div>

          {/* Ma démarche picturale */}
          {settings.processText && (
            <Reveal className="mt-14 md:mt-20">
              <div className="border-t border-[var(--line)] pt-10 md:pt-14 max-w-3xl mx-auto text-center">
                <p className="eyebrow mb-6">{t('process')}</p>
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
