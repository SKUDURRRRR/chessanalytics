// Mobile testing utilities for development and QA

export const mobileTesting = {
  // Simulate different device viewports
  simulateDevice: (device: 'iphone' | 'android' | 'tablet' | 'desktop') => {
    const viewports = {
      iphone: { width: 375, height: 667 },
      android: { width: 360, height: 640 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1280, height: 720 }
    }
    
    if (typeof window !== 'undefined') {
      window.resizeTo(viewports[device].width, viewports[device].height)
    }
    
    return viewports[device]
  },

  // Check if current viewport is mobile
  isMobileViewport: (): boolean => {
    return typeof window !== 'undefined' && window.innerWidth < 768
  },

  // Test touch target sizes
  validateTouchTargets: (): { valid: boolean; issues: string[] } => {
    const issues: string[] = []
    const buttons = document.querySelectorAll('button, [role="button"], a')
    
    buttons.forEach((button, index) => {
      const rect = button.getBoundingClientRect()
      const minSize = 44 // Minimum touch target size
      
      if (rect.width < minSize || rect.height < minSize) {
        issues.push(`Button ${index} is too small: ${rect.width}x${rect.height}px`)
      }
    })
    
    return {
      valid: issues.length === 0,
      issues
    }
  },

  // Test for horizontal scroll issues
  checkHorizontalScroll: (): { hasHorizontalScroll: boolean; elements: string[] } => {
    const elements: string[] = []
    
    // Check if body has horizontal scroll
    if (document.body.scrollWidth > window.innerWidth) {
      elements.push('body')
    }
    
    // Check all elements for overflow
    const allElements = document.querySelectorAll('*')
    allElements.forEach((el) => {
      const computedStyle = window.getComputedStyle(el)
      if (computedStyle.overflowX === 'scroll' || computedStyle.overflowX === 'auto') {
        const rect = el.getBoundingClientRect()
        if (rect.width > window.innerWidth) {
          elements.push(el.tagName.toLowerCase())
        }
      }
    })
    
    return {
      hasHorizontalScroll: elements.length > 0,
      elements
    }
  },

  // Test responsive breakpoints
  testBreakpoints: (): Record<string, boolean> => {
    const width = window.innerWidth
    
    return {
      xs: width >= 360,
      sm: width >= 481,
      md: width >= 769,
      lg: width >= 1025,
      xl: width >= 1280,
      '2xl': width >= 1536
    }
  },


  // Test card layout vs table layout
  testLayoutAdaptation: (): { usesCardLayout: boolean; usesTableLayout: boolean } => {
    const cards = document.querySelectorAll('[data-testid="mobile-card-layout"]')
    const tables = document.querySelectorAll('table')
    
    return {
      usesCardLayout: cards.length > 0,
      usesTableLayout: tables.length > 0 && window.innerWidth >= 1024
    }
  },

  // Performance testing
  measurePerformance: async (): Promise<{
    loadTime: number;
    renderTime: number;
    memoryUsage?: number;
  }> => {
    const startTime = performance.now()
    
    // Wait for page to be fully loaded
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0)
      } else {
        window.addEventListener('load', resolve)
      }
    })
    
    const loadTime = performance.now() - startTime
    
    // Measure render time
    const renderStart = performance.now()
    document.body.offsetHeight // Force reflow
    const renderTime = performance.now() - renderStart
    
    // Memory usage (if available)
    const memoryUsage = (performance as any).memory?.usedJSHeapSize
    
    return {
      loadTime,
      renderTime,
      memoryUsage
    }
  },

  // Accessibility testing
  testAccessibility: (): { issues: string[] } => {
    const issues: string[] = []
    
    // Check for missing alt text
    const images = document.querySelectorAll('img')
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push(`Image ${index} missing alt text`)
      }
    })
    
    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    let lastLevel = 0
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))
      if (level > lastLevel + 1) {
        issues.push(`Heading hierarchy issue at heading ${index}`)
      }
      lastLevel = level
    })
    
    // Check for proper form labels
    const inputs = document.querySelectorAll('input, textarea, select')
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id')
      const label = id ? document.querySelector(`label[for="${id}"]`) : null
      const ariaLabel = input.getAttribute('aria-label')
      
      if (!label && !ariaLabel) {
        issues.push(`Input ${index} missing label`)
      }
    })
    
    return { issues }
  },

  // Generate mobile testing report
  generateReport: (): string => {
    const touchTargets = mobileTesting.validateTouchTargets()
    const horizontalScroll = mobileTesting.checkHorizontalScroll()
    const breakpoints = mobileTesting.testBreakpoints()
    const layout = mobileTesting.testLayoutAdaptation()
    const accessibility = mobileTesting.testAccessibility()
    
    return `
Mobile Testing Report
====================

Viewport: ${window.innerWidth}x${window.innerHeight}
Device: ${mobileTesting.isMobileViewport() ? 'Mobile' : 'Desktop'}

Touch Targets: ${touchTargets.valid ? '✅ Pass' : '❌ Fail'}
${touchTargets.issues.length > 0 ? touchTargets.issues.map(issue => `  - ${issue}`).join('\n') : ''}

Horizontal Scroll: ${horizontalScroll.hasHorizontalScroll ? '❌ Issues found' : '✅ No issues'}
${horizontalScroll.elements.length > 0 ? horizontalScroll.elements.map(el => `  - ${el}`).join('\n') : ''}

Breakpoints:
${Object.entries(breakpoints).map(([bp, active]) => `  ${bp}: ${active ? '✅' : '❌'}`).join('\n')}

Layout Adaptation:
  Card Layout: ${layout.usesCardLayout ? '✅' : '❌'}
  Table Layout: ${layout.usesTableLayout ? '✅' : '❌'}

Accessibility Issues: ${accessibility.issues.length}
${accessibility.issues.length > 0 ? accessibility.issues.map(issue => `  - ${issue}`).join('\n') : '  None'}
    `.trim()
  }
}

// Development helper - add to window for easy access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).mobileTesting = mobileTesting
}
