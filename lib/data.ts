// Accès données côté serveur (Server Components / generateMetadata).
// Jamais de données perdues : lecture seule, mêmes requêtes que les routes API.

import pool from './db'
import { mapPaintingRow, mapEventRow } from './mappers'
import { Painting, GalleryEvent, GallerySettings } from './types'
import { DEFAULT_SETTINGS } from './storage'

export async function getPaintings(): Promise<Painting[]> {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM paintings ORDER BY featured DESC, "order" ASC'
    )
    return rows.map(mapPaintingRow)
  } catch (err) {
    console.error('[data] getPaintings', err)
    return []
  }
}

export async function getPaintingById(id: string): Promise<Painting | null> {
  try {
    const { rows } = await pool.query('SELECT * FROM paintings WHERE id=$1', [id])
    return rows.length ? mapPaintingRow(rows[0]) : null
  } catch (err) {
    console.error('[data] getPaintingById', err)
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
    return {
      ...DEFAULT_SETTINGS,
      ...(rows[0].data as Partial<GallerySettings>),
      translations: rows[0].translations || {},
    }
  } catch (err) {
    // Colonne translations pas encore créée : lecture sans elle.
    if ((err as { code?: string })?.code === '42703') {
      try {
        const { rows } = await pool.query('SELECT data FROM settings WHERE id = 1')
        if (!rows.length) return DEFAULT_SETTINGS
        return { ...DEFAULT_SETTINGS, ...(rows[0].data as Partial<GallerySettings>) }
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
