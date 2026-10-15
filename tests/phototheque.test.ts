import { afterEach, describe, expect, it } from 'vitest'
import {
  attachUsage,
  buildUsageIndex,
  sanitizeCloudinaryResource,
} from '../lib/cloudinary-admin'
import {
  adminPhotosQuerySchema,
  extractCloudinaryPublicId,
  paintingBodySchema,
} from '../lib/validation'

const PREV_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

afterEach(() => {
  if (PREV_CLOUD === undefined) {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  } else {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = PREV_CLOUD
  }
})

describe('sanitizeCloudinaryResource (filtrage strict des données du compte)', () => {
  it('ne retourne que les 7 clés autorisées et vérifie notre cloud', () => {
    const raw = {
      asset_id: 'secret-asset-id',
      public_id: 'galerie-mc/expression-rose',
      format: 'jpg',
      version: 1712345678,
      resource_type: 'image',
      type: 'upload',
      created_at: '2026-10-01T12:00:00Z',
      bytes: 245120,
      width: 1600,
      height: 1200,
      folder: 'galerie-mc',
      access_mode: 'public',
      url: 'http://res.cloudinary.com/demo/image/upload/v1/galerie-mc/expression-rose.jpg',
      secure_url:
        'https://res.cloudinary.com/demo/image/upload/v1712345678/galerie-mc/expression-rose.jpg',
      etag: 'etag-interne',
      api_key: 'ne-jamais-exposer',
    }
    const clean = sanitizeCloudinaryResource(raw, 'demo')
    expect(clean).not.toBeNull()
    expect(Object.keys(clean!).sort()).toEqual([
      'bytes',
      'created_at',
      'format',
      'height',
      'public_id',
      'secure_url',
      'width',
    ])
    expect(JSON.stringify(clean)).not.toContain('secret-asset-id')
    expect(JSON.stringify(clean)).not.toContain('ne-jamais-exposer')
    expect(clean!.secure_url).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/expression-rose'
    )
  })

  it('rejette une ressource provenant d’un autre cloud ou avec public_id suspect', () => {
    expect(
      sanitizeCloudinaryResource(
        {
          public_id: 'galerie-mc/x',
          secure_url: 'https://res.cloudinary.com/autre-cloud/image/upload/v1/galerie-mc/x.jpg',
          width: 800,
          height: 600,
          format: 'jpg',
          bytes: 100,
          created_at: '2026-10-01T00:00:00Z',
        },
        'demo'
      )
    ).toBeNull()

    expect(
      sanitizeCloudinaryResource(
        {
          public_id: '../secret',
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/secret.jpg',
        },
        'demo'
      )
    ).toBeNull()
  })
})

describe('croisement base de données (utilisée / pas encore utilisée)', () => {
  it('identifie les photos utilisées par une toile, une exposition ou la présentation', () => {
    const index = buildUsageIndex(
      {
        paintings: [
          {
            title: 'Expression rose',
            image_url:
              'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/expression-rose',
            image_public_id: 'galerie-mc/expression-rose',
          },
          {
            title: 'Fragment I',
            image_url: 'https://res.cloudinary.com/demo/image/upload/w_900/cat.jpg',
            image_public_id: null,
          },
        ],
        events: [
          {
            title: 'Salon d’Automne',
            cover_url: '',
            cover_public_id: '',
            images: [
              {
                url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/vernissage-1',
                publicId: 'galerie-mc/vernissage-1',
              },
            ],
          },
        ],
        settingsPhotos: [
          {
            url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/atelier',
            publicId: 'galerie-mc/atelier',
          },
        ],
      },
      'demo'
    )

    const resources = [
      sanitizeCloudinaryResource(
        {
          public_id: 'galerie-mc/expression-rose',
          width: 1200,
          height: 900,
          format: 'jpg',
          bytes: 1000,
          created_at: '2026-10-10T10:00:00Z',
        },
        'demo'
      )!,
      sanitizeCloudinaryResource(
        {
          public_id: 'cat',
          width: 900,
          height: 600,
          format: 'jpg',
          bytes: 800,
          created_at: '2026-10-09T10:00:00Z',
        },
        'demo'
      )!,
      sanitizeCloudinaryResource(
        {
          public_id: 'galerie-mc/nouvelle-toile',
          width: 1500,
          height: 1500,
          format: 'jpg',
          bytes: 2000,
          created_at: '2026-10-12T10:00:00Z',
        },
        'demo'
      )!,
    ]

    const result = attachUsage(resources, index, 'demo')
    expect(result[0].used).toBe(true)
    expect(result[0].usedBy).toEqual(['Expression rose'])
    expect(result[1].used).toBe(true)
    expect(result[1].usedBy).toEqual(['Fragment I'])
    expect(result[2].used).toBe(false)
    expect(result[2].usedBy).toEqual([])
  })
})

describe('validation serveur des URLs et public_id', () => {
  it('accepte une toile de notre cloud et refuse un autre cloud ou un public_id discordant', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo'

    const valid = paintingBodySchema.safeParse({
      title: 'Nouvelle toile',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/toile-1',
      imagePublicId: 'galerie-mc/toile-1',
      imageWidth: 1200,
      imageHeight: 900,
    })
    expect(valid.success).toBe(true)

    const wrongCloud = paintingBodySchema.safeParse({
      title: 'Toile externe',
      imageUrl:
        'https://res.cloudinary.com/autre-cloud/image/upload/f_auto,q_auto/galerie-mc/toile-1',
      imagePublicId: 'galerie-mc/toile-1',
    })
    expect(wrongCloud.success).toBe(false)

    const mismatchedId = paintingBodySchema.safeParse({
      title: 'Toile discordante',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/galerie-mc/toile-1',
      imagePublicId: 'galerie-mc/autre-image',
    })
    expect(mismatchedId.success).toBe(false)

    expect(
      extractCloudinaryPublicId(
        'https://res.cloudinary.com/demo/image/upload/c_fill,w_400,q_auto,f_auto/v1712345/galerie-mc/toile-1.jpg',
        'demo'
      )
    ).toBe('galerie-mc/toile-1')
  })

  it('valide les paramètres de requête de GET /api/admin/photos', () => {
    expect(
      adminPhotosQuerySchema.safeParse({
        cursor: 'abc123_def',
        folder: 'galerie-mc',
        q: 'rose',
      }).success
    ).toBe(true)

    expect(
      adminPhotosQuerySchema.safeParse({
        folder: '../secret',
      }).success
    ).toBe(false)
  })
})
