'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Painting } from '@/lib/types'
import { blurDataUrl } from '@/lib/images'
import { useTechniqueLabel } from '@/lib/i18n'

const STATUS_KEYS: Record<Painting['priceStatus'], string | null> = {
  visible: null,
  sur_demande: 'sur_demande',
  vendu: 'vendu',
  non_a_vendre: 'non_a_vendre',
}

export default function PaintingCard({ painting }: { painting: Painting }) {
  const t = useTranslations('status')
  const techLabel = useTechniqueLabel()
  const statusKey = STATUS_KEYS[painting.priceStatus]
  const status = statusKey ? t(statusKey) : null

  return (
    <Link
      href={`/oeuvre/${painting.id}`}
      className="group block break-inside-avoid mb-6 md:mb-8"
    >
      {/* Ratio naturel respecté — jamais de recadrage */}
      <div className="relative overflow-hidden bg-[var(--line)]">
        <Image
          src={painting.imageUrl}
          alt={`${painting.title} — ${painting.technique ? techLabel(painting.technique) : ''}, ${painting.year}`}
          width={0}
          height={0}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          placeholder="blur"
          blurDataURL={blurDataUrl(painting.imageUrl)}
          className="w-full h-auto transition-transform duration-500 ease-gallery group-hover:scale-[1.02]"
        />
        {/* Overlay au survol (desktop) */}
        <div className="absolute inset-0 hidden md:flex flex-col justify-end p-5 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 transition-transform duration-300 group-hover:opacity-100">
          <div className="translate-y-2 transition-transform duration-300 group-hover:translate-y-0">
            <h3 className="font-display text-xl text-white leading-tight">
              {painting.title}
            </h3>
            <p className="font-body text-[11px] text-white/75 uppercase tracking-[0.14em] mt-1">
              {painting.year} · {painting.technique ? techLabel(painting.technique) : ''}
              {status ? ` · ${status}` : ''}
            </p>
          </div>
        </div>
        {painting.priceStatus === 'vendu' && (
          <span className="absolute top-3 right-3 font-body text-[10px] font-medium uppercase tracking-[0.14em] px-2.5 py-1 bg-[var(--night)] text-[var(--night-ink)]">
            {t('vendu')}
          </span>
        )}
      </div>

      {/* Légende visible sur mobile/tactile (pas de hover) */}
      <div className="md:hidden pt-3">
        <h3 className="font-display text-lg text-[var(--ink)] leading-tight">
          {painting.title}
        </h3>
        <p className="font-body text-[11px] text-[var(--muted)] mt-0.5 uppercase tracking-[0.12em]">
          {painting.year} · {painting.technique ? techLabel(painting.technique) : ''}
          {status ? ` · ${status}` : ''}
        </p>
      </div>
    </Link>
  )
}
