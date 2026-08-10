import { useEffect } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { isApiMode, logout } from '@/lib/api'

/** True when auto-persist reminders are on and a backup is pending. */
export function needsBackupPrompt(
  state: {
    settings: { autoPersist: boolean; backupPending: boolean }
  } = useFinanceStore.getState(),
): boolean {
  return state.settings.autoPersist !== false && state.settings.backupPending
}

/** Clear session and go to auth/homepage. */
export function performSessionExit(): void {
  if (isApiMode()) {
    logout()
    useFinanceStore.getState().resetAll()
    window.location.href = '/auth'
    return
  }
  useFinanceStore.getState().resetAll()
  window.location.href = '/'
}

/** Warn on tab close / refresh when there are unbacked-up changes. */
export function useBackupBeforeUnload(): void {
  const backupPending = useFinanceStore((s) => s.settings.backupPending)
  const autoPersist = useFinanceStore((s) => s.settings.autoPersist)

  useEffect(() => {
    if (!autoPersist || !backupPending) return

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [autoPersist, backupPending])
}
