import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ChessSoundContextType {
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  volume: number
  setVolume: (volume: number) => void
}

const ChessSoundContext = createContext<ChessSoundContextType | undefined>(undefined)

interface ChessSoundProviderProps {
  children: ReactNode
}

/**
 * Provider for chess sound settings
 * Persists settings to localStorage
 */
export function ChessSoundProvider({ children }: ChessSoundProviderProps) {
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const saved = localStorage.getItem('chessSoundEnabled')
    return saved !== null ? saved === 'true' : true // Default to enabled
  })

  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('chessSoundVolume')
    return saved !== null ? parseFloat(saved) : 0.6 // Default to 60%
  })

  useEffect(() => {
    localStorage.setItem('chessSoundEnabled', String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    localStorage.setItem('chessSoundVolume', String(volume))
  }, [volume])

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled)
  }

  const setVolume = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setVolumeState(clampedVolume)
  }

  return (
    <ChessSoundContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        volume,
        setVolume
      }}
    >
      {children}
    </ChessSoundContext.Provider>
  )
}

/**
 * Hook to access chess sound settings
 */
export function useChessSoundSettings() {
  const context = useContext(ChessSoundContext)
  if (context === undefined) {
    throw new Error('useChessSoundSettings must be used within a ChessSoundProvider')
  }
  return context
}
