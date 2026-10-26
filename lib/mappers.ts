/* eslint-disable @typescript-eslint/no-explicit-any */

// Mappe une ligne snake_case PostgreSQL vers l'objet camelCase attendu par le frontend.
import type { EventImage, PaintingNotice } from './types'
import { isFrameId } from './frames'

/** La notice publiée ne contient que 4 clés — tout le reste (notes
 *  privées, repère de prix) reste dans `analysis`, jamais sélectionné
 *  par les requêtes publiques ni mappé ici. */
function cleanNotice(raw: unknown): PaintingNotice | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const puces = Array.isArray(r.matiere_technique)
    ? r.matiere_technique.map((p) => str(p).trim()).filter(Boolean)
    : []
  const notice: PaintingNotice = {
    accroche: str(r.accroche).trim(),
    texte_client: str(r.texte_client).trim(),
    ambiance: str(r.ambiance).trim(),
    matiere_technique: puces,
  }
  return notice.accroche || notice.texte_client || notice.ambiance || puces.length
    ? notice
    : undefined
}

export function mapPaintingRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    year: r.year,
    technique: r.technique,
    dimensions: r.dimensions || '',
    description: r.description || '',
    imageUrl: r.image_url,
    imagePublicId: r.image_public_id || '',
    imageWidth: r.image_width ? Number(r.image_width) : undefined,
    imageHeight: r.image_height ? Number(r.image_height) : undefined,
    category: (r.category === 'collages' || r.category === 'dessins'
      ? r.category
      : 'peintures') as 'collages' | 'dessins' | 'peintures',
    price: r.price ? Number(r.price) : undefined,
    priceStatus: r.price_status,
    featured: r.featured,
    order: r.order,
    createdAt: r.created_at,
    translations: r.translations || {},
    signature: typeof r.signature === 'string' && r.signature.trim() ? r.signature.trim() : undefined,
    // NULL ou valeur inconnue → pas de cadre propre (le cadre général s'applique).
    frame: isFrameId(r.frame) ? r.frame : null,
    notice: cleanNotice(r.notice),
  }
}

function sanitizeEventImage(m: any): EventImage | null {
  if (!m || typeof m.url !== 'string' || !m.url) return null
  return {
    url: m.url,
    publicId: typeof m.publicId === 'string' ? m.publicId : undefined,
    width: Number.isInteger(m.width) && m.width > 0 ? m.width : undefined,
    height: Number.isInteger(m.height) && m.height > 0 ? m.height : undefined,
    alt: typeof m.alt === 'string' ? m.alt : undefined,
  }
}

export function mapEventRow(r: any) {
  const media = Array.isArray(r.media) ? r.media : []
  const images = ((Array.isArray(r.images) ? r.images : []) as any[])
    .map(sanitizeEventImage)
    .filter((i: EventImage | null): i is EventImage => i !== null)
  // Repli de lecture (rien n'est recopié ni perdu) : pour les événements
  // sans colonne `images` remplie, la photo unique devient la première
  // photo, puis suivent les photos déjà présentes dans `media`.
  if (images.length === 0) {
    if (r.cover_url) {
      images.push({ url: r.cover_url, publicId: r.cover_public_id || undefined })
    }
    for (const m of media) {
      if (m?.type === 'photo' && m.url && !images.some((i) => i.url === m.url)) {
        images.push({ url: m.url, publicId: m.publicId || undefined, alt: m.caption || undefined })
      }
    }
  }
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    location: r.location || '',
    eventDate: r.event_date ? r.event_date.toISOString().split('T')[0] : '',
    coverUrl: r.cover_url || '',
    coverPublicId: r.cover_public_id || '',
    media,
    images,
    published: r.published,
    order: r.order,
    createdAt: r.created_at,
    translations: r.translations || {},
  }
}
