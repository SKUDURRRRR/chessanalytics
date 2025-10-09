// Action Menu component for mobile-friendly action selection
import { useState, useRef, useEffect } from 'react'

interface Action {
  id: string
  label: string
  icon?: string
  onClick: () => void
  disabled?: boolean
}

interface ActionMenuProps {
  trigger: React.ReactNode
  actions: Action[]
  title?: string
  className?: string
}

export function ActionMenu({ trigger, actions, title = 'Actions', className = '' }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleActionClick = (action: Action) => {
    if (!action.disabled) {
      action.onClick()
      setIsOpen(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-white/10 bg-slate-800 py-2 shadow-xl shadow-black/50"
        >
          {title && (
            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {title}
            </div>
          )}
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
              className={`w-full px-3 py-2 text-left text-sm transition ${
                action.disabled
                  ? 'cursor-not-allowed text-slate-500'
                  : 'text-slate-200 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {action.icon && <span className="text-base">{action.icon}</span>}
                <span>{action.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}