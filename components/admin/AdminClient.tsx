'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHome from '@/components/admin/AdminHome'
import AdminThemeToggle from '@/components/admin/AdminThemeToggle'
import PaintingList from '@/components/admin/PaintingList'
import PaintingWizard from '@/components/admin/PaintingWizard'
import EventList from '@/components/admin/EventList'
import EventForm from '@/components/admin/EventForm'
import AdminSettings from '@/components/admin/AdminSettings'
import { getPaintings } from '@/lib/storage'
import { Painting, GalleryEvent } from '@/lib/types'

type View = 'home' | 'painting-new' | 'paintings' | 'events' | 'settings'

const VIEW_TITLES: Record<View, string> = {
  home: 'Bonjour 👋',
  'painting-new': 'Ajouter une toile',
  paintings: 'Mes toiles',
  events: 'Mes événements',
  settings: 'Ma présentation',
}

export default function AdminClient() {
  const router = useRouter()
  const [view, setView] = useState<View>('home')
  const [editingPainting, setEditingPainting] = useState<Painting | null>(null)
  const [editingEvent, setEditingEvent] = useState<GalleryEvent | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [flash, setFlash] = useState('')
  const [paintingsCount, setPaintingsCount] = useState(0)
  const [eventsCount, setEventsCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getPaintings().then((p) => setPaintingsCount(p.length)).catch(() => {})
    fetch('/api/events?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((e: GalleryEvent[]) => setEventsCount(e.length))
      .catch(() => {})
  }, [refreshKey])

  const goHome = (message?: string) => {
    setView('home')
    setWizardOpen(false)
    setEventFormOpen(false)
    setEditingPainting(null)
    setEditingEvent(null)
    setRefreshKey((k) => k + 1)
    if (message) {
      setFlash(message)
      setTimeout(() => setFlash(''), 6000)
    }
  }

  const backToList = (message?: string) => {
    setWizardOpen(false)
    setEventFormOpen(false)
    setEditingPainting(null)
    setEditingEvent(null)
    setRefreshKey((k) => k + 1)
    if (message) {
      setFlash(message)
      setTimeout(() => setFlash(''), 6000)
    }
  }

  const openNewPainting = () => {
    setEditingPainting(null)
    setWizardOpen(true)
    setView('paintings')
  }

  const openEditPainting = (p: Painting) => {
    setEditingPainting(p)
    setWizardOpen(true)
  }

  const openNewEvent = () => {
    setEditingEvent(null)
    setEventFormOpen(true)
  }

  const openEditEvent = (e: GalleryEvent) => {
    setEditingEvent(e)
    setEventFormOpen(true)
  }

  const handleNavigate = (v: 'painting-new' | 'paintings' | 'events' | 'settings') => {
    if (v === 'painting-new') {
      setEditingPainting(null)
      setWizardOpen(true)
      setView('paintings')
    } else {
      setView(v)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  const inForm = wizardOpen || eventFormOpen
  const title = wizardOpen
    ? editingPainting ? `Modifier « ${editingPainting.title} »` : 'Ajouter une toile'
    : eventFormOpen
      ? editingEvent ? `Modifier « ${editingEvent.title} »` : 'Ajouter un événement'
      : VIEW_TITLES[view]

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Barre du haut */}
      <div className="sticky top-0 z-30 bg-[var(--bg)] border-b border-[var(--line)] px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {view !== 'home' && !inForm && (
            <button
              onClick={() => goHome()}
              className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] min-h-[48px] px-2 flex-shrink-0"
            >
              ← Accueil
            </button>
          )}
          <h1 className="font-body text-lg font-medium text-[var(--ink)] truncate">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AdminThemeToggle />
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors min-h-[48px] px-2 hidden sm:inline-flex items-center"
          >
            👁 Voir mon site
          </a>
          <button
            onClick={handleLogout}
            className="font-body text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors min-h-[48px] px-2"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {flash && (
          <div className="mb-6 p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/30" role="status">
            <p className="font-body text-base text-[var(--ink)] font-medium">{flash}</p>
          </div>
        )}

        {view === 'home' && (
          <AdminHome
            paintingsCount={paintingsCount}
            eventsCount={eventsCount}
            onNavigate={handleNavigate}
          />
        )}

        {view === 'paintings' && !wizardOpen && (
          <PaintingList
            key={refreshKey}
            onAdd={openNewPainting}
            onEdit={openEditPainting}
          />
        )}
        {view === 'paintings' && wizardOpen && (
          <PaintingWizard
            painting={editingPainting}
            onDone={(msg: string) => backToList(msg)}
            onCancel={() => backToList()}
          />
        )}

        {view === 'events' && !eventFormOpen && (
          <EventList
            key={refreshKey}
            onAdd={openNewEvent}
            onEdit={openEditEvent}
          />
        )}
        {view === 'events' && eventFormOpen && (
          <EventForm
            event={editingEvent}
            onDone={(msg: string) => backToList(msg)}
            onCancel={() => backToList()}
          />
        )}

        {view === 'settings' && <AdminSettings />}
      </div>
    </div>
  )
}
