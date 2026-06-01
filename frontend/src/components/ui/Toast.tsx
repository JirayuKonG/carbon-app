import { useState, useCallback, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const ctx: ToastContextValue = {
    addToast,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error:   (title, message) => addToast({ type: 'error',   title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info:    (title, message) => addToast({ type: 'info',    title, message }),
  }

  const iconMap = {
    success: <CheckCircle size={16} className="text-primary-600 shrink-0" />,
    error:   <XCircle     size={16} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-accent-500 shrink-0" />,
    info:    <Info        size={16} className="text-blue-500 shrink-0" />,
  }
  const styleMap = {
    success: 'border-primary-200 bg-primary-50',
    error:   'border-red-200 bg-red-50',
    warning: 'border-accent-200 bg-accent-50',
    info:    'border-blue-200 bg-blue-50',
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`card-sm flex items-start gap-3 border shadow-card-md animate-slide-up pointer-events-auto ${styleMap[t.type]}`}>
            {iconMap[t.type]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900">{t.title}</p>
              {t.message && <p className="text-xs text-surface-600 mt-0.5">{t.message}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="btn-icon btn-ghost btn-sm text-surface-400"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
