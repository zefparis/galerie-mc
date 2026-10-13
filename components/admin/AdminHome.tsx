'use client'

import TranslateAllButton from './TranslateAllButton'

interface Props {
  paintingsCount: number
  eventsCount: number
  onNavigate: (view: 'painting-new' | 'paintings' | 'events' | 'settings') => void
}

// Accueil de l'admin : 4 grosses cartes, une action principale par carte.
export default function AdminHome({ paintingsCount, eventsCount, onNavigate }: Props) {
  const cards = [
    {
      view: 'painting-new' as const,
      title: 'Ajouter une toile',
      desc: 'Je vous guide pas à pas : photo, titre, prix.',
      icon: '＋',
      primary: true,
    },
    {
      view: 'paintings' as const,
      title: 'Mes toiles',
      desc: paintingsCount > 0 ? `${paintingsCount} toile${paintingsCount > 1 ? 's' : ''} en ligne` : 'Modifier, réordonner, supprimer.',
      icon: '🖼',
      primary: false,
    },
    {
      view: 'events' as const,
      title: 'Mes événements',
      desc: eventsCount > 0 ? `${eventsCount} événement${eventsCount > 1 ? 's' : ''}` : 'Expositions, vernissages, photos.',
      icon: '📅',
      primary: false,
    },
    {
      view: 'settings' as const,
      title: 'Ma présentation',
      desc: 'Votre nom, votre présentation, vos photos et coordonnées.',
      icon: '✎',
      primary: false,
    },
  ]

  return (
    <div>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-accent w-full text-base mb-8"
      >
        👁 Voir mon site tel que le voient les visiteurs
      </a>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <button
            key={card.view}
            onClick={() => onNavigate(card.view)}
            className={`text-left p-6 sm:p-7 border transition-colors duration-200 min-h-[120px] ${
              card.primary
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--ink-soft)]'
            }`}
          >
            <span className="block text-3xl mb-3" aria-hidden="true">{card.icon}</span>
            <span className="block font-body text-xl font-medium text-[var(--ink)]">
              {card.title}
            </span>
            <span className="block font-body text-base text-[var(--ink-soft)] mt-1">
              {card.desc}
            </span>
          </button>
        ))}
      </div>

      <TranslateAllButton />
    </div>
  )
}
