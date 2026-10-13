/* eslint-disable @typescript-eslint/no-explicit-any */

// Mappe une ligne snake_case PostgreSQL vers l'objet camelCase attendu par le frontend.

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
    category: (r.category === 'collages' ? 'collages' : 'peintures') as 'collages' | 'peintures',
    price: r.price ? Number(r.price) : undefined,
    priceStatus: r.price_status,
    featured: r.featured,
    order: r.order,
    createdAt: r.created_at,
    translations: r.translations || {},
  }
}

export function mapEventRow(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    location: r.location || '',
    eventDate: r.event_date ? r.event_date.toISOString().split('T')[0] : '',
    coverUrl: r.cover_url || '',
    coverPublicId: r.cover_public_id || '',
    media: r.media || [],
    published: r.published,
    order: r.order,
    createdAt: r.created_at,
    translations: r.translations || {},
  }
}
