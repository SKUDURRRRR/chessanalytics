import { createPortal } from 'react-dom'

interface LoadingModalProps {
  isOpen: boolean
  message?: string
  subtitle?: string
}

export default function LoadingModal({
  isOpen,
  message = 'Loading...',
  subtitle
}: LoadingModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-8 py-10 text-center shadow-2xl shadow-black/50 max-w-md mx-4">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        <p className="text-base text-slate-200">{message}</p>
        {subtitle && (
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>,
    document.body
  )
}
