'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

export default function PasswordInput({ value, onChange, placeholder, className }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className || 'input-field pr-12'}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-warm-gray hover:text-charcoal transition-colors cursor-pointer"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>
    </div>
  )
}
