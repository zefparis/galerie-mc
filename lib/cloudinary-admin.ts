import pool from './db'
import type { AdminPhoto } from './types'
import { extractCloudinaryPublicId, getCloudinaryCloudName } from './validation'

// Lecture seule du compte Cloudinary côté serveur uniquement.
// Les clés CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET ne quittent JAMAIS
// ce module : ni vers le client, ni dans une réponse HTTP, ni dans les logs.

export const PHOTOS_PAGE_SIZE = 40
const CACHE_TTL_MS = 60_000

export interface RawCloudinaryResource {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  bytes: number
  created_at: string
}

interface CachedPage {
  expiresAt: number
  resources: RawCloudinaryResource[]
  nextCursor: string | null
}

const pageCache = new Map<string, CachedPage>()

export function clearPhotosCache(): void {
  pageCache.clear()
}

export function getServerCloudinaryCredentials(): {
  cloudName: string
  apiKey: string
  apiSecret: string
} | null {
  const cloudName = getCloudinaryCloudName()
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim()
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim()
  if (!cloudName || !apiKey || !apiSecret) return null
  return { cloudName, apiKey, apiSecret }
}

export function normalizePublicId(id?: string | null): string {
  if (!id || typeof id !== 'string') return ''
  return id
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?|heic)$/i, '')
}

/** Ne conserve QUE les 7 champs autorisés d'une ressource Cloudinary et
 *  vérifie qu'elle appartient bien à notre cloud. Toute autre propriété du
 *  compte (asset_id, version, access_mode, etag, url http…) est écartée. */
