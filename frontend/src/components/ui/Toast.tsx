import { useState, useCallback, createContext, useContext, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, LoaderCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  durationMs?: number
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id?: string) => void
  success: (title: string, message?: string) => string
  error:   (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info:    (title: string, message?: string) => string
  loading: (title: string, message?: string) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutMapRef = useRef<Record<string, number>>({})

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const durationMs = toast.durationMs ?? 4000
    setToasts((prev) => [...prev, { ...toast, id, durationMs }])

    if (durationMs > 0) {
      timeoutMapRef.current[id] = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        delete timeoutMapRef.current[id]
      }, durationMs)
    }

    return id
  }, [])

  const dismiss = useCallback((id?: string) => {
    if (!id) {
      Object.values(timeoutMapRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutMapRef.current = {}
      setToasts([])
      return
    }

    const timeoutId = timeoutMapRef.current[id]
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      delete timeoutMapRef.current[id]
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const ctx: ToastContextValue = {
    addToast,
    dismiss,
    success: (title, message) => addToast({ type: 'success', title, message }),
    error:   (title, message) => addToast({ type: 'error',   title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info:    (title, message) => addToast({ type: 'info',    title, message }),
    loading: (title, message) => addToast({ type: 'loading', title, message, durationMs: 0 }),
  }

  const iconMap = {
    success: <CheckCircle size={16} className="text-primary-600 shrink-0" />,
    error:   <XCircle     size={16} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-accent-500 shrink-0" />,
    info:    <Info        size={16} className="text-blue-500 shrink-0" />,
    loading: <LoaderCircle size={16} className="text-blue-600 shrink-0 animate-spin" />,
  }
  const styleMap = {
    success: 'border-primary-200 bg-primary-50',
    error:   'border-red-200 bg-red-50',
    warning: 'border-accent-200 bg-accent-50',
    info:    'border-blue-200 bg-blue-50',
    loading: 'border-blue-200 bg-white',
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
              onClick={() => dismiss(t.id)}
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
