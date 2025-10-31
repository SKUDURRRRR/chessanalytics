/**
 * Development-only logger utility
 * Automatically silences console output in production builds
 */

const isDev = import.meta.env.DEV;

/**
 * Logger utility that only outputs to console in development mode
 * In production, all logging is silenced to prevent:
 * - Exposing sensitive data in browser console
 * - Performance overhead from logging
 * - Console clutter in production logs
 */
export const logger = {
  /**
   * Log general information (development only)
   * @param args - Arguments to log
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log error messages (development only)
   * @param args - Arguments to log
   */
  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    }
  },

  /**
   * Log warning messages (development only)
   * @param args - Arguments to log
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log debug information (development only)
   * @param args - Arguments to log
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log informational messages (development only)
   * @param args - Arguments to log
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use named export `logger` instead
 */
export default logger;
