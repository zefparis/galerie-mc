interface Props {
  paragraphs: string[]
}

// Texte de présentation de l'accueil : un saut de ligne = un paragraphe,
// texte brut échappé (React), largeur de lecture ~65 ch, serif lisible.
// Partagé entre la page d'accueil et l'aperçu admin « Présentation ».
export default function PresentationParagraphs({ paragraphs }: Props) {
  if (paragraphs.length === 0) return null
  return (
    <div className="mt-6 md:mt-8 max-w-[65ch] space-y-5">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className="font-display text-lg md:text-xl text-[var(--ink-soft)] leading-[1.85]"
        >
          {para}
        </p>
      ))}
    </div>
  )
}
