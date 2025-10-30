// Comprehensive Error Boundary System
import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../utils/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'section'
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Store error info for debugging
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.renderErrorFallback()
    }

    return this.props.children
  }

  private renderErrorFallback() {
    const { level = 'component' } = this.props
    const { error } = this.state

    const errorConfig = {
      page: {
        containerClass: 'min-h-screen flex items-center justify-center bg-gray-50',
        cardClass: 'bg-white border border-red-200 rounded-lg p-8 m-4 max-w-md w-full shadow-lg',
        icon: 'Alert',
        title: 'Application Error',
        description: 'Something went wrong with the application. Please refresh the page.',
        showDetails: true
      },
      component: {
        containerClass: 'bg-red-50 border border-red-200 rounded-lg p-6 m-4',
        cardClass: '',
        icon: 'Warning',
        title: 'Component Error',
        description: 'This component encountered an error and could not render.',
        showDetails: process.env.NODE_ENV === 'development'
      },
      section: {
        containerClass: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-2',
        cardClass: '',
        icon: 'Warning',
        title: 'Section Error',
        description: 'This section encountered an error.',
        showDetails: process.env.NODE_ENV === 'development'
      }
    }

    const config = errorConfig[level]

    return (
      <div className={config.containerClass}>
        <div className={config.cardClass}>
          <div className="flex items-center space-x-2">
            <div className="text-red-500 text-2xl">{config.icon}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">{config.title}</h3>
              <p className="text-red-700 mt-1">{config.description}</p>
              {config.showDetails && error && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">
                    Error details
                  </summary>
                  <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap bg-red-100 p-2 rounded">
                    {error.toString()}
                  </pre>
                </details>
              )}
              {level === 'page' && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Refresh Page
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

// Specialized error boundaries for different use cases
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="page">
      {children}
    </ErrorBoundary>
  )
}

export function ComponentErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="component">
      {children}
    </ErrorBoundary>
  )
}

export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary level="section">
      {children}
    </ErrorBoundary>
  )
}

// Error boundary for async operations
export function AsyncErrorBoundary({
  children,
  fallback
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <ErrorBoundary
      level="component"
      fallback={fallback || (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-2">
          <div className="flex items-center space-x-2">
            <div className="text-yellow-500 text-xl">Loading</div>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800">Loading Error</h3>
              <p className="text-yellow-700 text-sm">Failed to load data. Please try again.</p>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
