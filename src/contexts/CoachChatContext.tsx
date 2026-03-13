/**
 * CoachChatContext - Provides position context for the floating coach chat widget.
 * Pages set their position context here; the global chat widget reads it.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ChatPositionContext } from '../types'

interface CoachChatContextType {
  /** Current position context from the active page. Null = chat unavailable. */
  positionContext: ChatPositionContext | null
  /** Pages call this to register their position context */
  setPositionContext: (ctx: ChatPositionContext | null) => void
}

const CoachChatContext = createContext<CoachChatContextType | undefined>(undefined)

interface CoachChatProviderProps {
  children: ReactNode
}

export function CoachChatProvider({ children }: CoachChatProviderProps) {
  const [positionContext, setPositionContextState] = useState<ChatPositionContext | null>(null)

  const setPositionContext = useCallback((ctx: ChatPositionContext | null) => {
    setPositionContextState(ctx)
  }, [])

  return (
    <CoachChatContext.Provider value={{ positionContext, setPositionContext }}>
      {children}
    </CoachChatContext.Provider>
  )
}

/**
 * Hook to access/set coach chat position context.
 */
export function useCoachChat() {
  const context = useContext(CoachChatContext)
  if (context === undefined) {
    throw new Error('useCoachChat must be used within a CoachChatProvider')
  }
  return context
}
