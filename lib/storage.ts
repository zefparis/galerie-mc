import { GallerySettings, Painting } from './types'

const SETTINGS_KEY = 'mc-gallery-settings-v1'

// ─── Settings (localStorage — config admin locale) ────────────────────────────

const DEFAULT_SETTINGS: GallerySettings = {
  artistName: 'Marie-Claire Scandella',
  bio: "Marie-Claire Scandella est une artiste peintre française basée à Montreuil-aux-Lions. Son travail explore l'abstraction à travers une palette sensible et une touche expressive, développant un langage pictural personnel qui allie liberté formelle et maîtrise technique. Ses œuvres ont été présentées dans plusieurs expositions collectives et personnelles.",
  bioShort: 'Artiste peintre abstraite | Montreuil-aux-Lions',
  email: 'contact@marie-claire-scandella.fr',
  phone: '',
  instagram: '',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  adminPasswordHash: '$2a$10$xJ8Kq3Q5Z5Z5Z5Z5Z5Z5ZuKq3Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
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

export async function savePainting(painting: Painting): Promise<Painting> {
  const res = await fetch('/api/paintings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(painting),
  })
  return res.json()
}

export async function updatePainting(id: string, painting: Painting): Promise<Painting> {
  const res = await fetch(`/api/paintings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(painting),
  })
  return res.json()
}

export async function deletePainting(id: string): Promise<void> {
  await fetch(`/api/paintings/${id}`, { method: 'DELETE' })
}

export async function reorderPainting(id: string, direction: 'up' | 'down'): Promise<void> {
  await fetch('/api/paintings/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, direction }),
  })
}

export async function getNextOrder(): Promise<number> {
  const paintings = await getPaintings()
  if (paintings.length === 0) return 1
  return Math.max(...paintings.map((p) => p.order)) + 1
}

export async function isDemo(): Promise<boolean> {
  const paintings = await getPaintings()
  return paintings.length === 0
}
