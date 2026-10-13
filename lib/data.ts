// Accès données côté serveur (Server Components / generateMetadata).
// Jamais de données perdues : lecture seule, mêmes requêtes que les routes API.

import pool from './db'
import { mapPaintingRow, mapEventRow } from './mappers'
import { Painting, GalleryEvent } from './types'

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
