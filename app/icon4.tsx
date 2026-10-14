import { brandMark } from '@/lib/brand-image'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

// Version maskable 192 px (écran d'accueil Android).
export default function Icon() {
  return brandMark(192, { maskable: true })
}
