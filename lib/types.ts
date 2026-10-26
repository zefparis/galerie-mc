import type { FrameId } from './frames'

export type Technique =
  | 'Huile sur toile'
  | 'Acrylique'
  | 'Aquarelle'
  | 'Pastel'
  | 'Fusain'
  | 'Crayon'
  | 'Technique mixte'
  | 'Collage'
  | 'Technique mixte sur papier'
  | 'Encre sur papier'
  | 'Autre'

// 'dessins' a sa page dédiée (/dessins) ; 'peintures' et 'collages'
// partagent la galerie /galerie.
export type PaintingCategory = 'peintures' | 'collages' | 'dessins'

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

// Présentation publique d'une toile, publiée explicitement par l'artiste
// (colonne `notice`). Seuls ces 4 champs partent côté public — jamais les
// notes privées ni le repère de prix de l'analyse.
export interface PaintingNotice {
  accroche: string
  texte_client: string
  ambiance: string
  matiere_technique: string[]
}

// Analyse IA privée (colonne `analysis`, serveur/admin uniquement) : les
// champs de la notice + pistes pour l'artiste + repère de prix éventuel.
// Interdiction stricte : jamais renvoyée par une route ou requête publique.
export interface PaintingAnalysis extends PaintingNotice {
  notes_artiste?: string[]
  repere_prix?: string
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
  // Cadre propre à la toile dans le carrousel d'accueil — NULL/absent =
  // le cadre général des réglages (resolveFrame dans lib/frames.ts).
  frame?: FrameId | null
  translations?: Translations
  // Renseigné côté public quand le titre affiché est traduit (pour montrer
  // l'original français en petit sur la fiche œuvre).
  titleOriginal?: string
  // Signature de l'œuvre (ex. « signée en bas à droite ») — affichée dans
  // la fiche technique uniquement si renseignée.
  signature?: string
  // Notice publiée par l'artiste — vide/absente → rien ne s'affiche.
  notice?: PaintingNotice
  // Vrai côté public quand la langue courante n'a pas de traduction de la
  // notice : le français s'affiche avec une mention discrète.
  noticeUntranslated?: boolean
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
  // Phrase affichée sous le titre du hero (éditable, ≤160 caractères).
  tagline?: string
  // Texte de présentation de la page d'accueil (paragraphes, ≤3000).
  presentation?: string
  email: string
  // Lien Instagram canonique (https://www.instagram.com/<id>/) — null =
  // aucun lien affiché. L'artiste ne veut pas de téléphone : aucun champ
  // n'est lu ni écrit (la donnée éventuelle en base est ignorée).
  instagramUrl?: string | null
  processText?: string
  photos?: ArtistPhoto[]
  translations?: Translations
  cloudinaryCloudName?: string
  cloudinaryUploadPreset?: string
  accentColor?: string
  // Cadre général du carrousel d'accueil — 'gold-classic' par défaut.
  heroFrame?: FrameId
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

// Photo d'une exposition : la première sert de couverture.
// width/height évitent tout saut de mise en page côté public.
export interface EventImage {
  url: string
  publicId?: string
  width?: number
  height?: number
  alt?: string
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
  // Photos de l'exposition (≤10). En l'absence de données, déduit à la
  // lecture de cover_url puis des photos de `media` — rien n'est perdu.
  images: EventImage[]
  published: boolean
  order: number
  createdAt: string
  translations?: Translations
  titleOriginal?: string
}

// Ressource image de la photothèque Cloudinary (lecture seule côté admin).
// Seuls ces champs nettoyés quittent le serveur — aucune donnée interne du compte.
export interface AdminPhoto {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  bytes: number
  created_at: string
  used: boolean
  usedBy: string[]
}

export interface AdminPhotosResponse {
  configured: boolean
  photos: AdminPhoto[]
  nextCursor: string | null
}
