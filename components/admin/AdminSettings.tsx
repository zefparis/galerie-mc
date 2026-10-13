'use client'

import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '@/lib/storage'
import { GallerySettings } from '@/lib/types'
import { testCloudinaryConnection } from '@/lib/cloudinary'
import HelpTip from './HelpTip'

export default function AdminSettings() {
  const [settings, setSettings] = useState<GallerySettings | null>(null)
  const [message, setMessage] = useState('')
  const [cloudinaryTesting, setCloudinaryTesting] = useState(false)
  const [cloudinaryResult, setCloudinaryResult] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  const isEnvConfigured = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  if (!settings) return null

  const handleSaveSettings = () => {
    saveSettings(settings)
    setMessage('Votre présentation est enregistrée ✓')
    setTimeout(() => setMessage(''), 5000)
  }

  const handleTestCloudinary = async () => {
    setCloudinaryTesting(true)
    setCloudinaryResult('')
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || settings.cloudinaryCloudName
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || settings.cloudinaryUploadPreset
    const ok = await testCloudinaryConnection(cloudName, uploadPreset)
    setCloudinaryResult(ok ? 'success' : 'error')
    setCloudinaryTesting(false)
  }

  return (
    <div className="w-full max-w-2xl">
      <p className="font-body text-base text-[var(--ink-soft)] mb-8">
        Ce que les visiteurs lisent à votre sujet sur la page d&apos;accueil et le
        pied de page. Remplissez ce que vous voulez — tout est facultatif sauf
        votre nom.
      </p>

      {message && (
        <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
          <p className="font-body text-base text-[var(--ink)] font-medium">{message}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label htmlFor="st-name" className="label-field">
            Votre nom, tel qu&apos;il s&apos;affiche *
          </label>
          <input
            id="st-name"
            type="text"
            value={settings.artistName}
            onChange={(e) => setSettings({ ...settings, artistName: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="st-bio-short" className="label-field">
            Petite phrase d&apos;accroche <span className="label-optional">— facultatif</span>
            <HelpTip text="Une ligne affichée juste sous votre nom sur la page d'accueil, par exemple « Artiste peintre à Montreuil-aux-Lions »." />
          </label>
          <input
            id="st-bio-short"
            type="text"
            value={settings.bioShort}
            onChange={(e) => setSettings({ ...settings, bioShort: e.target.value })}
            className="input-field"
            placeholder="ex : Artiste peintre à Montreuil-aux-Lions"
          />
        </div>

        <div>
          <label htmlFor="st-bio" className="label-field">
            Votre biographie <span className="label-optional">— facultatif</span>
            <HelpTip text="Quelques phrases sur vous et votre peinture. C'est le texte « Qui suis-je » de votre site." />
          </label>
          <textarea
            id="st-bio"
            value={settings.bio}
            onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
            className="input-field min-h-[160px] resize-y"
            rows={6}
          />
        </div>

        <div>
          <label htmlFor="st-email" className="label-field">
            Votre adresse email <span className="label-optional">— facultatif</span>
            <HelpTip text="Affichée sur la page Contact — c'est aussi l'adresse qui reçoit les messages des visiteurs." />
          </label>
          <input
            id="st-email"
            type="email"
            value={settings.email}
            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            className="input-field"
            inputMode="email"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="st-insta" className="label-field">
              Instagram <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="st-insta"
              type="text"
              value={settings.instagram || ''}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              className="input-field"
              placeholder="@votre_compte"
            />
          </div>
          <div>
            <label htmlFor="st-phone" className="label-field">
              Téléphone <span className="label-optional">— facultatif</span>
            </label>
            <input
              id="st-phone"
              type="tel"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="input-field"
              placeholder="06 12 34 56 78"
              inputMode="tel"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <button
          onClick={handleSaveSettings}
          className="btn-primary w-full text-lg"
        >
          ✓ Enregistrer ma présentation
        </button>
      </div>

      {/* ── Sections techniques, repliées en bas ── */}
      <details className="mt-10 border border-[var(--line)] bg-[var(--surface)]">
        <summary className="px-4 py-4 font-body text-sm text-[var(--ink-soft)] cursor-pointer min-h-[52px] flex items-center">
          ⚙️ Réglages techniques (vous n&apos;aurez normalement jamais besoin de cette partie)
        </summary>
        <div className="px-4 pb-5 space-y-5 border-t border-[var(--line)] pt-5">
          {isEnvConfigured ? (
            <p className="font-body text-sm text-[#2D6A4F]">
              ✅ L&apos;envoi de photos est bien configuré — rien à faire.
            </p>
          ) : (
            <>
              <div>
                <label className="label-field">Cloud Name (Cloudinary)</label>
                <input
                  type="text"
                  value={settings.cloudinaryCloudName}
                  onChange={(e) => setSettings({ ...settings, cloudinaryCloudName: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">Upload Preset (Cloudinary)</label>
                <input
                  type="text"
                  value={settings.cloudinaryUploadPreset}
                  onChange={(e) => setSettings({ ...settings, cloudinaryUploadPreset: e.target.value })}
                  className="input-field"
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
                  <p className="mt-2 font-body text-sm text-[#2D6A4F] font-medium">✅ Connexion réussie</p>
                )}
                {cloudinaryResult === 'error' && (
                  <p className="mt-2 font-body text-sm text-[#B3402F] font-medium">❌ Échec — vérifiez les identifiants</p>
                )}
              </div>
            </>
          )}
          <p className="font-body text-sm text-[var(--muted)]">
            ℹ️ Pour changer le mot de passe de connexion, contactez la personne
            qui s&apos;occupe du site.
          </p>
        </div>
      </details>
    </div>
  )
}
