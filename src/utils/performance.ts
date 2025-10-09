// Performance monitoring utilities for mobile optimization

export const performance = {
  // Measure component render time
  measureRender: (componentName: string, fn: () => void) => {
    if (process.env.NODE_ENV === 'development') {
      const start = performance.now()
      fn()
      const end = performance.now()
      console.log(`${componentName} render time: ${(end - start).toFixed(2)}ms`)
    } else {
      fn()
    }
  },

  // Debounce function for mobile performance
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  // Throttle function for scroll events
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  },

  // Check if device is mobile
  isMobile: (): boolean => {
    return window.innerWidth < 768
  },

  // Check if device is low-end mobile
  isLowEndMobile: (): boolean => {
    return window.innerWidth < 480 || 
           (navigator as any).deviceMemory < 4 ||
           navigator.hardwareConcurrency < 4
  },

  // Get optimal image size for device
  getOptimalImageSize: (baseSize: number): number => {
    const devicePixelRatio = window.devicePixelRatio || 1
    const screenWidth = window.innerWidth
    
    if (screenWidth < 480) {
      return Math.min(baseSize, 320)
    } else if (screenWidth < 768) {
      return Math.min(baseSize, 480)
    } else if (screenWidth < 1024) {
      return Math.min(baseSize, 640)
    }
    
    return baseSize
  },

  // Lazy load images
  lazyLoadImage: (img: HTMLImageElement, src: string) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            img.src = src
            observer.unobserve(img)
          }
        })
      },
      { rootMargin: '50px' }
    )
    observer.observe(img)
  },

  // Preload critical resources
  preloadCritical: (urls: string[]) => {
    urls.forEach(url => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url
      link.as = url.endsWith('.css') ? 'style' : 'script'
      document.head.appendChild(link)
    })
  },

  // Measure Core Web Vitals
  measureWebVitals: () => {
    if (typeof window !== 'undefined' && 'web-vitals' in window) {
      // This would be implemented with the web-vitals library
      console.log('Web Vitals measurement available')
    }
  }
}

// Mobile-specific optimizations
export const mobileOptimizations = {
  // Reduce animations on low-end devices
  shouldReduceMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
           performance.isLowEndMobile()
  },

  // Use smaller board sizes on mobile
  getOptimalBoardSize: (): number => {
    const screenWidth = window.innerWidth
    const padding = 32
    
    if (screenWidth < 480) {
      return Math.min(screenWidth - padding, 320)
    } else if (screenWidth < 768) {
      return Math.min(screenWidth - padding, 400)
    } else if (screenWidth < 1024) {
      return Math.min(screenWidth - padding, 500)
    }
    
    return 600
  },

  // Optimize touch events
  optimizeTouchEvents: (element: HTMLElement) => {
    element.style.touchAction = 'manipulation'
    element.style.userSelect = 'none'
  },

  // Enable passive event listeners for better scroll performance
  addPassiveEventListener: (
    element: HTMLElement,
    event: string,
    handler: EventListener
  ) => {
    element.addEventListener(event, handler, { passive: true })
  }
}
