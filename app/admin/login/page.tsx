'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/ui/PasswordInput'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) router.replace('/admin')
      })
      .catch(() => {})
  }, [router])

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push('/admin')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur de connexion. Réessayez.')
      }
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-charcoal mb-2">Administration</h1>
          <p className="font-body text-sm text-warm-gray">Galerie Marie-Claire Scandella</p>
        </div>

        <div className="space-y-4">
          <div onKeyDown={(e) => e.key === 'Enter' && handleLogin()}>
            <label className="label-field">Mot de passe</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez votre mot de passe"
              className="input-field pr-12"
            />
          </div>

          {error && (
            <div className="p-3 bg-[#C0392B]/10 border border-[#C0392B]/30">
              <p className="font-body text-sm text-[#C0392B]">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="btn-primary w-full text-lg disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </div>
    </div>
  )
}
