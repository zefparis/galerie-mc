// Helpers d'URL Cloudinary pour les images stockées sous la forme
// https://res.cloudinary.com/<cloud>/image/upload/[transforms/]<publicId>

const TRANSFORM_PREFIX = /^(w|h|c|q|f|e|g|ar|dpr|fl|bo|b|r|o|a|t)_/

function parts(url: string): { base: string; publicId: string } | null {
  const idx = url.indexOf('/upload/')
  if (!url.includes('res.cloudinary.com') || idx === -1) return null
  const base = url.slice(0, idx)
  const rest = url.slice(idx + '/upload/'.length)
  // Si le premier segment est une transformation (contient "," ou commence
  // par un paramètre Cloudinary comme w_, f_, c_, q_), on le retire pour
  // récupérer le publicId (avec sa version éventuelle).
  const firstSlash = rest.indexOf('/')
  if (firstSlash === -1) return { base, publicId: rest }
  const first = rest.slice(0, firstSlash)
  const publicId =
    first.includes(',') || TRANSFORM_PREFIX.test(first)
      ? rest.slice(firstSlash + 1)
      : rest
  return { base, publicId }
}

export function cloudinaryUrl(url: string, transform: string): string {
  const p = parts(url)
  if (!p) return url
  return `${p.base}/upload/${transform}/${p.publicId}`
}

// Vignette floue utilisée comme blurDataURL de next/image.
export function blurDataUrl(url?: string): string | undefined {
  if (!url) return undefined
  const p = parts(url)
  if (!p) return undefined
  return `${p.base}/upload/w_32,e_blur:2000,q_auto,f_auto/${p.publicId}`
}

// URL optimisée à largeur fixe (srcset manuel si besoin).
export function sizedUrl(url: string, width: number): string {
  return cloudinaryUrl(url, `f_auto,q_auto,w_${width},c_limit`)
}
