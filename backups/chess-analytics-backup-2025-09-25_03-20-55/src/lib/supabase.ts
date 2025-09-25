import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Get Supabase credentials from validated environment variables
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

// Check if we have valid Supabase credentials (not placeholder values)
const hasValidCredentials =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key' &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key-here'

// Create a singleton instance to avoid multiple GoTrueClient instances
// Use a global variable to persist across hot module reloads
declare global {
  var __supabaseClient: any
}

function createSupabaseClient() {
  // Check if we already have a client in the global scope
  if (globalThis.__supabaseClient) {
    return globalThis.__supabaseClient
  }

  if (hasValidCredentials) {
    console.log('✅ Creating Supabase client with real credentials')
    globalThis.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } else {
    console.error('❌ Supabase credentials not properly configured. Please check your .env file.')
    throw new Error('Supabase credentials are required but not properly configured')
  }

  return globalThis.__supabaseClient
}

// Initialize the client
const supabase = createSupabaseClient()

export { supabase }
