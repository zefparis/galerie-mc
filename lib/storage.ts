import { normalizeInstagramUrl } from './instagram'
import { GallerySettings, Painting, PaintingAnalysis, PaintingNotice, Translations } from './types'

const SETTINGS_KEY = 'mc-gallery-settings-v1'

// ─── Settings (localStorage — config admin locale) ────────────────────────────

export const DEFAULT_SETTINGS: GallerySettings = {
  artistName: 'Marie-Claire Scandella',
  bio: "Marie-Claire Scandella est une artiste peintre française basée à Montreuil-aux-Lions. Son travail explore l'abstraction à travers une palette sensible et une touche expressive, développant un langage pictural personnel qui allie liberté formelle et maîtrise technique. Ses œuvres ont été présentées dans plusieurs expositions collectives et personnelles.",
  bioShort: 'Artiste peintre abstraite | Montreuil-aux-Lions',
  // Accroche pré-remplie au premier déploiement : courte et neutre
  // (ni le nom ni le lieu, déjà affichés dans le hero).
  tagline: 'Peintures et collages — la matière en lumière',
  presentation: '',
  email: 'marieclairescandella@yahoo.fr',
  instagramUrl: null,
  processText: '',
  photos: [],
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  accentColor: '#B8935A',
}

export function getSettings(): GallerySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    return DEFAULT_SETTINGS
  }
  try {
    return JSON.parse(raw) as GallerySettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: GallerySettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/** Fusionne le JSONB `settings.data` avec les valeurs par défaut. Les clés
 *  retirées (`phone`, ancienne clé `instagram` au format identifiant)
 *  ne sont jamais renvoyées ; un ancien `instagram` est converti en
 *  `instagramUrl` canonique quand celle-ci n'est pas déjà renseignée. */
export function mergeSettings(
  data: unknown,
  translations?: Translations
): GallerySettings {
  const raw = { ...((data ?? {}) as Record<string, unknown>) }
  const legacyInstagram = raw.instagram
  delete raw.instagram
  delete raw.phone
  const merged = { ...DEFAULT_SETTINGS, ...raw } as GallerySettings
  if (merged.instagramUrl == null) {
    merged.instagramUrl = normalizeInstagramUrl(legacyInstagram)
  }
  if (translations !== undefined) merged.translations = translations
  return merged
}

// ─── Paintings (PostgreSQL via API) ───────────────────────────────────────────

export async function getPaintings(): Promise<Painting[]> {
  const res = await fetch('/api/paintings')
  if (!res.ok) return []
  return res.json()
}

export async function getPaintingById(id: string): Promise<Painting | undefined> {
  const paintings = await getPaintings()
  return paintings.find((p) => p.id === id)
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new Error('Session expirée — reconnectez-vous.')
  }
  throw new Error(data.error || `Erreur serveur (${res.status})`)
}

// Construit un message d'erreur lisible en français quand un enregistrement
// admin échoue (4xx ou 5xx), sans jamais perdre le brouillon local.
export async function readSaveError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.status === 401) {
    return "Je n'ai pas pu enregistrer : session expirée, reconnectez-vous."
  }
  const detail = typeof data?.error === 'string' ? data.error.trim() : ''
  if (detail) {
    return detail.startsWith("Je n'ai pas pu enregistrer")
      ? detail
      : `Je n'ai pas pu enregistrer : ${detail}`
  }
  if (res.status === 405) {
    return "Je n'ai pas pu enregistrer : méthode non autorisée (405). Vos modifications sont gardées en brouillon."
  }
  if (res.status >= 400 && res.status < 500) {
    return `Je n'ai pas pu enregistrer : certaines informations ne sont pas valides (${res.status}). Vos modifications sont gardées en brouillon.`
  }
  return `Je n'ai pas pu enregistrer : le serveur ne répond pas (${res.status}). Vos modifications sont gardées en brouillon, réessayez.`
}

// Renvoie true si l'erreur indique une session admin expirée.
export function isSessionExpired(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('Session expirée')
}

// Redirige vers la page de connexion avec un message clair.
export function redirectToLogin(): void {
  window.location.href = '/admin/login?expired=1'
}

export type PaintingWritePayload = Omit<Painting, 'notice'> & {
  notice?: PaintingNotice | null
  analysis?: PaintingAnalysis | null
}

export async function savePainting(painting: PaintingWritePayload): Promise<Painting> {
  const res = await fetch('/api/paintings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(painting),
  })
  await throwIfNotOk(res)
  return res.json()
}

export async function updatePainting(
  id: string,
  painting: PaintingWritePayload
): Promise<Painting> {
  const res = await fetch(`/api/paintings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(painting),
  })
  await throwIfNotOk(res)
  return res.json()
}

export async function deletePainting(id: string): Promise<void> {
  const res = await fetch(`/api/paintings/${id}`, { method: 'DELETE' })
  await throwIfNotOk(res)
}

export async function reorderPainting(id: string, direction: 'up' | 'down'): Promise<void> {
  const res = await fetch('/api/paintings/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, direction }),
  })
  await throwIfNotOk(res)
}

// Prochain rang dans la catégorie visée (ordres indépendants par galerie) :
// une nouvelle œuvre arrive en fin de sa liste, pas en fin globale.
export async function getNextOrder(category?: Painting['category']): Promise<number> {
  const paintings = await getPaintings()
  const siblings = category
    ? paintings.filter((p) => (p.category || 'peintures') === category)
    : paintings
  if (siblings.length === 0) return 1
  return Math.max(...siblings.map((p) => p.order)) + 1
}

export async function isDemo(): Promise<boolean> {
  const paintings = await getPaintings()
  return paintings.length === 0
}
