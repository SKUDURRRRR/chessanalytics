// Environment variable validation with Zod
import { z } from 'zod'

// Define the environment schema
const envSchema = z.object({
  // Frontend environment variables
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_ANALYSIS_API_URL: z.string().url('VITE_ANALYSIS_API_URL must be a valid URL'),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional development variables
  VITE_DEBUG: z.string().optional().transform(val => val === 'true'),
  VITE_LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
})

// Validate environment variables
function validateEnv() {
  try {
    const env = envSchema.parse(import.meta.env)
    return { success: true, data: env, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: any) => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n')
      
      console.error('Environment validation failed:')
      console.error(errorMessages)
      
      return { 
        success: false, 
        data: null, 
        error: `Environment validation failed:\n${errorMessages}` 
      }
    }
    
    return { 
      success: false, 
      data: null, 
      error: `Unknown environment validation error: ${error}` 
    }
  }
}

// Export validated environment
const envValidation = validateEnv()

if (!envValidation.success) {
  throw new Error(envValidation.error || 'Environment validation failed')
}

export const env = envValidation.data!

// Type-safe environment access
export type Env = z.infer<typeof envSchema>

// Helper functions for environment checks
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

// Security helpers
export const isSecureEnvironment = () => {
  // Check if we're using placeholder values (security risk)
  const hasPlaceholderCredentials = 
    env.VITE_SUPABASE_URL === 'https://your-project.supabase.co' ||
    env.VITE_SUPABASE_ANON_KEY === 'your-anon-key-here'
  
  if (hasPlaceholderCredentials) {
    console.warn('Warning: Using placeholder credentials. Please configure your environment variables.')
    return false
  }
  
  // Check if we're using HTTPS in production
  if (isProduction && !env.VITE_SUPABASE_URL.startsWith('https://')) {
    console.warn('Warning: Using HTTP in production. Consider using HTTPS for security.')
    return false
  }
  
  return true
}

// Log environment status
if (isDevelopment) {
  console.log('Environment loaded', {
    NODE_ENV: env.NODE_ENV,
    LOG_LEVEL: env.VITE_LOG_LEVEL,
    DEBUG: env.VITE_DEBUG,
    SECURE: isSecureEnvironment()
  })
}
