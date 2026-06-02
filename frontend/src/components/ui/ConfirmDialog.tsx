import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  errorMessage?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  open, title, message,
  errorMessage,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'danger',
  onConfirm, onCancel,
  isLoading,
}: ConfirmDialogProps) {
  if (!open) return null

  const colorMap = {
    danger:  { icon: 'text-red-500',    btn: 'btn-danger',                ring: 'bg-red-50' },
    warning: { icon: 'text-accent-500', btn: 'btn bg-accent-600 text-white hover:bg-accent-700', ring: 'bg-accent-50' },
    info:    { icon: 'text-blue-500',   btn: 'btn bg-blue-600 text-white hover:bg-blue-700',     ring: 'bg-blue-50' },
  }
  const c = colorMap[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-card-lg p-6 w-full max-w-sm animate-slide-up">
        <div className={`w-12 h-12 rounded-full ${c.ring} flex items-center justify-center mx-auto mb-4`}>
          <AlertTriangle size={22} className={c.icon} />
        </div>
        <h3 className="text-base font-semibold text-surface-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-surface-500 text-center mb-6">{message}</p>
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button className={`${c.btn} flex-1`} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
