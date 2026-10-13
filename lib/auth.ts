import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const SESSION_COOKIE = 'mc_admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

function secret(): string | null {
  return process.env.SESSION_SECRET || null
}

function sign(payload: string, key: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url')
}

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'admin', exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url')
  return `${payload}.${sign(payload, secret()!)}`
}

export function verifySessionToken(token?: string | null): boolean {
  const key = secret()
  if (!token || !key) return false

  const dot = token.lastIndexOf('.')
  if (dot === -1) return false
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  const expected = sign(payload, key)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.sub === 'admin' && typeof data.exp === 'number' && data.exp > Date.now()
  } catch {
    return false
  }
}

export function isAdminRequest(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  if (isAdminRequest(req)) return null
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
}
