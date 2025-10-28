import { useCallback, useRef, useEffect } from 'react'

export type ChessSoundType = 'move' | 'capture' | 'castle' | 'check'

interface ChessSoundOptions {
  enabled?: boolean
  volume?: number
}

/**
 * Hook for playing chess move sounds
 *
 * Usage:
 * ```tsx
 * const { playSound, isReady } = useChessSound({ enabled: true, volume: 0.5 })
 * playSound('move')
 * ```
 */
export function useChessSound(options: ChessSoundOptions = {}) {
  const { enabled = true, volume = 0.6 } = options
  const audioRef = useRef<Map<ChessSoundType, HTMLAudioElement>>(new Map())
  const isReadyRef = useRef(false)

  // Load all sound files on mount
  useEffect(() => {
    const sounds: ChessSoundType[] = ['move', 'capture', 'castle', 'check']

    sounds.forEach(soundType => {
      if (!audioRef.current.has(soundType)) {
        const audio = new Audio(`/sounds/${soundType}.mp3`)
        audio.preload = 'auto'
        audio.volume = volume
        audioRef.current.set(soundType, audio)
      }
    })

    isReadyRef.current = true

    // Cleanup
    return () => {
      audioRef.current.forEach(audio => {
        audio.pause()
        audio.src = ''
      })
      audioRef.current.clear()
    }
  }, [volume])

  const playSound = useCallback((soundType: ChessSoundType) => {
    if (!enabled || !isReadyRef.current) return

    const audio = audioRef.current.get(soundType)
    if (audio) {
      // Reset to start if already playing
      audio.currentTime = 0
      audio.play().catch(e => {
        // Silently fail if autoplay is blocked or sound file is missing
        console.debug(`Chess sound '${soundType}' failed to play:`, e)
      })
    }
  }, [enabled])

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    audioRef.current.forEach(audio => {
      audio.volume = clampedVolume
    })
  }, [])

  return {
    playSound,
    setVolume,
    isReady: isReadyRef.current
  }
}
