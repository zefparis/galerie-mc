import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError, notFound } from '@/lib/api'
import { reorderBodySchema } from '@/lib/validation'

interface Row {
  id: string
  order: number
  category?: string
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const client = await pool.connect()
  try {
    const { id, direction } = reorderBodySchema.parse(await req.json())

    await client.query('BEGIN')
    // Même tri que le site public ; on permute uniquement entre toiles de
    // la même catégorie pour que l'ordre admin = ordre public par galerie.
    let rows: Row[]
    try {
      ;({ rows } = await client.query(
        'SELECT id, "order", category FROM paintings ORDER BY featured DESC, "order" ASC FOR UPDATE'
      ))
    } catch (err) {
      // Colonne category pas encore créée : tout est dans le même groupe.
      if ((err as { code?: string })?.code !== '42703') throw err
      ;({ rows } = await client.query(
        'SELECT id, "order" FROM paintings ORDER BY featured DESC, "order" ASC FOR UPDATE'
      ))
    }

    const target = rows.find((r) => r.id === id)
    if (!target) {
      await client.query('ROLLBACK')
      return notFound('Tableau introuvable')
    }

    // Voisines dans la même catégorie uniquement.
    const siblings = rows.filter(
      (r) => (r.category || 'peintures') === (target.category || 'peintures')
    )
    const index = siblings.findIndex((r) => r.id === id)

    let swapIndex = -1
    if (direction === 'up' && index > 0) {
      swapIndex = index - 1
    } else if (direction === 'down' && index < siblings.length - 1) {
      swapIndex = index + 1
    }

    if (swapIndex !== -1) {
      const orderA = siblings[index].order
      const orderB = siblings[swapIndex].order
      await client.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderB, siblings[index].id])
      await client.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderA, siblings[swapIndex].id])
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return handleRouteError(err)
  } finally {
    client.release()
  }
}
