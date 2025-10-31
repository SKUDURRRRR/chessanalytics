/**
 * Centralized Configuration System
 * Manages all application configuration values
 */

import { env } from './env'

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface ApiConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
  retryDelay: number
}

export interface DatabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
  maxConnections: number
  connectionTimeout: number
}

export interface AnalysisConfig {
  defaultDepth: number
  maxDepth: number
  defaultSkillLevel: number
  maxSkillLevel: number
  timeout: number
  batchSize: number
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto'
  language: string
  itemsPerPage: number
  maxItemsPerPage: number
  animationDuration: number
  debounceDelay: number
}

export interface SecurityConfig {
  enableCORS: boolean
  allowedOrigins: string[]
  maxRequestSize: number
  rateLimitRequests: number
  rateLimitWindow: number
  enableJWT: boolean
  jwtSecret?: string
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug'
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  maxLogSize: number
}

export interface FeatureFlags {
  enableDeepAnalysis: boolean
  enablePersonalityAnalysis: boolean
  enableRealTimeUpdates: boolean
  enableCaching: boolean
  enableOfflineMode: boolean
  enableAnalytics: boolean
  enableErrorReporting: boolean
}

// ============================================================================
// DEFAULT CONFIGURATION VALUES
// ============================================================================

// FIX: Use import.meta.env directly instead of validated env object
// The Zod validation in env.ts is stripping the value even though it exists
const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: (import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8002').replace(/\/$/, ''), // Remove trailing slash
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
}

const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  serviceRoleKey: undefined,
  maxConnections: 10,
  connectionTimeout: 10000 // 10 seconds
}

const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  defaultDepth: 15,
  maxDepth: 25,
  defaultSkillLevel: 20,
  maxSkillLevel: 20,
  timeout: 60000, // 60 seconds
  batchSize: 5
}

const DEFAULT_UI_CONFIG: UIConfig = {
  theme: 'auto',
  language: 'en',
  itemsPerPage: 20,
  maxItemsPerPage: 100,
  animationDuration: 300, // 300ms
  debounceDelay: 500 // 500ms
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableCORS: true,
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  rateLimitRequests: 100,
  rateLimitWindow: 60000, // 1 minute
  enableJWT: false, // Disabled for development
  jwtSecret: undefined
}

const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: env.VITE_LOG_LEVEL as LoggingConfig['level'] || 'info',
  enableConsole: true,
  enableRemote: false,
  remoteEndpoint: undefined,
  maxLogSize: 1000 // 1000 entries
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableDeepAnalysis: true,
  enablePersonalityAnalysis: true,
  enableRealTimeUpdates: false,
  enableCaching: true,
  enableOfflineMode: false,
  enableAnalytics: true,
  enableErrorReporting: false
}

// ============================================================================
// CONFIGURATION CLASS
// ============================================================================

class ConfigurationManager {
  private api: ApiConfig
  private database: DatabaseConfig
  private analysis: AnalysisConfig
  private ui: UIConfig
  private security: SecurityConfig
  private logging: LoggingConfig
  private features: FeatureFlags

