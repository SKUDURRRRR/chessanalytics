import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface MobileSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function MobileSheet({ isOpen, onClose, title, children, className = '' }: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden'
      
      // Focus management
      const focusableElements = sheetRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements?.[0] as HTMLElement
      firstElement?.focus()
    } else {
      // Restore body scroll
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm lg:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose()
        }
      }}
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-lg bg-slate-900 border-t border-white/10 lg:border lg:rounded-2xl lg:max-h-[90vh] lg:overflow-hidden animate-slide-up lg:animate-scale-in ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 id="sheet-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="btn-touch-sm rounded-full border border-white/10 bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
