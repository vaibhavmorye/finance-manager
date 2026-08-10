import { useEffect, useState } from 'react'
import { Button, Input, Modal } from '@/components/ui'

type Mode = 'export' | 'import'

interface BackupPasswordModalProps {
  open: boolean
  mode: Mode
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (password: string) => void | Promise<void>
}

export function BackupPasswordModal({
  open,
  mode,
  busy = false,
  error = null,
  onClose,
  onSubmit,
}: BackupPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirm('')
    setLocalError(null)
  }, [open])

  const title = mode === 'export' ? 'Encrypt backup' : 'Unlock backup'
  const description =
    mode === 'export'
      ? 'Choose a password to encrypt this backup. You will need it to import the file later.'
      : 'This backup is encrypted. Enter the password used when it was exported.'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!password) {
      setLocalError('Password is required.')
      return
    }
    if (mode === 'export') {
      if (password.length < 8) {
        setLocalError('Use at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.')
        return
      }
    }
    await onSubmit(password)
  }

  const displayError = localError ?? error

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="backup-password-form" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'export' ? 'Export encrypted' : 'Import'}
          </Button>
        </>
      }
    >
      <form id="backup-password-form" className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-surface-500 dark:text-surface-400">{description}</p>
        <Input
          label="Password"
          type="password"
          name="backup-password"
          autoComplete={mode === 'export' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={busy}
          hint={mode === 'export' ? 'At least 8 characters. Keep this password safe — it cannot be recovered.' : undefined}
        />
        {mode === 'export' && (
          <Input
            label="Confirm password"
            type="password"
            name="backup-password-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        )}
        {displayError && <p className="text-sm text-accent-rose">{displayError}</p>}
      </form>
    </Modal>
  )
}