  constructor() {
    this.api = { ...DEFAULT_API_CONFIG }
    this.database = { ...DEFAULT_DATABASE_CONFIG }
    this.analysis = { ...DEFAULT_ANALYSIS_CONFIG }
    this.ui = { ...DEFAULT_UI_CONFIG }
    this.security = { ...DEFAULT_SECURITY_CONFIG }
    this.logging = { ...DEFAULT_LOGGING_CONFIG }
    this.features = { ...DEFAULT_FEATURE_FLAGS }

    this.loadFromEnvironment()
    this.loadFromLocalStorage()
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // For now, use default values
    // Environment-specific configuration can be added later
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('chess-analytics-config')
      if (stored) {
        const config = JSON.parse(stored)

        // Merge with existing configuration
        this.ui = { ...this.ui, ...config.ui }
        this.features = { ...this.features, ...config.features }
      }
    } catch (error) {
      console.warn('Failed to load configuration from localStorage:', error)
    }
  }

  /**
   * Save configuration to localStorage
   */
  public saveToLocalStorage(): void {
    try {
      const config = {
        ui: this.ui,
        features: this.features
      }
      localStorage.setItem('chess-analytics-config', JSON.stringify(config))
    } catch (error) {
      console.warn('Failed to save configuration to localStorage:', error)
    }
  }

  /**
   * Get API configuration
   */
  public getApi(): Readonly<ApiConfig> {
    return { ...this.api }
  }

  /**
   * Get database configuration
   */
  public getDatabase(): Readonly<DatabaseConfig> {
    return { ...this.database }
  }

  /**
   * Get analysis configuration
   */
  public getAnalysis(): Readonly<AnalysisConfig> {
    return { ...this.analysis }
  }

  /**
   * Get UI configuration
   */
  public getUI(): Readonly<UIConfig> {
    return { ...this.ui }
  }

  /**
   * Get security configuration
   */
  public getSecurity(): Readonly<SecurityConfig> {
    return { ...this.security }
  }

  /**
   * Get logging configuration
   */
  public getLogging(): Readonly<LoggingConfig> {
    return { ...this.logging }
  }

  /**
   * Get feature flags
   */
  public getFeatures(): Readonly<FeatureFlags> {
    return { ...this.features }
  }

  /**
   * Update UI configuration
   */
  public updateUI(updates: Partial<UIConfig>): void {
    this.ui = { ...this.ui, ...updates }
    this.saveToLocalStorage()
  }

  /**
   * Update feature flags
   */
  public updateFeatures(updates: Partial<FeatureFlags>): void {
    this.features = { ...this.features, ...updates }
    this.saveToLocalStorage()
  }

  /**
   * Reset configuration to defaults
   */
  public reset(): void {
    this.api = { ...DEFAULT_API_CONFIG }
    this.database = { ...DEFAULT_DATABASE_CONFIG }
    this.analysis = { ...DEFAULT_ANALYSIS_CONFIG }
    this.ui = { ...DEFAULT_UI_CONFIG }
    this.security = { ...DEFAULT_SECURITY_CONFIG }
    this.logging = { ...DEFAULT_LOGGING_CONFIG }
    this.features = { ...DEFAULT_FEATURE_FLAGS }

    this.loadFromEnvironment()
    this.saveToLocalStorage()
  }

  /**
   * Get all configuration
   */
  public getAll(): {
    api: Readonly<ApiConfig>
    database: Readonly<DatabaseConfig>
    analysis: Readonly<AnalysisConfig>
    ui: Readonly<UIConfig>
    security: Readonly<SecurityConfig>
    logging: Readonly<LoggingConfig>
    features: Readonly<FeatureFlags>
  } {
    return {
      api: this.getApi(),
      database: this.getDatabase(),
      analysis: this.getAnalysis(),
      ui: this.getUI(),
      security: this.getSecurity(),
      logging: this.getLogging(),
      features: this.getFeatures()
    }
  }

  /**
   * Validate configuration
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate API configuration
    if (this.api.timeout <= 0) {
      errors.push('API timeout must be greater than 0')
    }
    if (this.api.retryAttempts < 0) {
      errors.push('API retry attempts must be non-negative')
    }

    // Validate analysis configuration
    if (this.analysis.defaultDepth <= 0 || this.analysis.defaultDepth > this.analysis.maxDepth) {
      errors.push('Invalid analysis depth configuration')
    }
    if (this.analysis.batchSize <= 0) {
      errors.push('Analysis batch size must be greater than 0')
    }

    // Validate UI configuration
    if (this.ui.itemsPerPage <= 0 || this.ui.itemsPerPage > this.ui.maxItemsPerPage) {
      errors.push('Invalid items per page configuration')
    }

    // Validate security configuration
    if (this.security.rateLimitRequests <= 0) {
      errors.push('Rate limit requests must be greater than 0')
    }
    if (this.security.rateLimitWindow <= 0) {
      errors.push('Rate limit window must be greater than 0')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// ============================================================================
// CONFIGURATION INSTANCE
// ============================================================================

export const config = new ConfigurationManager()

// ============================================================================
// CONFIGURATION HOOKS (for React components)
// ============================================================================

/**
 * Hook to access configuration in React components
 */
export function useConfig() {
  // Simplified version without React hooks for now
  return {
    ...config.getAll(),
    updateUI: config.updateUI.bind(config),
    updateFeatures: config.updateFeatures.bind(config),
    reset: config.reset.bind(config)
  }
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

export const CONSTANTS = {
  // API Constants
  API: {
    DEFAULT_TIMEOUT: 30000,
    MAX_TIMEOUT: 300000,
    DEFAULT_RETRY_ATTEMPTS: 3,
    MAX_RETRY_ATTEMPTS: 10,
    DEFAULT_RETRY_DELAY: 1000,
    MAX_RETRY_DELAY: 10000
  },

  // Analysis Constants
  ANALYSIS: {
    MIN_DEPTH: 1,
    MAX_DEPTH: 25,
    DEFAULT_DEPTH: 15,
    MIN_SKILL_LEVEL: 0,
    MAX_SKILL_LEVEL: 20,
    DEFAULT_SKILL_LEVEL: 20,
    MIN_BATCH_SIZE: 1,
    MAX_BATCH_SIZE: 100,
    DEFAULT_BATCH_SIZE: 5
  },

  // UI Constants
  UI: {
    MIN_ITEMS_PER_PAGE: 1,
    MAX_ITEMS_PER_PAGE: 1000,
    DEFAULT_ITEMS_PER_PAGE: 20,
    MIN_ANIMATION_DURATION: 0,
    MAX_ANIMATION_DURATION: 2000,
    DEFAULT_ANIMATION_DURATION: 300,
    MIN_DEBOUNCE_DELAY: 0,
    MAX_DEBOUNCE_DELAY: 5000,
    DEFAULT_DEBOUNCE_DELAY: 500
  },

  // Security Constants
  SECURITY: {
    MIN_RATE_LIMIT_REQUESTS: 1,
    MAX_RATE_LIMIT_REQUESTS: 10000,
    DEFAULT_RATE_LIMIT_REQUESTS: 100,
    MIN_RATE_LIMIT_WINDOW: 1000,
    MAX_RATE_LIMIT_WINDOW: 3600000,
    DEFAULT_RATE_LIMIT_WINDOW: 60000,
    MIN_REQUEST_SIZE: 1024,
    MAX_REQUEST_SIZE: 100 * 1024 * 1024,
    DEFAULT_REQUEST_SIZE: 10 * 1024 * 1024
  },

  // Logging Constants
  LOGGING: {
    MIN_LOG_SIZE: 100,
    MAX_LOG_SIZE: 10000,
    DEFAULT_LOG_SIZE: 1000
  }
} as const

// ============================================================================
// EXPORTS
// ============================================================================

export default config
export { ConfigurationManager }
