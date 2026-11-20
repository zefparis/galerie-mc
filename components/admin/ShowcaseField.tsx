'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Painting, PaintingShowcase, ShowcaseGap, ShowcasePhoto } from '@/lib/types'
import type { FrameId } from '@/lib/frames'
import { FramePreview } from '@/components/frames/FramedArt'
import ShowcaseArtwork from '@/components/gallery/ShowcaseArtwork'
import PhotoPickerModal from './PhotoPickerModal'

export type ShowcaseLayoutChoice = 'main' | 'single' | 'row' | 'column'

export interface ShowcaseFormValue {
  layout: ShowcaseLayoutChoice
  /** Photos de la composition ('row'/'column' : toutes, dans l'ordre)
   *  ou candidates au choix unique ('single'). Max 3. */
  photos: ShowcasePhoto[]
  /** Index dans `photos` de la photo affichée quand layout = 'single'. */
  singleIndex: number
  gap: ShowcaseGap
  first: boolean
}

interface Props {
  /** Titre de l'œuvre (aperçu). */
  title: string
  /** Photo principale actuelle du formulaire — toujours proposée en
   *  premier, marquée « Principale ». */
  mainPhoto: ShowcasePhoto | null
  /** Cadre appliqué dans la vitrine (resolveFrame côté formulaire). */
  frame: FrameId
  value: ShowcaseFormValue
  onChange: (patch: Partial<ShowcaseFormValue>) => void
}

const MAX_PHOTOS = 3
const samePhoto = (a: ShowcasePhoto, b: ShowcasePhoto) =>
  (!!a.publicId && a.publicId === b.publicId) || (!!a.url && a.url === b.url)

