'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInstallState } from '@/components/pwa/useInstallState'
import { ShareGlyph } from '@/components/pwa/InstallHelpDialog'

function Step({
  n,
  icon,
  children,
}: {
  n: number
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center font-body font-semibold">
        {n}
      </span>
      <div className="min-w-0 font-body text-base text-[var(--ink)] leading-snug">
        {children}
      </div>
      <span className="ml-auto flex-shrink-0 text-[var(--accent)]">{icon}</span>
    </li>
  )
}

// Guide d’installation plein écran de « Mon atelier » — français très
// simple, détecte le téléphone, envoyable par WhatsApp.
export default function InstallGuide() {
  const st = useInstallState()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
    } catch {
      /* presse-papiers refusé */
    }
  }

  const install = async () => {
    if (!st.deferred) return
    await st.deferred.prompt()
    await st.deferred.userChoice
  }

  const iosSteps = (
    <ol className="space-y-3">
      <Step n={1} icon={<ShareGlyph className="w-5 h-5" />}>
        Appuyez sur <strong>Partager</strong>{' '}
        <ShareGlyph className="inline w-4 h-4 align-[-3px]" /> (en bas de
        l’écran)
      </Step>
      <Step n={2} icon={<span className="text-xl">＋</span>}>
        Faites défiler et appuyez sur{' '}
        <strong>« Sur l’écran d’accueil »</strong>
      </Step>
      <Step n={3} icon={<span className="text-xl">✓</span>}>
        Appuyez sur <strong>Ajouter</strong> en haut à droite
      </Step>
    </ol>
  )

  const androidSteps = (
    <ol className="space-y-3">
      <Step n={1} icon={<span className="text-xl">⋮</span>}>
        Appuyez sur le menu <strong>⋮</strong> en haut à droite
      </Step>
      <Step n={2} icon={<span className="text-xl">📲</span>}>
        Appuyez sur <strong>« Installer l’application »</strong> (ou « Ajouter
        à l’écran d’accueil »)
      </Step>
      <Step n={3} icon={<span className="text-xl">✓</span>}>
        Confirmez <strong>Installer</strong>
      </Step>
    </ol>
  )

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center gutter-x py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-4">
          {/* Pastille reprenant l’icône de l’app atelier (cuivre, S sombre) */}
          <span className="w-14 h-14 rounded-2xl bg-[#C98A5B] flex items-center justify-center flex-shrink-0">
            <span className="font-brand text-3xl text-[#1A1612]">S</span>
          </span>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-[var(--ink)]">
              Mon atelier
            </h1>
            <p className="font-body text-sm text-[var(--muted)]">
              Votre galerie dans la poche
            </p>
          </div>
        </div>

        <p className="mt-8 font-body text-base text-[var(--ink)] leading-relaxed">
          Installez l’atelier sur votre téléphone : vos toiles, vos photos et
          vos expositions à portée de main, comme une vraie application.
        </p>

        {!st.ready ? (
          <p className="mt-8 font-body text-sm text-[var(--muted)]">…</p>
        ) : st.standalone ? (
          <div className="mt-8 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-5 text-center">
            <p className="font-body text-lg text-[var(--ink)]">
              🎉 C’est fait, l’atelier est déjà installé !
            </p>
            <Link href="/admin" className="btn-accent !min-h-[48px] mt-4 inline-flex">
              Ouvrir l’atelier
            </Link>
          </div>
        ) : st.inApp ? (
          <div className="mt-8">
            <p className="font-body text-base text-[var(--ink)] leading-relaxed">
              📱 Vous êtes dans l’application d’un réseau social. Pour
              installer,{' '}
              <strong>
                ouvrez cette page dans {st.ios ? 'Safari' : 'Chrome'}
              </strong>
              .
            </p>
            <button onClick={copy} className="btn-accent w-full !min-h-[52px] mt-5">
              {copied ? 'Lien copié !' : 'Copier le lien'}
            </button>
            <p className="mt-4 font-body text-sm text-[var(--muted)]">
              Collez-le dans {st.ios ? 'Safari' : 'Chrome'}, puis suivez les
              étapes ci-dessous.
            </p>
            <div className="mt-8">{st.ios ? iosSteps : androidSteps}</div>
          </div>
        ) : (
          <div className="mt-8">
            {st.deferred && (
              <button onClick={install} className="btn-accent w-full !min-h-[52px] mb-6 text-base">
                Installer l’application
              </button>
            )}
            {st.ios ? iosSteps : st.android ? androidSteps : (
              <div className="space-y-6">
                <p className="font-body text-base text-[var(--ink)]">
                  Ouvrez cette page sur votre téléphone, puis suivez les
                  étapes :
                </p>
                <button onClick={copy} className="btn-outline w-full !min-h-[52px]">
                  {copied ? 'Lien copié !' : 'Copier le lien'}
                </button>
                <div>
                  <p className="eyebrow mb-3">Sur iPhone</p>
                  {iosSteps}
                </div>
                <div>
                  <p className="eyebrow mb-3">Sur Android</p>
                  {androidSteps}
                </div>
              </div>
            )}
          </div>
        )}

        <Link
          href="/admin"
          className="mt-10 inline-block font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] min-h-[44px]"
        >
          ← Retour à l’atelier
        </Link>
      </div>
    </div>
  )
}
