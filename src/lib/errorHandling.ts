/**
 * Standardized Error Handling System
 * Provides consistent error handling patterns across the application
 */

import React from 'react'

// ============================================================================
// ERROR TYPES AND INTERFACES
// ============================================================================

export interface ErrorDetails {
  code: string
  message: string
  timestamp: string
  requestId?: string
  context?: Record<string, any>
  stack?: string
}

export interface ErrorResponse {
  success: false
  error: ErrorDetails
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  meta?: {
    timestamp: string
    requestId?: string
    pagination?: {
      page: number
      limit: number
      total: number
    }
  }
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class ChessAnalyticsError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly context?: Record<string, any>
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    context?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'ChessAnalyticsError'
    this.code = code
    this.statusCode = statusCode
    this.context = context
    this.isOperational = isOperational

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends ChessAnalyticsError {
  constructor(message: string, field?: string, context?: Record<string, any>) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      { field, ...context },
      true
    )
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends ChessAnalyticsError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      401,
      context,
      true
    )
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends ChessAnalyticsError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
    super(
      message,
      'AUTHORIZATION_ERROR',
      403,
      context,
      true
    )
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends ChessAnalyticsError {
  constructor(resource: string, identifier?: string, context?: Record<string, any>) {
    super(
      `${resource}${identifier ? ` with identifier '${identifier}'` : ''} not found`,
      'NOT_FOUND_ERROR',
      404,
      { resource, identifier, ...context },
      true
    )
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ChessAnalyticsError {
  constructor(message: string, resource?: string, context?: Record<string, any>) {
    super(
      message,
      'CONFLICT_ERROR',
      409,
      { resource, ...context },
      true
    )
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends ChessAnalyticsError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number, context?: Record<string, any>) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      429,
      { retryAfter, ...context },
      true
    )
    this.name = 'RateLimitError'
  }
}

export class ServiceUnavailableError extends ChessAnalyticsError {
  constructor(service: string, context?: Record<string, any>) {
    super(
      `${service} service is currently unavailable`,
      'SERVICE_UNAVAILABLE_ERROR',
      503,
      { service, ...context },
      true
    )
    this.name = 'ServiceUnavailableError'
  }
}

export class DatabaseError extends ChessAnalyticsError {
  constructor(operation: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Database operation '${operation}' failed`,
      'DATABASE_ERROR',
      500,
      { operation, originalError: originalError?.message, ...context },
      false
    )
    this.name = 'DatabaseError'
  }
}

export class NetworkError extends ChessAnalyticsError {
  constructor(url: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Network request to '${url}' failed`,
      'NETWORK_ERROR',
      502,
      { url, originalError: originalError?.message, ...context },
      false
    )
    this.name = 'NetworkError'
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: Error | ChessAnalyticsError,
  requestId?: string,
  includeStack: boolean = false
): ErrorResponse {
  const timestamp = new Date().toISOString()

  if (error instanceof ChessAnalyticsError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp,
        requestId,
        context: error.context,
        stack: includeStack ? error.stack : undefined
      }
    }
  }

  // Handle generic errors
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp,
      requestId,
      stack: includeStack ? error.stack : undefined
    }
  }
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId?: string,
  pagination?: { page: number; limit: number; total: number }
): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      pagination
    }
  }
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof ChessAnalyticsError) {
        throw error
      }

      // Wrap unknown errors
      throw new ChessAnalyticsError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'INTERNAL_ERROR',
        500,
        { context, originalError: error },
        false
      )
    }
  }
}

/**
 * Validates input data and throws ValidationError if invalid
 */
export function validateInput<T>(
  data: T,
  validator: (data: T) => boolean | string,
  field?: string
): void {
  const result = validator(data)

  if (result === false) {
    throw new ValidationError(
      `Invalid input for field '${field || 'unknown'}'`,
      field
    )
  }

  if (typeof result === 'string') {
    throw new ValidationError(result, field)
  }
}

/**
 * Options for retryWithBackoff
 */
export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  context?: string
  shouldRetry?: (error: Error) => boolean
}

