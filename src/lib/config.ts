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

}

// ============================================================================
// CONFIGURATION INSTANCE
// ============================================================================

export const config = new ConfigurationManager()

export default config
export { ConfigurationManager }
