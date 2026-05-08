'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PaintingList from '@/components/admin/PaintingList'
import PaintingForm from '@/components/admin/PaintingForm'
import AdminSettings from '@/components/admin/AdminSettings'
import { isDemo } from '@/lib/storage'
import { Painting } from '@/lib/types'

type Tab = 'paintings' | 'settings'

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('paintings')
  const [editingPainting, setEditingPainting] = useState<Painting | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const session = sessionStorage.getItem('mc-admin-auth')
    if (session !== 'true') {
      router.replace('/admin/login')
      return
    }
    isDemo().then(setShowDemo)
  }, [router])

  const handleEdit = (painting: Painting) => {
    setEditingPainting(painting)
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditingPainting(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPainting(null)
    setRefreshKey((k) => k + 1)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('mc-admin-auth')
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Admin header */}
      <div className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <h1 className="font-body text-base sm:text-lg font-medium text-charcoal">
          Administration
        </h1>
        <button
          onClick={handleLogout}
          className="font-body text-sm text-warm-gray hover:text-charcoal transition-colors min-h-[44px] px-2"
        >
          Déconnexion
        </button>
      </div>

      {/* Demo banner */}
      {showDemo && (
        <div className="bg-[#FFF8E1] border-b border-[#FFE082] px-4 sm:px-6 py-3">
          <p className="font-body text-xs sm:text-sm text-[#F57F17]">
            💡 Ces données sont des exemples. Remplacez-les par vos vraies œuvres.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border)] px-4 sm:px-6">
        <div className="flex">
          <button
            onClick={() => { setActiveTab('paintings'); setShowForm(false) }}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-body text-sm sm:text-base border-b-2 transition-colors min-h-[48px] ${
              activeTab === 'paintings'
                ? 'border-[#2D6A4F] text-charcoal font-medium'
                : 'border-transparent text-warm-gray hover:text-charcoal'
            }`}
          >
            Mes tableaux
          </button>
          <button
            onClick={() => { setActiveTab('settings'); setShowForm(false) }}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-body text-sm sm:text-base border-b-2 transition-colors min-h-[48px] ${
              activeTab === 'settings'
                ? 'border-[#2D6A4F] text-charcoal font-medium'
                : 'border-transparent text-warm-gray hover:text-charcoal'
            }`}
          >
            Paramètres
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {activeTab === 'paintings' && !showForm && (
          <div>
            <button
              onClick={handleAdd}
              className="btn-primary w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 min-h-[56px] sm:min-h-[52px] mb-6 sm:mb-8"
            >
              + Ajouter un nouveau tableau
            </button>
            <PaintingList
              key={refreshKey}
              onEdit={handleEdit}
            />
          </div>
        )}

        {activeTab === 'paintings' && showForm && (
          <PaintingForm
            painting={editingPainting}
            onClose={handleFormClose}
          />
        )}

        {activeTab === 'settings' && (
          <AdminSettings />
        )}
      </div>
    </div>
  )
}
