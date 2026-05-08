import { GalleryData, GallerySettings, Painting } from './types'

const STORAGE_KEY = 'mc-gallery-v1'

const DEFAULT_SETTINGS: GallerySettings = {
  artistName: 'Marie-Claire Scandella',
  bio: "Marie-Claire Scandella est une artiste peintre française basée à Alès, dans les Cévennes. Son travail explore la lumière méditerranéenne et les paysages du sud de la France à travers une palette riche et une touche expressive. Après des années de pratique et d'exploration de différentes techniques, elle a développé un style personnel qui allie sensibilité et maîtrise technique. Ses œuvres ont été présentées dans plusieurs expositions collectives et personnelles dans le sud de la France.",
  bioShort: 'Peintre | Alès, France',
  email: 'contact@marie-claire-scandella.fr',
  phone: '',
  instagram: '',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  adminPasswordHash: '$2a$10$xJ8Kq3Q5Z5Z5Z5Z5Z5Z5ZuKq3Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
  accentColor: '#B8935A',
}

const DEMO_PAINTINGS: Painting[] = [
  {
    id: 'demo-1',
    title: 'Lumière du soir sur les Cévennes',
    year: 2024,
    technique: 'Huile sur toile',
    dimensions: '100 × 80 cm',
    description: "Les derniers rayons du soleil embrasent les collines cévenoles dans une symphonie de dorés et d'ambrés. Cette toile capture l'instant fugace où le jour bascule dans la nuit, laissant derrière lui un voile de chaleur sur le paysage.",
    imageUrl: 'https://images.unsplash.com/photo-1578301978018-3005759f48f7?w=800&q=80',
    imagePublicId: 'demo-1',
    priceStatus: 'sur_demande',
    featured: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    title: 'Le Gardon en automne',
    year: 2024,
    technique: 'Aquarelle',
    dimensions: '60 × 40 cm',
    description: "Les reflets dorés de l'automne dansent sur les eaux calmes du Gardon. Une étude en transparence et en lumière.",
    imageUrl: 'https://images.unsplash.com/photo-1580136579312-94651dfd596d?w=800&q=80',
    imagePublicId: 'demo-2',
    priceStatus: 'visible',
    price: 1200,
    featured: false,
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    title: 'Portrait au chapeau de paille',
    year: 2023,
    technique: 'Huile sur toile',
    dimensions: '80 × 60 cm',
    description: "Un portrait intimiste baigné dans la lumière douce d'un après-midi d'été. Le chapeau de paille projette des ombres délicates sur le visage du modèle.",
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80',
    imagePublicId: 'demo-3',
    priceStatus: 'vendu',
    featured: false,
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    title: 'Composition abstraite n°7',
    year: 2024,
    technique: 'Technique mixte',
    dimensions: '120 × 90 cm',
    description: "Une exploration des formes et des couleurs, où les pigments dialoguent librement avec la matière. Cette série abstraite marque une nouvelle étape dans la recherche artistique.",
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=80',
    imagePublicId: 'demo-4',
    priceStatus: 'sur_demande',
    featured: true,
    order: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    title: 'Les oliviers de Provence',
    year: 2023,
    technique: 'Acrylique',
    dimensions: '70 × 50 cm',
    description: "Les oliviers centenaires se dressent sous le soleil provençal, leurs troncs noueux racontant des siècles d'histoire. Une ode à la Méditerranée.",
    imageUrl: 'https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=800&q=80',
    imagePublicId: 'demo-5',
    priceStatus: 'visible',
    price: 950,
    featured: false,
    order: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-6',
    title: 'Crépuscule sur la garrigue',
    year: 2023,
    technique: 'Pastel',
    dimensions: '50 × 40 cm',
    description: "Les tons mauves et rosés du crépuscule enveloppent la garrigue. Le parfum du thym semble émaner de la toile.",
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    imagePublicId: 'demo-6',
    priceStatus: 'non_a_vendre',
    featured: false,
    order: 6,
    createdAt: new Date().toISOString(),
  },
]

function getDefaultData(): GalleryData {
  return {
    version: 1,
    paintings: DEMO_PAINTINGS,
    settings: DEFAULT_SETTINGS,
  }
}

export function getData(): GalleryData {
  if (typeof window === 'undefined') return getDefaultData()
  
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const defaultData = getDefaultData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData))
    return defaultData
  }
  
  try {
    return JSON.parse(raw) as GalleryData
  } catch {
    const defaultData = getDefaultData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData))
    return defaultData
  }
}

export function saveData(data: GalleryData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getPaintings(): Painting[] {
  const data = getData()
  return data.paintings.sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return a.order - b.order
  })
}

export function getPaintingById(id: string): Painting | undefined {
  const data = getData()
  return data.paintings.find((p) => p.id === id)
}

export function savePainting(painting: Painting): void {
  const data = getData()
  const index = data.paintings.findIndex((p) => p.id === painting.id)
  if (index >= 0) {
    data.paintings[index] = painting
  } else {
    data.paintings.push(painting)
  }
  saveData(data)
}

export function deletePainting(id: string): void {
  const data = getData()
  data.paintings = data.paintings.filter((p) => p.id !== id)
  saveData(data)
}

export function reorderPainting(id: string, direction: 'up' | 'down'): void {
  const data = getData()
  const sorted = data.paintings.sort((a, b) => a.order - b.order)
  const index = sorted.findIndex((p) => p.id === id)
  
  if (direction === 'up' && index > 0) {
    const temp = sorted[index].order
    sorted[index].order = sorted[index - 1].order
    sorted[index - 1].order = temp
  } else if (direction === 'down' && index < sorted.length - 1) {
    const temp = sorted[index].order
    sorted[index].order = sorted[index + 1].order
    sorted[index + 1].order = temp
  }
  
  data.paintings = sorted
  saveData(data)
}

export function getSettings(): GallerySettings {
  const data = getData()
  return data.settings
}

export function saveSettings(settings: GallerySettings): void {
  const data = getData()
  data.settings = settings
  saveData(data)
}

export function isDemo(): boolean {
  const data = getData()
  return data.paintings.some((p) => p.id.startsWith('demo-'))
}

export function getNextOrder(): number {
  const data = getData()
  if (data.paintings.length === 0) return 1
  return Math.max(...data.paintings.map((p) => p.order)) + 1
}
