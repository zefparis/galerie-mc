'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PasswordInput from '@/components/ui/PasswordInput'
import AdminThemeToggle from '@/components/admin/AdminThemeToggle'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (window.location.search.includes('expired=1')) setExpired(true)
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
    <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg)]">
      <div className="fixed top-3 right-3 z-10">
        <AdminThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl text-[var(--ink)] mb-3">Bonjour Marie-Claire</h1>
          <p className="font-body text-base text-[var(--ink-soft)]">
            Entrez votre mot de passe pour gérer votre galerie.
          </p>
        </div>

        {expired && (
          <div className="mb-5 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
            <p className="font-body text-base text-[var(--ink)]">
              Pour votre sécurité, la connexion se ferme au bout de quelques jours.
              Reconnectez-vous — rien n&apos;a été perdu.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div onKeyDown={(e) => e.key === 'Enter' && handleLogin()}>
            <label className="label-field">Mot de passe</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
              className="input-field pr-12"
            />
          </div>

          {error && (
            <div className="p-4 bg-[var(--danger-bg)] border border-[var(--danger-line)]" role="alert">
              <p className="font-body text-base text-[var(--danger)]">
                {error === 'Mot de passe incorrect'
                  ? "Ce n'est pas le bon mot de passe. Réessayez."
                  : error}
              </p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="btn-primary w-full text-lg disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Me connecter'}
          </button>

          <p className="font-body text-sm text-[var(--muted)] text-center pt-2">
            Mot de passe oublié ? Contactez la personne qui s&apos;occupe du site.
          </p>
        </div>
      </div>
    </div>
  )
}