export function sanitizeCloudinaryResource(
  raw: unknown,
  cloudName: string
): RawCloudinaryResource | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (r.resource_type && r.resource_type !== 'image') return null

  const publicId = typeof r.public_id === 'string' ? r.public_id.trim() : ''
  if (
    !publicId ||
    publicId.includes('..') ||
    publicId.includes('\\') ||
    publicId.includes(':') ||
    !/^[a-zA-Z0-9_\-/. ]+$/.test(publicId)
  ) {
    return null
  }

  const expectedPrefix = `https://res.cloudinary.com/${cloudName}/image/upload/`
  const rawUrl = typeof r.secure_url === 'string' ? r.secure_url.trim() : ''
  // Si Cloudinary fournit une secure_url d'un autre cloud, on rejette la ressource.
  if (rawUrl && !rawUrl.startsWith(expectedPrefix)) {
    return null
  }
  // URL canonique de notre cloud (même format que uploadToCloudinaryProgress).
  const secureUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}`

  const width = Number(r.width)
  const height = Number(r.height)
  const bytes = Number(r.bytes)

  return {
    public_id: publicId,
    secure_url: secureUrl,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 0,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 0,
    format: typeof r.format === 'string' ? r.format.slice(0, 20) : '',
    bytes: Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
  }
}

export interface UsageSource {
  paintings: Array<{ title: string; image_url?: string | null; image_public_id?: string | null }>
  events: Array<{
    title: string
    cover_url?: string | null
    cover_public_id?: string | null
    images?: unknown
    media?: unknown
  }>
  settingsPhotos: Array<{ url?: string | null; publicId?: string | null }>
}

/** Construit l'index d'utilisation (par public_id normalisé et par URL) à
 *  partir des toiles, expositions et réglages enregistrés en base. */
export function buildUsageIndex(
  source: UsageSource,
  cloudName?: string
): Map<string, string[]> {
  const byKey = new Map<string, string[]>()

  const add = (key: string | null | undefined, label: string) => {
    if (!key || !label) return
    const k = key.trim()
    if (!k) return
    const existing = byKey.get(k)
    if (!existing) {
      byKey.set(k, [label])
    } else if (!existing.includes(label)) {
      existing.push(label)
    }
  }

  const registerRef = (url?: string | null, publicId?: string | null, label = '') => {
    if (!label) return
    const normId = normalizePublicId(publicId)
    if (normId) add(`id:${normId}`, label)
    if (url && typeof url === 'string') {
      const extracted = extractCloudinaryPublicId(url, cloudName)
      if (extracted) add(`id:${normalizePublicId(extracted)}`, label)
      add(`url:${url.trim()}`, label)
    }
  }

  for (const p of source.paintings) {
    const label = (p.title || '').trim() || 'Toile sans titre'
    registerRef(p.image_url, p.image_public_id, label)
  }

  for (const e of source.events) {
    const label = (e.title || '').trim() || 'Exposition'
    registerRef(e.cover_url, e.cover_public_id, label)
    if (Array.isArray(e.images)) {
      for (const img of e.images) {
        if (img && typeof img === 'object') {
          const rec = img as { url?: string; publicId?: string }
          registerRef(rec.url, rec.publicId, label)
        }
      }
    }
    if (Array.isArray(e.media)) {
      for (const m of e.media) {
        if (m && typeof m === 'object') {
          const rec = m as { type?: string; url?: string; publicId?: string }
          if (!rec.type || rec.type === 'photo') {
            registerRef(rec.url, rec.publicId, label)
          }
        }
      }
    }
  }

  for (const sp of source.settingsPhotos) {
    registerRef(sp?.url, sp?.publicId, 'Ma présentation')
  }

  return byKey
}

export function attachUsage(
  resources: RawCloudinaryResource[],
  usageIndex: Map<string, string[]>,
  cloudName?: string
): AdminPhoto[] {
  return resources.map((r) => {
    const labels: string[] = []
    const pushAll = (items?: string[]) => {
      if (!items) return
      for (const item of items) {
        if (!labels.includes(item)) labels.push(item)
      }
    }

    const normId = normalizePublicId(r.public_id)
    if (normId) pushAll(usageIndex.get(`id:${normId}`))
    const fromUrl = extractCloudinaryPublicId(r.secure_url, cloudName)
    if (fromUrl) pushAll(usageIndex.get(`id:${normalizePublicId(fromUrl)}`))
    pushAll(usageIndex.get(`url:${r.secure_url}`))

    return {
      public_id: r.public_id,
      secure_url: r.secure_url,
      width: r.width,
      height: r.height,
      format: r.format,
      bytes: r.bytes,
      created_at: r.created_at,
      used: labels.length > 0,
      usedBy: labels,
    }
  })
}

async function loadUsageSourceFromDb(): Promise<UsageSource> {
  const source: UsageSource = { paintings: [], events: [], settingsPhotos: [] }
  try {
    const pRes = await pool.query(
      'SELECT title, image_url, image_public_id FROM paintings ORDER BY "order" ASC'
    )
    source.paintings = pRes.rows
  } catch {
    // Table non initialisée : n'empêche pas la photothèque de s'afficher.
  }

  try {
    const eRes = await pool.query(
      'SELECT title, cover_url, cover_public_id, images, media FROM events'
    )
    source.events = eRes.rows
  } catch {
    try {
      const eRes = await pool.query('SELECT title, cover_url, cover_public_id, media FROM events')
      source.events = eRes.rows
    } catch {
      // ignore
    }
  }

  try {
    const sRes = await pool.query('SELECT data FROM settings WHERE id = 1')
    const photos = sRes.rows[0]?.data?.photos
    if (Array.isArray(photos)) {
      source.settingsPhotos = photos
    }
  } catch {
    // ignore
  }

  return source
}

/** Appelle l'API Admin Cloudinary en lecture seule (GET resources/image/upload,
 *  triées de la plus récente à la plus ancienne, 40 par page) avec un cache
 *  mémoire de 60 s pour préserver les quotas. */
export async function fetchCloudinaryPage(params: {
  cursor?: string
  folder?: string
}): Promise<{ resources: RawCloudinaryResource[]; nextCursor: string | null }> {
  const creds = getServerCloudinaryCredentials()
  if (!creds) {
    throw new Error('NOT_CONFIGURED')
  }

  const cursor = (params.cursor || '').trim()
  const folder = (params.folder || '').trim()
  const cacheKey = `${creds.cloudName}|${folder}|${cursor}`
  const now = Date.now()
  const cached = pageCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return { resources: cached.resources, nextCursor: cached.nextCursor }
  }

  const baseApi = (
    process.env.CLOUDINARY_API_BASE_URL || 'https://api.cloudinary.com/v1_1'
  ).replace(/\/+$/, '')

  const url = new URL(`${baseApi}/${encodeURIComponent(creds.cloudName)}/resources/image/upload`)
  url.searchParams.set('max_results', String(PHOTOS_PAGE_SIZE))
  url.searchParams.set('direction', 'desc')
  if (cursor) url.searchParams.set('next_cursor', cursor)
  if (folder) url.searchParams.set('prefix', folder)

  const basic = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64')

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    // Aucun détail sensible ni clé dans le log ou l'erreur.
    console.error(`[admin/photos] Cloudinary HTTP ${res.status}`)
    throw new Error('CLOUDINARY_ERROR')
  }

  const payload = (await res.json()) as {
    resources?: unknown[]
    next_cursor?: unknown
  }

  const rawList = Array.isArray(payload.resources) ? payload.resources : []
  const resources = rawList
    .map((item) => sanitizeCloudinaryResource(item, creds.cloudName))
    .filter((item): item is RawCloudinaryResource => item !== null)

  // Tri de sécurité du plus récent au plus ancien (created_at décroissant).
  resources.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const nextCursor =
    typeof payload.next_cursor === 'string' && payload.next_cursor.trim()
      ? payload.next_cursor.trim()
      : null

  pageCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    resources,
    nextCursor,
  })

  return { resources, nextCursor }
}

export async function listAdminPhotos(params: {
  cursor?: string
  folder?: string
  q?: string
}): Promise<{
  configured: boolean
  photos: AdminPhoto[]
  nextCursor: string | null
}> {
  const creds = getServerCloudinaryCredentials()
  if (!creds) {
    return { configured: false, photos: [], nextCursor: null }
  }

  const [{ resources, nextCursor }, usageSource] = await Promise.all([
    fetchCloudinaryPage({ cursor: params.cursor, folder: params.folder }),
    loadUsageSourceFromDb(),
  ])

  const query = (params.q || '').trim().toLowerCase()
  const filtered = query
    ? resources.filter((r) => r.public_id.toLowerCase().includes(query))
    : resources

  const usageIndex = buildUsageIndex(usageSource, creds.cloudName)
  const photos = attachUsage(filtered, usageIndex, creds.cloudName)

  return {
    configured: true,
    photos,
    nextCursor,
  }
}
