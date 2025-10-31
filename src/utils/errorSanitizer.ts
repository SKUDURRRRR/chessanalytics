/**
 * Error Sanitizer Utility
 * Sanitizes error messages to prevent exposing internal server details to users in production
 */

/**
 * Sanitize error messages for production to avoid exposing internal details
 * Logs the actual error for debugging while returning a user-friendly message
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred. Please try again.'
  }

  const errorMessage = error.message.toLowerCase()

  // Log the actual error for debugging
  console.error('Sanitized error:', error.message)

  // Check for specific error patterns and return user-friendly messages
  // Backend Python/module errors
  if (errorMessage.includes('no module named') ||
      errorMessage.includes('modulenotfounderror') ||
      errorMessage.includes('importerror') ||
      errorMessage.includes('cannot import')) {
    return 'We are experiencing technical difficulties. Please try again later.'
  }

  // Network/connectivity errors
  if (errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('getaddrinfo')) {
    return 'Cannot connect to server. Please check your internet connection.'
  }

  // Timeout errors
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('etimedout')) {
    return 'Request timed out. Please try again.'
  }

  // Rate limiting
  if (errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.'
  }

  // Not found errors
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'Resource not found. Please check your input and try again.'
  }

  // Authentication/authorization errors
  if (errorMessage.includes('unauthorized') ||
      errorMessage.includes('401') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('403')) {
    return 'Authentication error. Please log in again.'
  }

  // Generic server errors
  if (errorMessage.includes('server error') ||
      errorMessage.includes('internal error') ||
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('http error')) {
    return 'We are experiencing technical difficulties. Please try again later.'
  }

  // Database errors
  if (errorMessage.includes('database') ||
      errorMessage.includes('query') ||
      errorMessage.includes('sql') ||
      errorMessage.includes('connection pool')) {
    return 'Database temporarily unavailable. Please try again later.'
  }

  // Python/backend specific errors
  if (errorMessage.includes('traceback') ||
      errorMessage.includes('exception') ||
      errorMessage.includes('nonetype') ||
      errorMessage.includes('attributeerror') ||
      errorMessage.includes('keyerror') ||
      errorMessage.includes('valueerror')) {
    return 'We are experiencing technical difficulties. Please try again later.'
  }

  // If the error message looks safe (user-friendly), return it
  // Safe messages are:
  // - Short (< 100 chars)
  // - Don't contain technical jargon
  // - Don't contain stack trace indicators
  if (errorMessage.length < 100 &&
      !errorMessage.includes('error:') &&
      !errorMessage.includes('exception') &&
      !errorMessage.includes('traceback') &&
      !errorMessage.includes(':') && // Often indicates technical error format
      !errorMessage.includes('file ') &&
      !errorMessage.includes('line ')) {
    return error.message
  }

  // Default fallback for unknown errors
  return 'An error occurred. Please try again later.'
}

/**
 * Sanitize HTTP response errors
 * Extracts error message from response and sanitizes it
 */
export async function sanitizeHttpError(
  response: Response,
  context?: string
): Promise<string> {
  let errorMessage: string

  try {
    const errorText = await response.text()

    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.detail || errorJson.message || errorText
    } catch {
      errorMessage = errorText
    }
  } catch {
    errorMessage = response.statusText || 'Unknown error'
  }

  // Log the actual error with context
  console.error(`HTTP Error${context ? ` (${context})` : ''}:`, {
    status: response.status,
    message: errorMessage
  })

  // Return sanitized message based on status code
  if (response.status >= 500) {
    return 'We are experiencing technical difficulties. Please try again later.'
  } else if (response.status === 404) {
    return 'Resource not found. Please check your input.'
  } else if (response.status === 401 || response.status === 403) {
    return 'Authentication error. Please log in again.'
  } else if (response.status === 429) {
    return 'Too many requests. Please wait a moment and try again.'
  }

  // For 4xx errors, sanitize the message
  return sanitizeErrorMessage(new Error(errorMessage))
}
