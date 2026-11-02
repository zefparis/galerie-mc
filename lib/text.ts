// Rendu des textes longs saisis par l'artiste (présentation, démarche
// picturale) : découpage en paragraphes et typographie française au rendu.
// Pur texte — jamais de HTML, aucun mot du texte saisi n'est modifié.

/** Espace fine insécable — la juste espace devant les ponctuations hautes. */
export const NARROW_NBSP = '\u202F'

/**
 * Un paragraphe par ligne non vide : fins de ligne normalisées (\r\n → \n),
 * chaque ligne rognée, espaces multiples réduits, lignes vides ignorées.
 */
export function toParagraphs(text: string | null | undefined): string[] {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// Blancs horizontaux uniquement (jamais les fins de ligne) : la fonction
// reste sûre si on lui passe un texte multi-paragraphes.
const HSP = '[ \\t\\u00A0\\u202F]'

/**
 * Typographie française au rendu — la base n'est jamais réécrite :
 * l'espace qui précède « ; : ! ? » ou qui suit « « », et celle qui précède
 * un tiret « - » isolé (ponctuation), devient une espace fine insécable
 * U+202F — un « ; » ou un « ? » ne passe jamais seul en début de ligne.
 * Sans espace saisie, rien n'est inséré : le texte de l'artiste n'est pas
 * corrigé.
 */
export function frenchTypography(text: string): string {
  return text
    .replace(new RegExp(`${HSP}+([;:!?»])`, 'g'), `${NARROW_NBSP}$1`)
    .replace(new RegExp(`«${HSP}+`, 'g'), `«${NARROW_NBSP}`)
    .replace(new RegExp(`${HSP}+-(?=${HSP}|$)`, 'g'), `${NARROW_NBSP}-`)
}

/**
 * Paragraphes prêts à afficher : le découpage s'applique dans les 4
 * langues ; l'espace fine insécable est une règle du français — absente
 * en en/es/de.
 */
export function displayParagraphs(
  text: string | null | undefined,
  locale: string
): string[] {
  const paragraphs = toParagraphs(text)
  return locale === 'fr' ? paragraphs.map(frenchTypography) : paragraphs
}
