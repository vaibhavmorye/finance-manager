import { useEffect } from 'react'
import { useFinanceStore } from '@/store/financeStore'

export function useTheme() {
  const theme = useFinanceStore((s) => s.settings.theme)
  const setSettings = useFinanceStore((s) => s.setSettings)

  useEffect(() => {
    const root = document.documentElement
    const apply = (isDark: boolean) => {
      root.classList.toggle('dark', isDark)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme === 'dark')
  }, [theme])

  return {
    theme,
    setTheme: (t: 'light' | 'dark' | 'system') => setSettings({ theme: t }),
  }
}
