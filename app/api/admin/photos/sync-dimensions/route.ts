import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { isRateLimited } from '@/lib/ratelimit'
import { syncPaintingImageDims } from '@/lib/image-dims'

export const dynamic = 'force-dynamic'

// Complète image_width/image_height des toiles depuis l'espace photo
// Cloudinary (lecture seule). Idempotent, jamais destructif : seules les
// toiles encore sans dimensions sont complétées.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'admin'
  if (isRateLimited(`admin-sync-dims:${ip}`, 6, 60_000)) {
    return NextResponse.json(
      { error: 'Trop de demandes rapprochées — patientez quelques secondes.' },
      { status: 429 }
    )
  }

  try {
    const result = await syncPaintingImageDims()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
