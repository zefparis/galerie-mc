import { displayParagraphs } from '@/lib/text'

interface Props {
  text: string
  locale: string
}

// Section « Ma démarche picturale » : un <p> par ligne saisie, texte à
// gauche sur ~62 ch en serif courant. Le premier paragraphe fait office
// de phrase d'ouverture — italique et un peu plus grand — uniquement
// quand le texte compte plusieurs paragraphes.
export default function ProcessText({ text, locale }: Props) {
  const paragraphs = displayParagraphs(text, locale)
  if (paragraphs.length === 0) return null
  const lead = paragraphs.length > 1
  return (
    <div className="max-w-[62ch] mx-auto text-left space-y-[1.1em] font-display text-[1.1rem] md:text-[1.25rem] leading-[1.75] text-[var(--ink-soft)]">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className={lead && i === 0 ? 'italic text-[1.25rem] md:text-[1.4rem]' : undefined}
        >
          {para}
        </p>
      ))}
    </div>
  )
}