// Section « Dans la vitrine de l'accueil » de la fiche œuvre : choix de
// la présentation (photo principale, une seule photo, côte à côte,
// l'une au-dessus de l'autre), espacement, première place, aperçu en
// direct de la composition avec le cadre réel.
export default function ShowcaseField({ title, mainPhoto, frame, value, onChange }: Props) {
  const t = useTranslations('showcase')
  const [pickerOpen, setPickerOpen] = useState(false)
  const { layout, photos, singleIndex, gap, first } = value

  const isMain = (p: ShowcasePhoto) => !!mainPhoto?.url && samePhoto(p, mainPhoto)
  const mainInList = photos.some(isMain)
  const canCompose = photos.length >= 2

  // La photo principale suit le formulaire : première image → elle
  // rejoint la liste ; remplacée → l'entrée marquée « Principale »
  // suit la nouvelle image.
  const prevMain = useRef(mainPhoto)
  useEffect(() => {
    const prev = prevMain.current
    prevMain.current = mainPhoto
    if (!mainPhoto?.url) return
    if (!prev?.url && photos.length === 0) {
      onChange({ photos: [mainPhoto] })
    } else if (
      prev?.url &&
      prev.url !== mainPhoto.url &&
      photos.some((p) => samePhoto(p, prev))
    ) {
      onChange({ photos: photos.map((p) => (samePhoto(p, prev) ? mainPhoto : p)) })
    }
  }, [mainPhoto, photos, onChange])

  const setPhotos = (next: ShowcasePhoto[]) => {
    const patch: Partial<ShowcaseFormValue> = { photos: next }
    // En dessous de 2 photos, toute composition retombe sur la photo
    // principale ; l'index du choix unique reste dans les bornes.
    if (next.length < 2 && layout !== 'main') patch.layout = 'main'
    if (singleIndex >= next.length) patch.singleIndex = Math.max(0, next.length - 1)
    onChange(patch)
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= photos.length) return
    const next = [...photos]
    ;[next[i], next[j]] = [next[j], next[i]]
    const patch: Partial<ShowcaseFormValue> = { photos: next }
    if (singleIndex === i) patch.singleIndex = j
    else if (singleIndex === j) patch.singleIndex = i
    onChange(patch)
  }

  const LAYOUTS: { v: ShowcaseLayoutChoice; label: string }[] = [
    { v: 'main', label: t('layoutMain') },
    { v: 'single', label: t('layoutSingle') },
    { v: 'row', label: t('layoutRow') },
    { v: 'column', label: t('layoutColumn') },
  ]
  const GAPS: { v: ShowcaseGap; label: string }[] = [
    { v: 'small', label: t('gapSmall') },
    { v: 'medium', label: t('gapMedium') },
    { v: 'large', label: t('gapLarge') },
  ]

  // Aperçu : la composition telle qu'elle sera enregistrée.
  const previewShowcase: PaintingShowcase | null =
    layout === 'single' && photos.length > 0
      ? { layout: 'single', photos: [photos[Math.min(singleIndex, photos.length - 1)]], gap }
      : (layout === 'row' || layout === 'column') && photos.length >= 2
        ? { layout, photos, gap }
        : null
  const blob = photos.some((p) => p.url.startsWith('blob:')) || !!mainPhoto?.url.startsWith('blob:')
  const pseudo: Painting = {
    id: 'apercu-vitrine',
    title,
    year: 0,
    technique: 'Autre',
    dimensions: '',
    description: '',
    imageUrl: mainPhoto?.url || '',
    imagePublicId: mainPhoto?.publicId || '',
    imageWidth: mainPhoto?.width,
    imageHeight: mainPhoto?.height,
    priceStatus: 'sur_demande',
    category: 'peintures',
    featured: false,
    order: 0,
    createdAt: '',
  }

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <p className="font-display text-xl text-[var(--ink)]">{t('sectionTitle')}</p>
      <p className="mt-1 font-body text-sm text-[var(--ink-soft)]">{t('help')}</p>

      {/* Photos de la composition */}
      <p className="label-field mt-5">{t('photosLabel')}</p>
      <ul className="space-y-2">
        {photos.map((p, i) => (
          <li
            key={p.publicId || p.url || i}
            className={`flex items-center gap-3 p-2 border ${
              layout === 'single' && singleIndex === i
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40'
                : 'border-[var(--line)] bg-[var(--bg)]'
            }`}
          >
            {layout === 'single' ? (
              <input
                type="radio"
                name="showcase-single"
                checked={singleIndex === i}
                onChange={() => onChange({ singleIndex: i })}
                aria-label={t('pickThis', { n: i + 1 })}
                className="w-5 h-5 accent-[var(--accent)] flex-shrink-0"
              />
            ) : null}
            <span className="w-14 h-14 bg-[var(--line)] overflow-hidden flex-shrink-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- vignette admin */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
            </span>
            <span className="flex-1 min-w-0 font-body text-sm text-[var(--ink)]">
              Photo {i + 1}
              {isMain(p) && (
                <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-[var(--accent-soft)] text-[var(--accent)] font-medium">
                  {t('mainBadge')}
                </span>
              )}
            </span>
            <span className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={t('moveBefore', { n: i + 1 })}
                className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === photos.length - 1}
                aria-label={t('moveAfter', { n: i + 1 })}
                className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--ink)] disabled:opacity-25"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                disabled={photos.length <= 1}
                aria-label={t('remove', { n: i + 1 })}
                className="w-11 h-11 flex items-center justify-center border border-[var(--line)] text-[var(--danger)] hover:border-[var(--danger)] disabled:opacity-25"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-3">
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn-secondary text-sm min-h-[48px]"
          >
            {t('addPhotos')}
          </button>
        )}
        {!mainInList && mainPhoto?.url && photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => setPhotos([mainPhoto, ...photos])}
            className="btn-outline text-sm min-h-[48px]"
          >
            {t('addMain')}
          </button>
        )}
      </div>
      {!canCompose && (
        <p className="mt-3 font-body text-sm text-[var(--muted)]">{t('needTwo')}</p>
      )}

      {/* Choix de la présentation */}
      <p className="label-field mt-5">{t('layoutLabel')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t('layoutLabel')}>
        {LAYOUTS.map((opt) => {
          const disabled = opt.v !== 'main' && !canCompose
          return (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={layout === opt.v}
              disabled={disabled}
              onClick={() => onChange({ layout: opt.v })}
              className={`px-4 py-3.5 min-h-[52px] border font-body text-base text-center transition-colors duration-200 disabled:opacity-40 ${
                layout === opt.v
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {layout === 'single' && canCompose && (
        <p className="mt-3 font-body text-sm text-[var(--muted)]">{t('singlePick')}</p>
      )}
      {(layout === 'row' || layout === 'column') && canCompose && (
        <p className="mt-3 font-body text-sm text-[var(--muted)]">
          {layout === 'row' ? t('rowHint') : t('columnHint')}
        </p>
      )}

      {/* Espacement — compositions en plusieurs parties seulement */}
      {(layout === 'row' || layout === 'column') && (
        <div className="mt-5">
          <p className="label-field">{t('gapLabel')}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('gapLabel')}>
            {GAPS.map((opt) => (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={gap === opt.v}
                onClick={() => onChange({ gap: opt.v })}
                className={`px-3 py-3 min-h-[48px] border font-body text-sm text-center transition-colors duration-200 ${
                  gap === opt.v
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Première place */}
      <label className="mt-5 flex items-start gap-3 cursor-pointer p-4 border border-[var(--line)] bg-[var(--bg)]">
        <input
          type="checkbox"
          checked={first}
          onChange={(e) => onChange({ first: e.target.checked })}
          className="w-6 h-6 mt-0.5 accent-[var(--accent)] flex-shrink-0"
        />
        <span>
          <span className="block font-body text-base font-medium text-[var(--ink)]">
            {t('firstPlace')}
          </span>
          <span className="block font-body text-sm text-[var(--ink-soft)] mt-0.5">
            {t('firstPlaceHint')}
          </span>
        </span>
      </label>

      {/* Aperçu en direct de la composition avec le cadre réel */}
      {(previewShowcase || mainPhoto?.url) && (
        <div className="mt-5">
          <p className="label-field">{t('previewLabel')}</p>
          <div className="border border-[var(--line)] bg-[var(--bg)] p-3 flex justify-center">
            {previewShowcase ? (
              <div className="w-full max-w-md">
                <ShowcaseArtwork
                  painting={pseudo}
                  showcase={previewShowcase}
                  alt={title}
                  sizes="300px"
                  frame={frame}
                  maxHeight={220}
                  unoptimized={blob}
                />
              </div>
            ) : (
              mainPhoto?.url && (
                <FramePreview
                  frame={frame}
                  imageUrl={mainPhoto.url}
                  alt={title}
                  w={mainPhoto.width || 4}
                  h={mainPhoto.height || 5}
                  height={160}
                />
              )
            )}
          </div>
        </div>
      )}

      <PhotoPickerModal
        open={pickerOpen}
        mode="multiple"
        maxSelect={Math.max(1, MAX_PHOTOS - photos.length)}
        onClose={() => setPickerOpen(false)}
        onSelect={(chosen) => {
          const added = chosen
            .filter(
              (p) =>
                !photos.some(
                  (x) => x.publicId === p.public_id || x.url === p.secure_url
                )
            )
            .slice(0, Math.max(0, MAX_PHOTOS - photos.length))
            .map((p) => ({
              url: p.secure_url,
              publicId: p.public_id,
              width: p.width > 0 ? p.width : undefined,
              height: p.height > 0 ? p.height : undefined,
            }))
          if (added.length) setPhotos([...photos, ...added])
        }}
      />
    </div>
  )
}
