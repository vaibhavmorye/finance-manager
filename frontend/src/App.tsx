import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useFinanceStore } from '@/store/financeStore'
import { useTheme } from '@/hooks/useTheme'
import { isApiMode, hasToken } from '@/lib/api'
import { AppLayout } from '@/components/layout/AppLayout'
import { WelcomePage } from '@/pages/WelcomePage'
import { AuthPage } from '@/pages/AuthPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IncomePage } from '@/pages/IncomePage'
import { InvestmentsPage } from '@/pages/InvestmentsPage'
import { DebtsPage } from '@/pages/DebtsPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { InsurancePage } from '@/pages/InsurancePage'
import { CalculatorsPage } from '@/pages/CalculatorsPage'
import { HomeLoanCalculatorPage } from '@/pages/calculators/HomeLoanCalculatorPage'
import { FireCalculatorPage } from '@/pages/calculators/FireCalculatorPage'
import { SipCalculatorPage } from '@/pages/calculators/SipCalculatorPage'
import { SettingsPage } from '@/pages/SettingsPage'

function ThemeBoot() {
  useTheme()
  return null
}

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}

function RequireOnboarding() {
  const hydrated = useFinanceStore((s) => s.hydrated)
  const complete = useFinanceStore((s) => s.profile.onboardingComplete)

  if (!hydrated) return <Loading />

  if (isApiMode() && !hasToken()) {
    return <Navigate to="/auth" replace />
  }

  if (!complete) {
    return <Navigate to={isApiMode() ? '/onboarding' : '/welcome'} replace />
  }

  return <Outlet />
}

function RootRedirect() {
  const hydrated = useFinanceStore((s) => s.hydrated)
  const complete = useFinanceStore((s) => s.profile.onboardingComplete)

  if (!hydrated) return <Loading />

  if (isApiMode()) {
    if (!hasToken()) return <Navigate to="/auth" replace />
    return <Navigate to={complete ? '/' : '/onboarding'} replace />
  }

  return <Navigate to={complete ? '/' : '/welcome'} replace />
}

export default function App() {
  const hydrate = useFinanceStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <BrowserRouter>
      <ThemeBoot />
      <Routes>
        <Route path="/welcome" element={isApiMode() ? <Navigate to="/auth" replace /> : <WelcomePage />} />
        <Route path="/auth" element={isApiMode() ? <AuthPage /> : <Navigate to="/welcome" replace />} />
        <Route
          path="/onboarding"
          element={
            isApiMode() && !hasToken() ? <Navigate to="/auth" replace /> : <OnboardingPage />
          }
        />

        <Route element={<AppLayout />}>
          <Route path="/calculators" element={<CalculatorsPage />} />
          <Route path="/calculators/home-loan" element={<HomeLoanCalculatorPage />} />
          <Route path="/calculators/fire" element={<FireCalculatorPage />} />
          <Route path="/calculators/sip" element={<SipCalculatorPage />} />
        </Route>

        <Route element={<RequireOnboarding />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/income" element={<IncomePage />} />
            <Route path="/investments" element={<InvestmentsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/insurance" element={<InsurancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
