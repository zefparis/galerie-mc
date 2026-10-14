import { brandMark } from '@/lib/brand-image'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// Version maskable de l'icône atelier.
export default function Icon() {
  return brandMark(512, { inverted: true, maskable: true })
}
