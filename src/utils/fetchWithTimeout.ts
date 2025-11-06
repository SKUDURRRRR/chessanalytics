/**
 * Fetch with timeout utility
 * Wraps standard fetch() with configurable timeout to prevent hanging requests
 */

/**
 * Performs a fetch request with a configurable timeout.
 * Automatically aborts the request if it takes longer than the specified timeout.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeout - Timeout in milliseconds (default: 30000ms = 30 seconds)
 * @returns Promise resolving to the Response object
 * @throws Error if the request times out or fails
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout(
 *   'https://api.example.com/data',
 *   { method: 'GET' },
 *   10000 // 10 second timeout
 * );
 * const data = await response.json();
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout: The request took longer than ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Configuration for different timeout scenarios
 */
export const TIMEOUT_CONFIG = {
  /** Standard API calls (30 seconds) */
  DEFAULT: 30000,
  /** Quick operations like existence checks (5 seconds) */
  QUICK: 5000,
  /** Long-running operations like game analysis (2 minutes) */
  LONG: 120000,
  /** Deep analysis operations (5 minutes) - can take longer for complex games */
  DEEP_ANALYSIS: 300000,
  /** External API calls (1 minute) */
  EXTERNAL: 60000,
} as const;
