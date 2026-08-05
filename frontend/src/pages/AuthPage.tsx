import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { Button, Card, Input, Tabs } from '@/components/ui'
import { login, signup } from '@/lib/api'
import { useFinanceStore } from '@/store/financeStore'

export function AuthPage() {
  const navigate = useNavigate()
  const hydrateFromApi = useFinanceStore((s) => s.hydrateFromApi)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await signup(email, password)
      await hydrateFromApi()
      const complete = useFinanceStore.getState().profile.onboardingComplete
      navigate(complete ? '/' : '/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-brand-100)_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15)_0%,_transparent_55%)]" />
      <Card className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">
            F
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Finance Manager</h1>
          <p className="mt-1 text-sm text-surface-500">Sign in to sync your finances securely</p>
        </div>

        <Tabs
          className="mb-6 w-full justify-center"
          tabs={[
            { id: 'login', label: 'Log in' },
            { id: 'signup', label: 'Sign up' },
          ]}
          active={mode}
          onChange={setMode}
        />

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === 'signup' ? 'At least 8 characters' : undefined}
          />
          {error && <p className="text-sm text-accent-rose">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? (
              <>
                <Lock className="h-4 w-4" /> Log in
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" /> Create account
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
