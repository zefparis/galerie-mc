import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleRouteError } from '@/lib/api'
import { isRateLimited } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/client-ip'
import { adminPhotosQuerySchema } from '@/lib/validation'
import { listAdminPhotos } from '@/lib/cloudinary-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const ip = getClientIp(req)
  if (isRateLimited(`admin-photos:${ip}`, 40, 60_000)) {
    return NextResponse.json(
      { error: 'Trop de demandes rapprochées — patientez quelques secondes.' },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const parsed = adminPhotosQuerySchema.parse({
      cursor: searchParams.get('cursor') ?? '',
      folder: searchParams.get('folder') ?? '',
      q: searchParams.get('q') ?? searchParams.get('search') ?? '',
    })

    const result = await listAdminPhotos(parsed)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    if ((err as Error)?.message === 'CLOUDINARY_ERROR') {
      return NextResponse.json(
        {
          error:
            "Je n'arrive pas à joindre votre espace photos, réessayez dans un instant.",
        },
        { status: 502 }
      )
    }
    return handleRouteError(err)
  }
}
