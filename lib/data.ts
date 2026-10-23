// Accès données côté serveur (Server Components / generateMetadata).
// Jamais de données perdues : lecture seule, mêmes requêtes que les routes API.

import pool from './db'
import { mapPaintingRow, mapEventRow } from './mappers'
import { Painting, GalleryEvent, GallerySettings } from './types'
import { DEFAULT_SETTINGS, mergeSettings } from './storage'

// Projection publique des toiles : colonnes listées explicitement — la
// colonne privée `analysis` (notes_artiste, repère de prix) ne doit
// JAMAIS être lue ici, ni sérialisée vers les composants clients.
const PAINTING_PUBLIC_COLS = `id, title, year, technique, dimensions, description, image_url,
  image_public_id, price, price_status, featured, "order", created_at,
  image_width, image_height, category, signature, notice, translations`

export async function getPaintings(): Promise<Painting[]> {
  try {
    const { rows } = await pool.query(
      `SELECT ${PAINTING_PUBLIC_COLS} FROM paintings ORDER BY featured DESC, "order" ASC`
    )
    return rows.map(mapPaintingRow)
  } catch (err) {
    if ((err as { code?: string })?.code === '42703') return getPaintingsLegacy()
    console.error('[data] getPaintings', err)
    return []
  }
}

// Schéma antérieur aux colonnes signature/notice : lecture sans elles.
async function getPaintingsLegacy(): Promise<Painting[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, year, technique, dimensions, description, image_url,
        image_public_id, price, price_status, featured, "order", created_at,
        image_width, image_height, category, translations
       FROM paintings ORDER BY featured DESC, "order" ASC`
    )
    return rows.map(mapPaintingRow)
  } catch (err) {
    console.error('[data] getPaintingsLegacy', err)
    return []
  }
}

export async function getPaintingById(id: string): Promise<Painting | null> {
  try {
    const { rows } = await pool.query(`SELECT ${PAINTING_PUBLIC_COLS} FROM paintings WHERE id=$1`, [id])
    return rows.length ? mapPaintingRow(rows[0]) : null
  } catch (err) {
    if ((err as { code?: string })?.code === '42703') return getPaintingByIdLegacy(id)
    console.error('[data] getPaintingById', err)
    return null
  }
}

async function getPaintingByIdLegacy(id: string): Promise<Painting | null> {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, year, technique, dimensions, description, image_url,
        image_public_id, price, price_status, featured, "order", created_at,
        image_width, image_height, category, translations
       FROM paintings WHERE id=$1`,
      [id]
    )
    return rows.length ? mapPaintingRow(rows[0]) : null
  } catch (err) {
    console.error('[data] getPaintingByIdLegacy', err)
    return null
  }
}

export async function getPublishedEvents(): Promise<GalleryEvent[]> {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM events WHERE published = true ORDER BY event_date DESC NULLS LAST, "order" ASC'
    )
    return rows.map(mapEventRow)
  } catch (err) {
    console.error('[data] getPublishedEvents', err)
    return []
  }
}

// Réglages de l'artiste (ligne unique id=1, fusionnée avec les valeurs par
// défaut pour que le site fonctionne même avant la première sauvegarde).
export async function getGallerySettings(): Promise<GallerySettings> {
  try {
    const { rows } = await pool.query('SELECT data, translations FROM settings WHERE id = 1')
    if (!rows.length) return DEFAULT_SETTINGS
    return mergeSettings(rows[0].data, rows[0].translations || {})
  } catch (err) {
    // Colonne translations pas encore créée : lecture sans elle.
    if ((err as { code?: string })?.code === '42703') {
      try {
        const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
        if (!rows.length) return DEFAULT_SETTINGS
        return mergeSettings(rows[0].data)
      } catch {
        return DEFAULT_SETTINGS
      }
    }
    console.error('[data] getGallerySettings', err)
    return DEFAULT_SETTINGS
  }
}

export async function getPublishedEventById(id: string): Promise<GalleryEvent | null> {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM events WHERE id=$1 AND published = true',
      [id]
    )
    return rows.length ? mapEventRow(rows[0]) : null
  } catch (err) {
    console.error('[data] getPublishedEventById', err)
    return null
  }
}
