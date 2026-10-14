import { brandMark } from '@/lib/brand-image'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

// Icône « Mon atelier » : même S, inversé (cuivre plein, lettre sombre)
// pour distinguer l'atelier de l'application visiteurs.
export default function Icon() {
  return brandMark(192, { inverted: true })
}
