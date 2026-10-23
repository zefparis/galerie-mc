// Normalisation du lien Instagram saisi par l'artiste.
// Identifiant : lettres, chiffres, points et underscores, 30 caractères max
// (règles officielles des noms de compte Instagram).
const HANDLE = /^[A-Za-z0-9._]{1,30}$/
const URL_RE =
  /^https:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/i

/** Normalise une saisie Instagram en URL canonique
 *  `https://www.instagram.com/<identifiant>/`.
 *  Formes acceptées : « @id », « id », « instagram.com/id »,
 *  « www.instagram.com/id » et l'URL https complète. Tout autre domaine et
 *  tout schéma non https (javascript:, data:, http:) renvoient null. */
export function normalizeInstagramUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.trim()
  if (!s) return null
  const m =
    URL_RE.exec(s) ??
    (/^(?:www\.)?instagram\.com\//i.test(s)
      ? URL_RE.exec(`https://${s}`)
      : null)
  const handle = m ? m[1] : s.replace(/^@/, '')
  if (!HANDLE.test(handle)) return null
  return `https://www.instagram.com/${handle}/`
}

/** Affichage admin : l'URL canonique est repliée en « @id » pour rester
 *  familière ; toute autre saisie brute est ressortie telle quelle. */
export function instagramInputValue(url: string | null | undefined): string {
  if (!url) return ''
  const m = /^https:\/\/www\.instagram\.com\/([A-Za-z0-9._]{1,30})\/$/.exec(url)
  return m ? `@${m[1]}` : url
}
