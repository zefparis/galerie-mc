import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError, notFound } from '@/lib/api'
import { reorderBodySchema } from '@/lib/validation'

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const client = await pool.connect()
  try {
    const { id, direction } = reorderBodySchema.parse(await req.json())

    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT id, "order" FROM paintings ORDER BY "order" ASC FOR UPDATE'
    )

    const index = rows.findIndex((r: { id: string }) => r.id === id)
    if (index === -1) {
      await client.query('ROLLBACK')
      return notFound('Tableau introuvable')
    }

    let swapIndex = -1
    if (direction === 'up' && index > 0) {
      swapIndex = index - 1
    } else if (direction === 'down' && index < rows.length - 1) {
      swapIndex = index + 1
    }

    if (swapIndex !== -1) {
      const orderA = rows[index].order
      const orderB = rows[swapIndex].order
      await client.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderB, rows[index].id])
      await client.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderA, rows[swapIndex].id])
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
