'use client'

import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import { testCloudinaryConnection } from '@/lib/cloudinary'
import bcrypt from 'bcryptjs'

function AccordionSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border border-[var(--border)] rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 sm:px-6 bg-white hover:bg-[var(--cream)] transition-colors min-h-[52px]"
      >
        <h3 className="font-body text-base sm:text-lg font-medium text-charcoal text-left">{title}</h3>
        <span className={`text-warm-gray text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-4 pb-5 sm:px-6 sm:pb-6 space-y-5 border-t border-[var(--border)] pt-5">{children}</div>}
    </section>
  )
}

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
    <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
      {message && (
        <div className="p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded">
          <p className="font-body text-sm sm:text-base text-[#2D6A4F] font-medium">{message}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#C0392B]/10 border border-[#C0392B]/30 rounded">
          <p className="font-body text-sm sm:text-base text-[#C0392B] font-medium">{error}</p>
        </div>
      )}

      {/* Profile section */}
      <AccordionSection title="👤 Profil & Biographie" defaultOpen={true}>

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
      </AccordionSection>

      {/* Cloudinary section */}
      <AccordionSection title="☁️ Configuration Cloudinary">

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
      </AccordionSection>

      {/* Password section */}
      <AccordionSection title="🔐 Mot de passe admin">

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
          className="btn-secondary w-full sm:w-auto min-h-[52px] sm:min-h-[44px]"
        >
          Mettre à jour le mot de passe
        </button>
      </AccordionSection>

      {/* Save all */}
      <div className="pt-4 sm:pt-6">
        <button
          onClick={handleSaveSettings}
          className="btn-primary w-full sm:w-auto text-base sm:text-lg px-6 sm:px-10 min-h-[56px] sm:min-h-[52px]"
        >
          Enregistrer les paramètres
        </button>
      </div>
    </div>
  )
}
