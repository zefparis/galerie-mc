export type Technique =
  | 'Huile sur toile'
  | 'Acrylique'
  | 'Aquarelle'
  | 'Pastel'
  | 'Fusain'
  | 'Technique mixte'
  | 'Autre'

export type PriceStatus = 'visible' | 'sur_demande' | 'vendu' | 'non_a_vendre'

export interface Painting {
  id: string
  title: string
  year: number
  technique: Technique
  dimensions: string
  description: string
  imageUrl: string
  imagePublicId: string
  price?: number
  priceStatus: PriceStatus
  featured: boolean
  order: number
  createdAt: string
}

export interface GallerySettings {
  artistName: string
  bio: string
  bioShort: string
  email: string
  phone?: string
  instagram?: string
  cloudinaryCloudName: string
  cloudinaryUploadPreset: string
  adminPasswordHash: string
  accentColor: string
}

export interface GalleryData {
  version: number
  paintings: Painting[]
  settings: GallerySettings
}

export interface EventMedia {
  type: 'photo' | 'video'
  url: string
  publicId?: string
  caption?: string
}

export interface GalleryEvent {
  id: string
  title: string
  description?: string
  location?: string
  eventDate?: string
  coverUrl?: string
  coverPublicId?: string
  media: EventMedia[]
  published: boolean
  order: number
  createdAt: string
}
