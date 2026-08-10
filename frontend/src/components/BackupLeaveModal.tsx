import { Button, Modal } from '@/components/ui'

interface BackupLeaveModalProps {
  open: boolean
  onCancel: () => void
  onLeaveWithoutBackup: () => void
  onExportBackup: () => void
}

export function BackupLeaveModal({
  open,
  onCancel,
  onLeaveWithoutBackup,
  onExportBackup,
}: BackupLeaveModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Back up before leaving?"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={onLeaveWithoutBackup}>
            Leave without backup
          </Button>
          <Button type="button" onClick={onExportBackup}>
            Export backup
          </Button>
        </>
      }
    >
      <p className="text-sm text-surface-500 dark:text-surface-400">
        You have changes since your last encrypted backup. Export a password-protected backup so you
        can restore this data later.
      </p>
    </Modal>
  )
}
