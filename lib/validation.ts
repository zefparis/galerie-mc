import { z } from 'zod'

export const uuidSchema = z.string().uuid('Identifiant invalide')

const priceStatusSchema = z.enum(['visible', 'sur_demande', 'vendu', 'non_a_vendre'])

// Traductions déjà calculées (admin) : objet JSONB libre, optionnel.
const translationsSchema = z.record(z.string(), z.unknown()).optional()

// Nom du cloud Cloudinary : lu à chaque validation pour tenir compte
// de l'environnement serveur courant sans figer la valeur à l'import.
export function getCloudinaryCloudName(): string {
  return (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ''
  ).trim()
}

const TRANSFORM_SEGMENT = /^(w|h|c|q|f|e|g|ar|dpr|fl|bo|b|r|o|a|t|x|y|z|ac|af|br|co|cs|d|dl|dn|du|eo|fn|fps|ki|l|ow|oh|p|pg|po|pr|so|sp|tw|u|vc|vs|vt)_/

/** Extrait le public_id canonique (sans transformation, sans version v123,
 *  sans extension finale) depuis une URL Cloudinary d'image. */
export function extractCloudinaryPublicId(url: string, requiredCloud?: string): string | null {
  if (!url || typeof url !== 'string' || url.includes('..') || url.includes('\\')) return null
  const cloud = (requiredCloud ?? getCloudinaryCloudName()).trim()
  const match = /^https:\/\/res\.cloudinary\.com\/([a-zA-Z0-9_-]+)\/image\/upload\/(.+)$/.exec(
    url.trim()
  )
  if (!match) return null
  const [, urlCloud, rest] = match
  if (cloud && urlCloud !== cloud) return null

  const cleanRest = rest.split(/[?#]/)[0]
  const segments = cleanRest.split('/').filter(Boolean)
  while (
    segments.length > 1 &&
    (segments[0].includes(',') ||
      TRANSFORM_SEGMENT.test(segments[0]) ||
      /^v\d+$/.test(segments[0]))
  ) {
    segments.shift()
  }
  if (!segments.length) return null
  const joined = segments.join('/')
  const withoutExt = joined.replace(/\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?|heic)$/i, '')
  return withoutExt || null
}

// Exporté : réutilisé par les toiles, les expositions et la route d'analyse IA
// (seules des images de notre espace Cloudinary sont acceptées).
export const cloudinaryUrl = z
  .string()
  .trim()
  .min(1, "L'image est obligatoire")
  .max(2000)
  .refine((u) => {
    if (u.includes('..') || u.includes('\\')) return false
    const cloud = getCloudinaryCloudName()
    const prefix = cloud
      ? `https://res.cloudinary.com/${cloud}/image/upload/`
      : null
    if (prefix && !u.startsWith(prefix)) return false
    return extractCloudinaryPublicId(u, cloud) !== null
  }, "L'image doit venir de l'espace photo du site")

export const cloudinaryPublicId = z
  .string()
  .trim()
  .max(500)
  .refine((id) => {
    if (!id) return true
    if (id.includes('..') || id.includes('//') || id.includes(':') || id.includes('\\')) {
      return false
    }
    if (!/^[a-zA-Z0-9_\-/. ]+$/.test(id)) return false
    const folderPrefix = (process.env.CLOUDINARY_FOLDER_PREFIX || '').trim()
    if (folderPrefix && !id.startsWith(folderPrefix)) return false
    return true
  }, 'Identifiant de photo invalide')

function publicIdMatchesUrl(imageUrl: string, imagePublicId?: string): boolean {
  if (!imagePublicId) return true
  const fromUrl = extractCloudinaryPublicId(imageUrl)
  if (!fromUrl) return false
  const cleanedId = imagePublicId.replace(/\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?|heic)$/i, '')
  return fromUrl === cleanedId
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/
const noHtml = (msg = 'Le texte ne doit pas contenir de balises HTML') =>
  z.string().refine((s) => !HTML_TAG_RE.test(s), msg)

// Notice publique d'une toile : seuls ces 4 champs sont acceptés —
// jamais notes_artiste ni repère de prix (privés, colonne `analysis`).
export const noticeBodySchema = z
  .object({
    accroche: noHtml()
      .pipe(z.string().max(300, "L'accroche fait 300 caractères maximum"))
      .optional()
      .default(''),
    texte_client: noHtml()
      .pipe(z.string().max(4000, 'Le texte fait 4000 caractères maximum'))
      .optional()
      .default(''),
    ambiance: noHtml()
      .pipe(z.string().max(1500, "L'ambiance fait 1500 caractères maximum"))
      .optional()
      .default(''),
    matiere_technique: z
      .array(noHtml().pipe(z.string().max(200, 'Chaque puce fait 200 caractères maximum')))
      .max(8, 'Huit puces maximum')
      .optional()
      .default([]),
  })
  .strict()

// Analyse IA privée (colonne `analysis`, jamais exposée côté public).
export const analysisBodySchema = z
  .object({
    accroche: noHtml()
      .pipe(z.string().max(300, "L'accroche fait 300 caractères maximum"))
      .optional()
      .default(''),
    texte_client: noHtml()
      .pipe(z.string().max(4000, 'Le texte fait 4000 caractères maximum'))
      .optional()
      .default(''),
    ambiance: noHtml()
      .pipe(z.string().max(1500, "L'ambiance fait 1500 caractères maximum"))
      .optional()
      .default(''),
    matiere_technique: z
      .array(noHtml().pipe(z.string().max(200)))
      .max(8, 'Huit puces maximum')
      .optional()
      .default([]),
    notes_artiste: z
      .array(noHtml().pipe(z.string().max(400)))
      .max(5, 'Cinq notes maximum')
      .optional(),
    repere_prix: noHtml().pipe(z.string().max(120)).optional(),
  })
  .strict()

export const paintingBodySchema = z
  .object({
    id: uuidSchema.optional(),
    title: noHtml().pipe(z.string().trim().min(1, 'Le titre est obligatoire').max(300)),
    year: z.number().int().min(0).max(3000).nullable().optional(),
    technique: z.string().max(100).nullable().optional(),
    dimensions: z.string().max(200).optional().default(''),
    description: z.string().max(20000).optional().default(''),
    imageUrl: cloudinaryUrl,
    imagePublicId: cloudinaryPublicId.optional().default(''),
    imageWidth: z.number().int().positive().nullable().optional(),
    imageHeight: z.number().int().positive().nullable().optional(),
    price: z.number().nonnegative().nullable().optional(),
    priceStatus: priceStatusSchema.optional().default('sur_demande'),
    category: z.enum(['peintures', 'collages']).optional().default('peintures'),
    featured: z.boolean().optional().default(false),
    order: z.number().int().optional().default(0),
    signature: z.string().max(200).optional().default(''),
    createdAt: z.string().max(100).optional(),
    translations: translationsSchema,
    notice: noticeBodySchema.nullable().optional(),
    analysis: analysisBodySchema.nullable().optional(),
  })
  .strict()
  .refine((b) => publicIdMatchesUrl(b.imageUrl, b.imagePublicId), {
    path: ['imagePublicId'],
    message: "L'identifiant de la photo ne correspond pas à l'adresse de notre espace photo",
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

const eventImageSchema = z
  .object({
    url: cloudinaryUrl,
    publicId: cloudinaryPublicId.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    alt: z.string().max(120).optional(),
  })
  .refine((img) => publicIdMatchesUrl(img.url, img.publicId), {
    path: ['publicId'],
    message: "L'identifiant de la photo ne correspond pas à l'adresse de notre espace photo",
  })

// Paramètres de requête pour GET /api/admin/photos (curseur, dossier, recherche).
export const adminPhotosQuerySchema = z.object({
  cursor: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-zA-Z0-9_\-=+/]*$/, 'Curseur de pagination invalide')
    .optional()
    .default(''),
  folder: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-zA-Z0-9_\-/]*$/, 'Dossier invalide')
    .refine((f) => !f.includes('..') && !f.includes('//'), 'Dossier invalide')
    .optional()
    .default(''),
  q: z
    .string()
    .trim()
    .max(120, 'Recherche trop longue (120 caractères max)')
    .optional()
    .default(''),
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

const artistPhotoSchema = z
  .object({
    url: cloudinaryUrl,
    publicId: cloudinaryPublicId.optional(),
    public_id: cloudinaryPublicId.optional(),
    caption: z.string().max(500).optional(),
  })
  .transform((p) => ({
    url: p.url,
    publicId: p.publicId || p.public_id || '',
    ...(p.caption !== undefined ? { caption: p.caption } : {}),
  }))
  .refine((p) => publicIdMatchesUrl(p.url, p.publicId), {
    path: ['publicId'],
    message:
      "Une photo n'est pas valide : l'identifiant ne correspond pas à notre espace photo",
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
  photos: z.array(artistPhotoSchema).max(10, 'Dix photos maximum').optional().default([]),
  translations: translationsSchema,
})
