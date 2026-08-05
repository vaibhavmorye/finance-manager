import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-surface-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl dark:bg-surface-900',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4 dark:border-surface-700">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-5 scrollbar-thin">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-surface-200 px-5 py-4 dark:border-surface-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
