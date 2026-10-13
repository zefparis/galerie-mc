import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import AdminClient from '@/components/admin/AdminClient'

export const dynamic = 'force-dynamic'

export default function AdminPage() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!verifySessionToken(token)) {
    redirect('/admin/login')
  }
  return <AdminClient />
}
