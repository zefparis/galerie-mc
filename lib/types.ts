export type Technique =
  | 'Huile sur toile'
  | 'Acrylique'
  | 'Aquarelle'
  | 'Pastel'
  | 'Fusain'
  | 'Technique mixte'
  | 'Collage'
  | 'Technique mixte sur papier'
  | 'Encre sur papier'
  | 'Autre'

export type PaintingCategory = 'peintures' | 'collages'

export type PriceStatus = 'visible' | 'sur_demande' | 'vendu' | 'non_a_vendre'

export type TargetLocale = 'en' | 'es' | 'de'
// 'relu' : traduction importée faite à la main (« Traduit et relu ») —
// jamais écrasée, même par « Retraduire » ; 'corrige' : saisie dans l'admin.
export type TranslationStatus = 'auto' | 'corrige' | 'a_mettre_a_jour' | 'echec' | 'relu'

export interface FieldTranslationMeta {
  sourceHash: string
  statut: TranslationStatus
  // Raison courte en français quand statut = 'echec' (affichée dans l'admin).
  erreur?: string
}

// Traductions d'un contenu : { en: {champ: texte}, es: {...}, de: {...},
// _meta: { champ: { langue: { sourceHash, statut } } } }
export interface Translations {
  en?: Record<string, string>
  es?: Record<string, string>
  de?: Record<string, string>
  _meta?: Record<string, Partial<Record<TargetLocale, FieldTranslationMeta>>>
}

export interface Painting {
  id: string
  title: string
  year: number
  technique: Technique
  dimensions: string
  description: string
  imageUrl: string
  imagePublicId: string
  imageWidth?: number
  imageHeight?: number
  price?: number
  priceStatus: PriceStatus
  category: PaintingCategory
  featured: boolean
  order: number
  createdAt: string
  translations?: Translations
  // Renseigné côté public quand le titre affiché est traduit (pour montrer
  // l'original français en petit sur la fiche œuvre).
  titleOriginal?: string
}

export interface ArtistPhoto {
  url: string
  publicId: string
  caption?: string
}

export interface GallerySettings {
  artistName: string
  bio: string
  bioShort: string
  email: string
  phone?: string
  instagram?: string
  processText?: string
  photos?: ArtistPhoto[]
  translations?: Translations
  cloudinaryCloudName?: string
  cloudinaryUploadPreset?: string
  accentColor?: string
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
  translations?: Translations
  titleOriginal?: string
}
