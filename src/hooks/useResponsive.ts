// Responsive hooks for mobile optimizations
import { useState, useEffect } from 'react'

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
    const updateOptimizations = () => {
      const width = window.innerWidth

      // Determine device type
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024

      // Determine board size based on viewport
      let boardSize: 'small' | 'medium' | 'large' = 'large'
      if (width < 480) {
        boardSize = 'small'
      } else if (width < 768) {
        boardSize = 'medium'
      }

      // Check for touch capability
      const touchOptimized = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // Check for reduced motion preference
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

    // Initial check
    updateOptimizations()

    // Listen for resize events
    window.addEventListener('resize', updateOptimizations)

    // Listen for motion preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    mediaQuery.addEventListener('change', updateOptimizations)

    return () => {
      window.removeEventListener('resize', updateOptimizations)
      mediaQuery.removeEventListener('change', updateOptimizations)
    }
  }, [])

  return optimizations
}

// Hook for responsive breakpoints
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<string>('xs')

  useEffect(() => {
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

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)

    return () => window.removeEventListener('resize', updateBreakpoint)
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
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return viewport
}
