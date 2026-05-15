import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientWrapper } from '@/components/prototype/client-wrapper'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <ClientWrapper initialUser={user.email!} />
}
