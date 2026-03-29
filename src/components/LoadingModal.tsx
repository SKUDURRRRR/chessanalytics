import { createPortal } from 'react-dom'

interface LoadingModalProps {
  isOpen: boolean
  message?: string
  subtitle?: string
  /** Use branded splash screen (wordmark + silver bar) instead of spinner */
  branded?: boolean
}

export default function LoadingModal({
  isOpen,
  message = 'Loading...',
  subtitle,
  branded = false
}: LoadingModalProps) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0f]/90">
      {branded ? (
        <div className="text-center">
          <p className="text-[22px] font-semibold tracking-tight text-[#e4e8ed] mb-8">
            chess<span className="font-normal text-[#9ca3af]">analytics</span>
          </p>
          <div className="mx-auto w-[120px] h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full w-[40%] rounded-full bg-[#e4e8ed] animate-[loading-slide_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-1 px-8 py-10 text-center shadow-card max-w-md mx-4">
          <div className="mx-auto mb-5 h-10 w-10 rounded-full border-2 border-[#e4e8ed]/30 border-t-[#e4e8ed] animate-spin" />
          <p className="text-[13px] text-gray-300">{message}</p>
          {subtitle && (
            <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">{subtitle}</p>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
