import { z } from 'zod'

export const uuidSchema = z.string().uuid('Identifiant invalide')

const priceStatusSchema = z.enum(['visible', 'sur_demande', 'vendu', 'non_a_vendre'])

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
  featured: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
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

export const eventBodySchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  description: z.string().max(20000).optional().default(''),
  location: z.string().max(300).optional().default(''),
  eventDate: dateStringSchema.optional().default(''),
  coverUrl: z.string().max(2000).optional().default(''),
  coverPublicId: z.string().max(500).optional().default(''),
  media: z.array(mediaSchema).max(200).optional().default([]),
  published: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
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
})

export const settingsBodySchema = z.object({
  artistName: z.string().trim().min(1, 'Le nom est obligatoire').max(200),
  bio: z.string().max(20000).optional().default(''),
  bioShort: z.string().max(500).optional().default(''),
  email: z.string().max(300).optional().default(''),
  phone: z.string().max(50).optional().default(''),
  instagram: z.string().max(200).optional().default(''),
  processText: z.string().max(20000).optional().default(''),
  photos: z.array(artistPhotoSchema).max(3, 'Trois photos maximum').optional().default([]),
})
