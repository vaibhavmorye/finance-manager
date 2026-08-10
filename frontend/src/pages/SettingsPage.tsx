import { useRef, useState } from 'react'
import { Download, Upload, Trash2, AlertTriangle, LogOut } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, Select, Checkbox } from '@/components/ui'
import { BackupPasswordModal } from '@/components/BackupPasswordModal'
import { BackupLeaveModal } from '@/components/BackupLeaveModal'
import { useFinanceStore } from '@/store/financeStore'
import { useTheme } from '@/hooks/useTheme'
import { isApiMode, getStoredUser } from '@/lib/api'
import { peekBackupFile } from '@/lib/storage'
import { needsBackupPrompt, performSessionExit } from '@/lib/backupGuard'
import type { Currency } from '@/types/finance'

function formatBackupTime(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function SettingsPage() {
  const store = useFinanceStore()
  const { theme, setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [exitAfterExport, setExitAfterExport] = useState(false)
  const user = getStoredUser()

  const handleImportPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const kind = await peekBackupFile(file)
    if (kind === 'invalid') {
      alert('Invalid finance data file. Please use a valid export.')
      return
    }
    if (kind === 'encrypted') {
      setPasswordError(null)
      setPendingImport(file)
      setImportOpen(true)
      return
    }
    try {
      await store.importData(file)
      alert('Data imported successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const handleExport = async (password: string) => {
    setBusy(true)
    setPasswordError(null)
    try {
      await store.exportData(password)
      setExportOpen(false)
      if (exitAfterExport) {
        setExitAfterExport(false)
        performSessionExit()
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleEncryptedImport = async (password: string) => {
    if (!pendingImport) return
    setBusy(true)
    setPasswordError(null)
    try {
      await store.importData(pendingImport, password)
      setImportOpen(false)
      setPendingImport(null)
      alert('Data imported successfully')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const requestLogout = () => {
    if (needsBackupPrompt()) {
      setLeaveOpen(true)
      return
    }
    performSessionExit()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Settings</h1>
        <p className="text-sm text-surface-500">Preferences and data management</p>
      </div>

      {isApiMode() && user && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Signed in as {user.email}</CardDescription>
            </div>
          </CardHeader>
          <Button variant="outline" onClick={requestLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Currency and appearance</CardDescription>
          </div>
        </CardHeader>
        <div className="space-y-4">
          <Select
            label="Currency"
            value={store.profile.currency}
            onChange={(e) => store.setProfile({ currency: e.target.value as Currency })}
            options={[
              { value: 'INR', label: 'INR — Indian Rupee' },
              { value: 'USD', label: 'USD — US Dollar' },
              { value: 'EUR', label: 'EUR — Euro' },
              { value: 'GBP', label: 'GBP — British Pound' },
            ]}
          />
          <Select
            label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your data</CardTitle>
            <CardDescription>
              {isApiMode()
                ? 'Synced to your account. Export an encrypted JSON backup anytime.'
                : 'Everything stays in this browser. Export an encrypted JSON backup to move devices or keep a copy.'}
            </CardDescription>
          </div>
        </CardHeader>
        <div className="space-y-4">
          <Checkbox
            label="Auto-persist backup reminders"
            description="Prompt to export an encrypted backup when you log out or close the window if changes are not backed up. On by default."
            checked={store.settings.autoPersist}
            onChange={(checked) => store.setSettings({ autoPersist: checked })}
          />
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Last backup: {formatBackupTime(store.settings.lastBackupAt)}
            {store.settings.backupPending ? ' · Changes pending backup' : ''}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => { setPasswordError(null); setExitAfterExport(false); setExportOpen(true) }}>
              <Download className="h-4 w-4" /> Export encrypted
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportPick}
            />
          </div>
        </div>
      </Card>

      <Card className="border-accent-rose/30">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-accent-rose">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
            <CardDescription>Reset clears all finance data</CardDescription>
          </div>
        </CardHeader>
        {!confirmReset ? (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <Trash2 className="h-4 w-4" /> Reset all data
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => {
                store.resetAll()
                setConfirmReset(false)
                window.location.href = isApiMode() ? '/onboarding' : '/'
              }}
            >
              Yes, delete everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        )}
      </Card>

      <BackupLeaveModal
        open={leaveOpen}
        onCancel={() => setLeaveOpen(false)}
        onLeaveWithoutBackup={() => {
          setLeaveOpen(false)
          performSessionExit()
        }}
        onExportBackup={() => {
          setLeaveOpen(false)
          setExitAfterExport(true)
          setPasswordError(null)
          setExportOpen(true)
        }}
      />
      <BackupPasswordModal
        open={exportOpen}
        mode="export"
        busy={busy}
        error={passwordError}
        onClose={() => {
          if (busy) return
          setExitAfterExport(false)
          setExportOpen(false)
        }}
        onSubmit={handleExport}
      />
      <BackupPasswordModal
        open={importOpen}
        mode="import"
        busy={busy}
        error={passwordError}
        onClose={() => {
          if (busy) return
          setImportOpen(false)
          setPendingImport(null)
        }}
        onSubmit={handleEncryptedImport}
      />
    </div>
  )
}
