// Mobile performance monitoring and optimization utilities

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage?: number
  touchLatency: number
  scrollPerformance: number
  bundleSize?: number
}

interface MobileOptimizationConfig {
  enableLazyLoading: boolean
  enableImageOptimization: boolean
  enableCodeSplitting: boolean
  enableServiceWorker: boolean
  maxTouchLatency: number
  maxScrollJank: number
}

export class MobilePerformanceMonitor {
  private metrics: PerformanceMetrics
  private config: MobileOptimizationConfig
  private observers: PerformanceObserver[]
  private isMonitoring: boolean

  constructor(config: Partial<MobileOptimizationConfig> = {}) {
    this.config = {
      enableLazyLoading: true,
      enableImageOptimization: true,
      enableCodeSplitting: true,
      enableServiceWorker: true,
      maxTouchLatency: 100, // ms
      maxScrollJank: 16, // ms (60fps = 16.67ms per frame)
      ...config
    }

    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      touchLatency: 0,
      scrollPerformance: 0
    }

    this.observers = []
    this.isMonitoring = false
  }

  // Start monitoring performance
  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.setupPerformanceObservers()
    this.measureInitialLoad()
    this.setupTouchLatencyMonitoring()
    this.setupScrollPerformanceMonitoring()
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.isMonitoring = false
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    const { loadTime, renderTime, touchLatency, scrollPerformance } = this.metrics
    
    let score = 100
    
    // Load time scoring (target: < 3s)
    if (loadTime > 3000) score -= 30
    else if (loadTime > 2000) score -= 20
    else if (loadTime > 1000) score -= 10
    
    // Render time scoring (target: < 100ms)
    if (renderTime > 200) score -= 20
    else if (renderTime > 100) score -= 10
    
    // Touch latency scoring (target: < 100ms)
    if (touchLatency > 200) score -= 20
    else if (touchLatency > 100) score -= 10
    
    // Scroll performance scoring (target: 60fps)
    if (scrollPerformance > 32) score -= 20
    else if (scrollPerformance > 16) score -= 10
    
    return Math.max(0, score)
  }

  // Check if performance meets mobile standards
  isMobileOptimized(): boolean {
    const score = this.getPerformanceScore()
    return score >= 80
  }

  // Get optimization recommendations
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const { loadTime, renderTime, touchLatency, scrollPerformance } = this.metrics

    if (loadTime > 3000) {
      recommendations.push('Consider code splitting and lazy loading to reduce initial bundle size')
    }

    if (renderTime > 100) {
      recommendations.push('Optimize rendering performance by reducing DOM complexity')
    }

    if (touchLatency > 100) {
      recommendations.push('Improve touch responsiveness by optimizing event handlers')
    }

    if (scrollPerformance > 16) {
      recommendations.push('Optimize scroll performance by reducing layout thrashing')
    }

    if (this.metrics.memoryUsage && this.metrics.memoryUsage > 50 * 1024 * 1024) {
      recommendations.push('Consider memory optimization - current usage is high')
    }

    return recommendations
  }

  private setupPerformanceObservers(): void {
    // Observe navigation timing
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            this.metrics.loadTime = navEntry.loadEventEnd - navEntry.fetchStart
            this.metrics.renderTime = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart
          }
        })
      })
      
      navObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navObserver)
    }

    // Observe memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = memory.usedJSHeapSize
    }
  }

  private measureInitialLoad(): void {
    if (document.readyState === 'complete') {
      this.calculateLoadMetrics()
    } else {
      window.addEventListener('load', () => {
        this.calculateLoadMetrics()
      })
    }
  }

  private calculateLoadMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    if (navigation) {
      this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart
      this.metrics.renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
    }
  }

  private setupTouchLatencyMonitoring(): void {
    let touchStartTime = 0
    
    const handleTouchStart = (event: TouchEvent) => {
      touchStartTime = performance.now()
    }
    
    const handleTouchEnd = (event: TouchEvent) => {
      const touchEndTime = performance.now()
      const latency = touchEndTime - touchStartTime
      
      // Update average touch latency
      this.metrics.touchLatency = this.metrics.touchLatency === 0 
        ? latency 
        : (this.metrics.touchLatency + latency) / 2
    }
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
  }

  private setupScrollPerformanceMonitoring(): void {
    let lastScrollTime = 0
    let frameCount = 0
    let totalFrameTime = 0
    
    const handleScroll = () => {
      const now = performance.now()
      const frameTime = now - lastScrollTime
      
      if (lastScrollTime > 0) {
        frameCount++
        totalFrameTime += frameTime
        this.metrics.scrollPerformance = totalFrameTime / frameCount
      }
      
      lastScrollTime = now
    }
    
    document.addEventListener('scroll', handleScroll, { passive: true })
  }
}

// Mobile optimization utilities
export const mobileOptimizations = {
  // Lazy load images
  lazyLoadImages: (): void => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            if (img.dataset.src) {
              img.src = img.dataset.src
              img.removeAttribute('data-src')
              imageObserver.unobserve(img)
            }
          }
        })
      })

      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img)
      })
    }
  },

  // Optimize touch interactions
  optimizeTouchInteractions: (): void => {
    // Add touch-action CSS to prevent default behaviors
    const style = document.createElement('style')
    style.textContent = `
      * {
        touch-action: manipulation;
      }
      
      button, a, [role="button"] {
        -webkit-tap-highlight-color: transparent;
      }
    `
    document.head.appendChild(style)
  },

  // Preload critical resources
  preloadCriticalResources: (): void => {
    // Skip preloading in development to avoid console warnings
    if (process.env.NODE_ENV === 'development') {
      return
    }

    // Only preload actual static assets that exist and are likely to be used
    // Vite handles module preloading automatically for bundled assets
    const staticAssets = [
      // Add other static assets as needed, but avoid source files
      // Only include assets that actually exist in the public directory
    ]

    staticAssets.forEach(({ href, as }) => {
      // Check if the resource is already preloaded to avoid duplicates
      const existingPreload = document.querySelector(`link[rel="preload"][href="${href}"]`)
      if (existingPreload) {
        return
      }

      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = href
      link.as = as
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })
  },

  // Optimize for mobile viewport
  optimizeViewport: (): void => {
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
    }
  },

  // Enable service worker for caching
  enableServiceWorker: async (): Promise<void> => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered:', registration)
      } catch (error) {
        console.log('Service Worker registration failed:', error)
      }
    }
  }
}

// Initialize mobile optimizations
export const initializeMobileOptimizations = (): void => {
  mobileOptimizations.optimizeViewport()
  mobileOptimizations.optimizeTouchInteractions()
  mobileOptimizations.lazyLoadImages()
  mobileOptimizations.preloadCriticalResources()
  
  // Enable service worker in production
  if (process.env.NODE_ENV === 'production') {
    mobileOptimizations.enableServiceWorker()
  }
}

// Export performance monitor instance
export const mobilePerformanceMonitor = new MobilePerformanceMonitor()


