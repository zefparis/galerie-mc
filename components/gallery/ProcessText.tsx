import { displayParagraphs } from '@/lib/text'

interface Props {
  text: string
  locale: string
}

// Section « Ma démarche picturale » : un <p> par ligne saisie, texte à
// gauche sur ~62 ch en serif courant — tous les paragraphes en romain,
// même taille et même interligne.
export default function ProcessText({ text, locale }: Props) {
  const paragraphs = displayParagraphs(text, locale)
  if (paragraphs.length === 0) return null
  return (
    <div className="max-w-[62ch] mx-auto text-left space-y-[1.1em] font-display text-[1.1rem] md:text-[1.25rem] leading-[1.75] text-[var(--ink-soft)]">
      {paragraphs.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  )
}
