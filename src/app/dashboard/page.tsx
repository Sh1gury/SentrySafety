import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <form action={logout}>
            <Button variant="outline" type="submit">Sign out</Button>
          </form>
        </div>
        <p className="text-muted-foreground">Welcome, {user.email}</p>
        {/* Add your hackathon features here */}
      </div>
    </div>
  )
}
