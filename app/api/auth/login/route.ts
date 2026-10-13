import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth'
import { isRateLimited } from '@/lib/ratelimit'
import { loginBodySchema } from '@/lib/validation'
import { handleRouteError } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'local'
    if (isRateLimited(`login:${ip}`, 5, 60_000)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      )
    }

    const { password } = loginBodySchema.parse(await req.json())

    const hash = process.env.ADMIN_PASSWORD_HASH
    if (!hash || !process.env.SESSION_SECRET) {
      console.error('[auth] ADMIN_PASSWORD_HASH ou SESSION_SECRET manquant')
      return NextResponse.json(
        { error: 'Authentification non configurée côté serveur' },
        { status: 500 }
      )
    }

    const ok = await bcrypt.compare(password, hash)
    if (!ok) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect.' },
        { status: 401 }
      )
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    return res
  } catch (err) {
    return handleRouteError(err)
  }
}
