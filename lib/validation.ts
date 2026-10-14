import { z } from 'zod'

export const uuidSchema = z.string().uuid('Identifiant invalide')

const priceStatusSchema = z.enum(['visible', 'sur_demande', 'vendu', 'non_a_vendre'])

// Traductions déjà calculées (admin) : objet JSONB libre, optionnel.
const translationsSchema = z.record(z.string(), z.unknown()).optional()

export const paintingBodySchema = z.object({
  id: uuidSchema.optional(),
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  year: z.number().int().min(0).max(3000).nullable().optional(),
  technique: z.string().max(100).nullable().optional(),
  dimensions: z.string().max(200).optional().default(''),
  description: z.string().max(20000).optional().default(''),
  imageUrl: z.string().min(1, "L'image est obligatoire").max(2000),
  imagePublicId: z.string().max(500).optional().default(''),
  imageWidth: z.number().int().positive().nullable().optional(),
  imageHeight: z.number().int().positive().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  priceStatus: priceStatusSchema.optional().default('sur_demande'),
  category: z.enum(['peintures', 'collages']).optional().default('peintures'),
  featured: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
  signature: z.string().max(200).optional().default(''),
  translations: translationsSchema,
})

// Notice publique d'une toile : seuls ces 4 champs sont acceptés —
// jamais notes_artiste ni repère de prix (privés, colonne `analysis`).
export const noticeBodySchema = z.object({
  accroche: z.string().max(300, "L'accroche fait 300 caractères maximum").optional().default(''),
  texte_client: z
    .string()
    .max(4000, 'Le texte fait 4000 caractères maximum')
    .optional()
    .default(''),
  ambiance: z.string().max(1500, "L'ambiance fait 1500 caractères maximum").optional().default(''),
  matiere_technique: z
    .array(z.string().max(200))
    .max(8, 'Huit puces maximum')
    .optional()
    .default([]),
})

const mediaSchema = z.object({
  type: z.enum(['photo', 'video']),
  url: z.string().min(1).max(2000),
  publicId: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
})

const dateStringSchema = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Date invalide (format attendu : AAAA-MM-JJ)')

// Photos d'exposition : seules des URLs Cloudinary de notre cloud sont
// acceptées (le nom du cloud est une variable publique, présente côté
// serveur aussi ; si elle manque on vérifie au moins le domaine).
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''
// Exporté : réutilisé par la route d'analyse IA (seules des images de
// notre espace Cloudinary sont envoyées au modèle).
export const cloudinaryUrl = z
  .string()
  .max(2000)
  .refine(
    (u) =>
      CLOUD_NAME
        ? u.startsWith(`https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`)
        : /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u),
    "L'image doit venir de l'espace photo du site"
  )

const eventImageSchema = z.object({
  url: cloudinaryUrl,
  publicId: z.string().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().max(120).optional(),
})

export const eventBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  description: z.string().max(20000).optional().default(''),
  location: z.string().max(300).optional().default(''),
  eventDate: dateStringSchema.optional().default(''),
  coverUrl: z.string().max(2000).optional().default(''),
  coverPublicId: z.string().max(500).optional().default(''),
  media: z.array(mediaSchema).max(200).optional().default([]),
  // Photos de l'exposition : 10 maximum, la première = couverture.
  images: z.array(eventImageSchema).max(10, 'Dix photos maximum').optional(),
  published: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
  translations: translationsSchema,
})

export const reorderBodySchema = z.object({
  id: uuidSchema,
  direction: z.enum(['up', 'down']),
})

export const loginBodySchema = z.object({
  password: z.string().min(1).max(200),
})

const artistPhotoSchema = z.object({
  url: z.string().min(1).max(2000),
  publicId: z.string().max(500).optional().default(''),
  caption: z.string().max(500).optional(),
})

export const settingsBodySchema = z.object({
  artistName: z.string().trim().min(1, 'Le nom est obligatoire').max(200),
  bio: z.string().max(20000).optional().default(''),
  bioShort: z.string().max(500).optional().default(''),
  email: z.string().max(300).optional().default(''),
  phone: z.string().max(50).optional().default(''),
  instagram: z.string().max(200).optional().default(''),
  processText: z.string().max(20000).optional().default(''),
  tagline: z.string().max(160, "L'accroche fait 160 caractères maximum").optional().default(''),
  presentation: z
    .string()
    .max(3000, 'La présentation fait 3000 caractères maximum')
    .optional()
    .default(''),
  photos: z.array(artistPhotoSchema).max(3, 'Trois photos maximum').optional().default([]),
  translations: translationsSchema,
})
