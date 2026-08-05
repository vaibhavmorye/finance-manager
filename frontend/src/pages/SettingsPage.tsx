import { useRef, useState } from 'react'
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, Select } from '@/components/ui'
import { useFinanceStore } from '@/store/financeStore'
import { useTheme } from '@/hooks/useTheme'
import type { Currency } from '@/types/finance'

export function SettingsPage() {
  const store = useFinanceStore()
  const { theme, setTheme } = useTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await store.importData(file)
      alert('Data imported successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    }
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">Settings</h1>
        <p className="text-sm text-surface-500">Preferences and data management</p>
      </div>

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
              Everything stays in this browser. Export a JSON backup to move devices or keep a copy.
            </CardDescription>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => store.exportData()}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </Card>

      <Card className="border-accent-rose/30">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-accent-rose">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
            <CardDescription>Reset clears all local data permanently</CardDescription>
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
                window.location.href = '/welcome'
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
    </div>
  )
}
