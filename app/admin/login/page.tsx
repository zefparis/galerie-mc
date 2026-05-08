'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSettings } from '@/lib/storage'
import bcrypt from 'bcryptjs'

const DEFAULT_PASSWORD = 'mc-galerie-2024'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isFirstAccess, setIsFirstAccess] = useState(false)

  useEffect(() => {
    const session = sessionStorage.getItem('mc-admin-auth')
    if (session === 'true') {
      router.replace('/admin')
    }

    const settings = getSettings()
    if (!settings.adminPasswordHash || settings.adminPasswordHash === '$2a$10$xJ8Kq3Q5Z5Z5Z5Z5Z5Z5ZuKq3Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z') {
      setIsFirstAccess(true)
    }
  }, [router])

  const handleLogin = async () => {
    setError('')
    const settings = getSettings()

    let isValid = false

    if (isFirstAccess || !settings.adminPasswordHash || settings.adminPasswordHash === '$2a$10$xJ8Kq3Q5Z5Z5Z5Z5Z5Z5ZuKq3Q5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z') {
      isValid = password === DEFAULT_PASSWORD
    } else {
      isValid = bcrypt.compareSync(password, settings.adminPasswordHash)
    }

    if (isValid) {
      sessionStorage.setItem('mc-admin-auth', 'true')
      router.push('/admin')
    } else {
      setError('Mot de passe incorrect.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-charcoal mb-2">Administration</h1>
          <p className="font-body text-sm text-warm-gray">Galerie Marie-Claire Scandella</p>
        </div>

        {isFirstAccess && (
          <div className="mb-6 p-4 bg-[#F0F7F4] border border-[#2D6A4F]/20 rounded">
            <p className="font-body text-sm text-[#2D6A4F]">
              <strong>Premier accès</strong> — Le mot de passe par défaut est :<br />
              <code className="bg-white px-2 py-1 mt-1 inline-block font-mono text-base">{DEFAULT_PASSWORD}</code>
            </p>
            <p className="font-body text-xs text-warm-gray mt-2">
              Pensez à le changer dans les paramètres après connexion.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label-field">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="input-field"
              placeholder="Entrez votre mot de passe"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-[#C0392B]/10 border border-[#C0392B]/30">
              <p className="font-body text-sm text-[#C0392B]">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="btn-primary w-full text-lg"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  )
}
