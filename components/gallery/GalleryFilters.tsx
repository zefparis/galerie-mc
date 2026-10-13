interface FilterOption {
  value: string
  label: string
}

interface Props {
  label: string
  options: FilterOption[]
  current: string
  onChange: (value: string) => void
}

// Liens textuels épurés, soulignement animé, défilement horizontal sur
// mobile — barre masquée, fondu sur les bords, clavier possible (focusable).
export default function GalleryFilters({ label, options, current, onChange }: Props) {
  return (
    <nav
      aria-label={label}
      tabIndex={0}
      className="-mx-1 overflow-x-auto scrollbar-hide scroll-fade-x"
    >
      <ul className="flex items-center gap-6 md:gap-8">
        {options.map((o) => (
          <li key={o.value} className="shrink-0">
            <button
              type="button"
              className={`filter-link ${current === o.value ? 'is-active' : ''}`}
              aria-pressed={current === o.value}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
