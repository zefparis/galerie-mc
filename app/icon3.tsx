import { brandMark } from '@/lib/brand-image'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// Version maskable : fond plein bord à bord, « S » dans la zone sûre.
export default function Icon() {
  return brandMark(512, { maskable: true })
}
