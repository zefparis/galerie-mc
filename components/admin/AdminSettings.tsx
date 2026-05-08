'use client'

import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import { testCloudinaryConnection } from '@/lib/cloudinary'
import bcrypt from 'bcryptjs'

export default function AdminSettings() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [cloudinaryTesting, setCloudinaryTesting] = useState(false)
  const [cloudinaryResult, setCloudinaryResult] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  if (!settings) return null

  const handleSaveSettings = () => {
    setError('')
    setMessage('')
    saveSettings(settings)
    setMessage('Paramètres enregistrés avec succès !')
    setTimeout(() => setMessage(''), 4000)
  }

  const handlePasswordChange = () => {
    setPasswordMessage('')
    if (!newPassword) {
      setPasswordMessage('Veuillez entrer un nouveau mot de passe.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordMessage('Le mot de passe doit faire au moins 6 caractères.')
      return
    }

    const hash = bcrypt.hashSync(newPassword, 10)
    const updatedSettings = { ...settings, adminPasswordHash: hash }
    setSettings(updatedSettings)
    saveSettings(updatedSettings)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('Mot de passe mis à jour avec succès !')
  }

  const handleTestCloudinary = async () => {
    setCloudinaryTesting(true)
    setCloudinaryResult('')
    
    const ok = await testCloudinaryConnection(
      settings.cloudinaryCloudName,
      settings.cloudinaryUploadPreset
    )
    
    setCloudinaryResult(ok ? 'success' : 'error')
    setCloudinaryTesting(false)
  }

  return (
    <div className="max-w-2xl space-y-10">
      {message && (
        <div className="p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30">
          <p className="font-body text-base text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#C0392B]/10 border border-[#C0392B]/30">
          <p className="font-body text-base text-[#C0392B] font-medium">{error}</p>
        </div>
      )}

      {/* Profile section */}
      <section className="space-y-6">
        <h3 className="font-body text-lg font-medium text-charcoal border-b border-[var(--border)] pb-3">
          Profil
        </h3>

        <div>
          <label className="label-field">👤 Nom affiché</label>
          <input
            type="text"
            value={settings.artistName}
            onChange={(e) => setSettings({ ...settings, artistName: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">📝 Courte accroche (sous le nom)</label>
          <input
            type="text"
            value={settings.bioShort}
            onChange={(e) => setSettings({ ...settings, bioShort: e.target.value })}
            className="input-field"
            placeholder="ex: Peintre | Alès, France"
          />
        </div>

        <div>
          <label className="label-field">📖 Biographie</label>
          <textarea
            value={settings.bio}
            onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
            className="input-field min-h-[150px] resize-y"
            rows={6}
          />
        </div>

        <div>
          <label className="label-field">📧 Email de contact</label>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-field">📱 Instagram (optionnel)</label>
          <input
            type="text"
            value={settings.instagram || ''}
            onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
            className="input-field"
            placeholder="@votre_compte"
          />
        </div>

        <div>
          <label className="label-field">📞 Téléphone (optionnel)</label>
          <input
            type="tel"
            value={settings.phone || ''}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            className="input-field"
            placeholder="06 12 34 56 78"
          />
        </div>
      </section>

      {/* Cloudinary section */}
      <section className="space-y-6">
        <h3 className="font-body text-lg font-medium text-charcoal border-b border-[var(--border)] pb-3">
          ☁️ Configuration Cloudinary
        </h3>

        <div>
          <label className="label-field">Cloud Name</label>
          <input
            type="text"
            value={settings.cloudinaryCloudName}
            onChange={(e) => setSettings({ ...settings, cloudinaryCloudName: e.target.value })}
            className="input-field"
            placeholder="votre-cloud-name"
          />
        </div>

        <div>
          <label className="label-field">Upload Preset</label>
          <input
            type="text"
            value={settings.cloudinaryUploadPreset}
            onChange={(e) => setSettings({ ...settings, cloudinaryUploadPreset: e.target.value })}
            className="input-field"
            placeholder="votre-upload-preset"
          />
        </div>

        <div>
          <button
            onClick={handleTestCloudinary}
            disabled={cloudinaryTesting || !settings.cloudinaryCloudName || !settings.cloudinaryUploadPreset}
            className="btn-secondary disabled:opacity-50"
          >
            {cloudinaryTesting ? 'Test en cours...' : 'Tester la connexion'}
          </button>
          {cloudinaryResult === 'success' && (
            <p className="mt-2 font-body text-sm text-[#2D6A4F] font-medium">
              ✅ Connexion réussie
            </p>
          )}
          {cloudinaryResult === 'error' && (
            <p className="mt-2 font-body text-sm text-[#C0392B] font-medium">
              ❌ Échec — vérifiez vos identifiants
            </p>
          )}
        </div>

        <div className="p-4 bg-[var(--cream)] border border-[var(--border)] rounded">
          <p className="font-body text-sm text-warm-gray">
            ℹ️ <strong>Note :</strong> L&apos;image reste sur Cloudinary — vous pouvez la supprimer manuellement depuis votre dashboard Cloudinary si nécessaire.
          </p>
        </div>
      </section>

      {/* Password section */}
      <section className="space-y-6">
        <h3 className="font-body text-lg font-medium text-charcoal border-b border-[var(--border)] pb-3">
          🔐 Changer le mot de passe admin
        </h3>

        <div>
          <label className="label-field">Nouveau mot de passe</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field"
            placeholder="Minimum 6 caractères"
          />
        </div>

        <div>
          <label className="label-field">Confirmer le mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            placeholder="Retapez le mot de passe"
          />
        </div>

        {passwordMessage && (
          <div className={`p-3 border ${passwordMessage.includes('succès') ? 'bg-[#2D6A4F]/10 border-[#2D6A4F]/30' : 'bg-[#C0392B]/10 border-[#C0392B]/30'}`}>
            <p className={`font-body text-sm font-medium ${passwordMessage.includes('succès') ? 'text-[#2D6A4F]' : 'text-[#C0392B]'}`}>
              {passwordMessage}
            </p>
          </div>
        )}

        <button
          onClick={handlePasswordChange}
          className="btn-secondary"
        >
          Mettre à jour le mot de passe
        </button>
      </section>

      {/* Save all */}
      <div className="pt-6 border-t border-[var(--border)]">
        <button
          onClick={handleSaveSettings}
          className="btn-primary text-lg px-10 py-4"
        >
          Enregistrer les paramètres
        </button>
      </div>
    </div>
  )
}
