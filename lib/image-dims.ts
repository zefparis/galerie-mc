import pool from './db'
import {
  getServerCloudinaryCredentials,
  normalizePublicId,
} from './cloudinary-admin'
import { extractCloudinaryPublicId } from './validation'

// Renseigne image_width/image_height des toiles depuis l'API Admin
// Cloudinary (lecture seule — les clés ne quittent jamais le serveur).
// Idempotent : n'écrit que dans les lignes où une dimension manque
// encore ; aucune toile déjà renseignée n'est modifiée. Une toile dont
// l'image est introuvable est simplement comptée « injoignable » —
// l'affichage publique retombe alors sur le ratio par défaut 4/5.
export interface ImageDimsSyncResult {
  configured: boolean
  total: number
  missing: number
  updated: number
  unreachable: number
}

export async function syncPaintingImageDims(): Promise<ImageDimsSyncResult> {
  const creds = getServerCloudinaryCredentials()
  if (!creds) {
    return { configured: false, total: 0, missing: 0, updated: 0, unreachable: 0 }
  }

  const total = Number(
    (await pool.query('SELECT count(*)::int AS n FROM paintings')).rows[0]?.n ??
      0
  )
  const { rows } = await pool.query(
    `SELECT id, title, image_url, image_public_id
       FROM paintings
      WHERE image_width IS NULL OR image_height IS NULL
         OR image_width <= 0 OR image_height <= 0
      ORDER BY "order" ASC`
  )

  const baseApi = (
    process.env.CLOUDINARY_API_BASE_URL || 'https://api.cloudinary.com/v1_1'
  ).replace(/\/+$/, '')
  const basic = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString(
    'base64'
  )

  let updated = 0
  let unreachable = 0
  for (const row of rows as Array<{
    id: string
    title: string
    image_url: string | null
    image_public_id: string | null
  }>) {
    const publicId =
      normalizePublicId(row.image_public_id) ||
      normalizePublicId(
        extractCloudinaryPublicId(row.image_url || '', creds.cloudName)
      )
    if (!publicId) {
      unreachable++
      continue
    }
    try {
      const path = publicId.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(
        `${baseApi}/${encodeURIComponent(creds.cloudName)}/resources/image/upload/${path}`,
        {
          headers: {
            Authorization: `Basic ${basic}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        }
      )
      if (!res.ok) {
        unreachable++
        continue
      }
      const data = (await res.json()) as { width?: unknown; height?: unknown }
      const w = Math.round(Number(data.width))
      const h = Math.round(Number(data.height))
      if (!(w > 0 && h > 0)) {
        unreachable++
        continue
      }
      // Jamais destructif : n'écrit que si la ligne est toujours vide.
      const upd = await pool.query(
        `UPDATE paintings SET image_width = $1, image_height = $2
          WHERE id = $3 AND (image_width IS NULL OR image_height IS NULL
                 OR image_width <= 0 OR image_height <= 0)`,
        [w, h, row.id]
      )
      if (upd.rowCount && upd.rowCount > 0) updated++
    } catch {
      unreachable++
    }
  }

  console.log(
    `[admin] formats des photos : ${updated} toile(s) mise(s) à jour sur ` +
      `${rows.length} à compléter (${total} toile(s) au total)`
  )
  return {
    configured: true,
    total,
    missing: rows.length,
    updated,
    unreachable,
  }
}
