// @refresh reset - file exports both a component and a hook
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 6000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none" role="status" aria-live="polite">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

const toastStyles: Record<ToastType, { border: string; bg: string; text: string }> = {
  error: { border: 'border-rose-400/30', bg: 'bg-rose-500/10', text: 'text-rose-100' },
  warning: { border: 'border-amber-400/30', bg: 'bg-amber-500/10', text: 'text-amber-100' },
  success: { border: 'border-emerald-400/30', bg: 'bg-emerald-500/10', text: 'text-emerald-100' },
  info: { border: 'border-sky-400/30', bg: 'bg-sky-500/10', text: 'text-sky-100' },
}

const toastIcons: Record<ToastType, typeof Info> = {
  error: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const style = toastStyles[toast.type]
  const Icon = toastIcons[toast.type]

  return (
    <div
      style={{ animation: 'toast-slide-in 0.25s ease-out' }}
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-card ${style.border} ${style.bg} ${style.text}`}
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-80" />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
