// Responsive hooks for mobile optimizations
import { useState, useEffect, useRef } from 'react'

interface MobileOptimizations {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  boardSize: 'small' | 'medium' | 'large'
  touchOptimized: boolean
  reducedMotion: boolean
}

export function useMobileOptimizations(): MobileOptimizations {
  const [optimizations, setOptimizations] = useState<MobileOptimizations>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    boardSize: 'large',
    touchOptimized: false,
    reducedMotion: false
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateOptimizations = () => {
      const width = window.innerWidth

      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024

      let boardSize: 'small' | 'medium' | 'large' = 'large'
      if (width < 480) {
        boardSize = 'small'
      } else if (width < 768) {
        boardSize = 'medium'
      }

      const touchOptimized = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      setOptimizations({
        isMobile,
        isTablet,
        isDesktop,
        boardSize,
        touchOptimized,
        reducedMotion
      })
    }

    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateOptimizations, 100)
    }

    // Initial check fires immediately
    updateOptimizations()

    window.addEventListener('resize', debouncedUpdate)

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    mediaQuery.addEventListener('change', updateOptimizations)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedUpdate)
      mediaQuery.removeEventListener('change', updateOptimizations)
    }
  }, [])

  return optimizations
}

// Hook for responsive breakpoints
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<string>('xs')

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateBreakpoint = () => {
      const width = window.innerWidth

      if (width >= 1536) {
        setBreakpoint('2xl')
      } else if (width >= 1280) {
        setBreakpoint('xl')
      } else if (width >= 1025) {
        setBreakpoint('lg')
      } else if (width >= 769) {
        setBreakpoint('md')
      } else if (width >= 481) {
        setBreakpoint('sm')
      } else {
        setBreakpoint('xs')
      }
    }

    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateBreakpoint, 100)
    }

    updateBreakpoint()
    window.addEventListener('resize', debouncedUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedUpdate)
    }
  }, [])

  return breakpoint
}

// Hook for viewport dimensions
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    const debouncedUpdate = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(updateViewport, 100)
    }

    updateViewport()
    window.addEventListener('resize', debouncedUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedUpdate)
    }
  }, [])

  return viewport
}
