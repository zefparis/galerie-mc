import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { id, direction } = await req.json()

  // Get all paintings ordered
  const { rows } = await pool.query('SELECT id, "order" FROM paintings ORDER BY "order" ASC')

  const index = rows.findIndex((r: { id: string }) => r.id === id)
  if (index === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let swapIndex = -1
  if (direction === 'up' && index > 0) {
    swapIndex = index - 1
  } else if (direction === 'down' && index < rows.length - 1) {
    swapIndex = index + 1
  }

  if (swapIndex === -1) {
    return NextResponse.json({ success: true })
  }

  // Swap order values
  const orderA = rows[index].order
  const orderB = rows[swapIndex].order

  await pool.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderB, rows[index].id])
  await pool.query('UPDATE paintings SET "order"=$1 WHERE id=$2', [orderA, rows[swapIndex].id])

  return NextResponse.json({ success: true })
}
