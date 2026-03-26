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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0f]/90">
      <div className="rounded-lg bg-surface-1 px-8 py-10 text-center shadow-card max-w-md mx-4">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        <p className="text-[13px] text-gray-300">{message}</p>
        {subtitle && (
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>,
    document.body
  )
}