/**
 * Retries an operation with exponential backoff
 *
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 *
 * @example
 * // Basic usage
 * await retryWithBackoff(() => fetchData(), { maxRetries: 3 })
 *
 * @example
 * // With custom retry logic
 * await retryWithBackoff(
 *   () => api.call(),
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     shouldRetry: (error) => !error.message.includes('404')
 *   }
 * )
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    context,
    shouldRetry
  } = options

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError
      }

      if (attempt === maxRetries) {
        throw new ChessAnalyticsError(
          `Operation failed after ${maxRetries + 1} attempts`,
          'RETRY_EXHAUSTED_ERROR',
          500,
          { context, attempts: maxRetries + 1, lastError: lastError.message },
          false
        )
      }

      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

export interface LogLevel {
  ERROR: 'error'
  WARN: 'warn'
  INFO: 'info'
  DEBUG: 'debug'
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
}

/**
 * Logs an error with context
 */
export function logError(
  error: Error | ChessAnalyticsError,
  context?: Record<string, any>,
  level: keyof LogLevel = 'ERROR'
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    level,
    error: {
      name: error.name,
      message: error.message,
      code: error instanceof ChessAnalyticsError ? error.code : undefined,
      stack: error.stack
    },
    context
  }

  console[LOG_LEVELS[level]](JSON.stringify(logData, null, 2))
}

/**
 * Logs a warning with context
 */
export function logWarning(
  message: string,
  context?: Record<string, any>
): void {
  logError(new Error(message), context, 'WARN')
}

/**
 * Logs an info message with context
 */
export function logInfo(
  message: string,
  context?: Record<string, any>
): void {
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    context
  }, null, 2))
}

// ============================================================================
// ERROR BOUNDARY UTILITIES
// ============================================================================

/**
 * Error boundary props for React components
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  context?: string
}

/**
 * Creates an error boundary component
 */
export function createErrorBoundary(
  context: string,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return function ErrorBoundaryComponent({ children, fallback }: Omit<ErrorBoundaryProps, 'context' | 'onError'>) {
    const [error, setError] = React.useState<Error | null>(null)

    React.useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        const error = new Error(event.message)
        error.stack = event.error?.stack

        setError(error)

        if (onError) {
          onError(error, {
            componentStack: event.filename || 'Unknown',
            errorBoundary: context
          } as React.ErrorInfo)
        }

        logError(error, { context, component: context })
      }

      window.addEventListener('error', handleError)
      return () => window.removeEventListener('error', handleError)
    }, [onError])

    if (error) {
      if (fallback) {
        return React.createElement(fallback, {
          error,
          resetError: () => setError(null)
        })
      }

      return React.createElement('div', { className: 'bg-red-50 border border-red-200 rounded-lg p-6 m-4' },
        React.createElement('div', { className: 'flex items-center space-x-2' },
          React.createElement('div', { className: 'text-red-500 text-2xl' }, '!'),
          React.createElement('div', {},
            React.createElement('h3', { className: 'text-lg font-semibold text-red-800' }, `Error in ${context}`),
            React.createElement('p', { className: 'text-red-700 mt-1' }, error.message),
            process.env.NODE_ENV === 'development' && React.createElement('details', { className: 'mt-2' },
              React.createElement('summary', { className: 'text-sm text-red-600 cursor-pointer' }, 'Error details'),
              React.createElement('pre', { className: 'text-xs text-red-600 mt-1 whitespace-pre-wrap' }, error.stack)
            )
          )
        )
      )
    }

    return React.createElement(React.Fragment, {}, children)
  }
}

// ============================================================================
// API ERROR HANDLING
// ============================================================================

/**
 * Handles API errors and converts them to appropriate error types
 */
export function handleApiError(
  error: any,
  context?: string
): ChessAnalyticsError {
  if (error instanceof ChessAnalyticsError) {
    return error
  }

  // Handle fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new NetworkError('API endpoint', error, { context })
  }

  // Handle HTTP errors
  if (error.status) {
    switch (error.status) {
      case 400:
        return new ValidationError(error.message || 'Bad request', undefined, { context })
      case 401:
        return new AuthenticationError(error.message || 'Authentication required', { context })
      case 403:
        return new AuthorizationError(error.message || 'Insufficient permissions', { context })
      case 404:
        return new NotFoundError('Resource', undefined, { context })
      case 409:
        return new ConflictError(error.message || 'Resource conflict', undefined, { context })
      case 429:
        return new RateLimitError(error.message || 'Rate limit exceeded', undefined, { context })
      case 503:
        return new ServiceUnavailableError('API', { context })
      default:
        return new ChessAnalyticsError(
          error.message || 'API request failed',
          'API_ERROR',
          error.status,
          { context }
        )
    }
  }

  // Handle unknown errors
  return new ChessAnalyticsError(
    error.message || 'Unknown API error',
    'UNKNOWN_API_ERROR',
    500,
    { context, originalError: error }
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

// All exports are already declared above with the class/function definitions
