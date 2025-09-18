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
  supabaseAnonKey !== 'your-anon-key'

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
    console.log('✅ Creating Supabase client')
    globalThis.__supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  } else {
    console.warn('⚠️ Supabase credentials not configured. Using mock client.')

    // Mock data for development
    const mockProfiles = [
      {
        id: '1',
        user_id: 'magnuscarlsen',
        platform: 'lichess',
        display_name: 'Magnus Carlsen',
        last_accessed: new Date().toISOString(),
        total_games: 1500,
        current_rating: 2850,
        win_rate: 0.65,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        user_id: 'hikaru',
        platform: 'chess.com',
        display_name: 'Hikaru Nakamura',
        last_accessed: new Date().toISOString(),
        total_games: 2000,
        current_rating: 2800,
        win_rate: 0.7,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        user_id: 'e4vaziuojam',
        platform: 'chess.com',
        display_name: 'e4vaziuojam',
        last_accessed: new Date().toISOString(),
        total_games: 19,
        current_rating: 1200,
        win_rate: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    // Create a mock client for development
    globalThis.__supabaseClient = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: (tableName: string) => ({
        select: (_columns?: string) => ({
          eq: (_column: string, _value: any) => ({
            eq: (_column2: string, _value2: any) => ({
              single: () => {
                if (tableName === 'user_profiles') {
                  const found = mockProfiles.find(
                    profile =>
                      profile[_column as keyof typeof profile] === _value &&
                      profile[_column2 as keyof typeof profile] === _value2
                  )
                  if (found) {
                    return Promise.resolve({ data: found, error: null })
                  } else {
                    return Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'No rows returned' },
                    })
                  }
                }
                return Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116', message: 'No rows returned' },
                })
              },
              maybeSingle: () => {
                if (tableName === 'user_profiles') {
                  const found = mockProfiles.find(
                    profile =>
                      profile[_column as keyof typeof profile] === _value &&
                      profile[_column2 as keyof typeof profile] === _value2
                  )
                  return Promise.resolve({ data: found || null, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              },
              order: (_column: string, _options?: any) => ({
                limit: (_count: number) => {
                  if (tableName === 'user_profiles') {
                    const filtered = mockProfiles.filter(
                      profile => profile[_column as keyof typeof profile] === _value
                    )
                    return Promise.resolve({ data: filtered, error: null })
                  }
                  return Promise.resolve({ data: [], error: null })
                },
              }),
            }),
            single: () => {
              if (tableName === 'user_profiles') {
                const found = mockProfiles.find(
                  profile => profile[_column as keyof typeof profile] === _value
                )
                if (found) {
                  return Promise.resolve({ data: found, error: null })
                } else {
                  return Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116', message: 'No rows returned' },
                  })
                }
              }
              return Promise.resolve({
                data: null,
                error: { code: 'PGRST116', message: 'No rows returned' },
              })
            },
            maybeSingle: () => {
              if (tableName === 'user_profiles') {
                const found = mockProfiles.find(
                  profile => profile[_column as keyof typeof profile] === _value
                )
                return Promise.resolve({ data: found || null, error: null })
              }
              return Promise.resolve({ data: null, error: null })
            },
            order: (_column: string, _options?: any) => ({
              limit: (_count: number) => {
                if (tableName === 'user_profiles') {
                  const filtered = mockProfiles.filter(
                    profile => profile[_column as keyof typeof profile] === _value
                  )
                  return Promise.resolve({ data: filtered, error: null })
                }
                return Promise.resolve({ data: [], error: null })
              },
            }),
          }),
          order: (_column: string, _options?: any) => ({
            limit: (_count: number) => {
              if (tableName === 'user_profiles') {
                return Promise.resolve({ data: mockProfiles.slice(0, _count), error: null })
              }
              return Promise.resolve({ data: [], error: null })
            },
          }),
          limit: (_count: number) => {
            if (tableName === 'user_profiles') {
              return Promise.resolve({ data: mockProfiles.slice(0, _count), error: null })
            }
            return Promise.resolve({ data: [], error: null })
          },
        }),
        insert: (_data: any) => ({
          select: (_columns?: string) => ({
            single: () => {
              if (tableName === 'user_profiles') {
                // Create a mock profile
                const newProfile = {
                  id: Date.now().toString(),
                  user_id: _data.user_id,
                  platform: _data.platform,
                  display_name: _data.display_name || _data.user_id,
                  current_rating: _data.current_rating || 1200,
                  total_games: _data.total_games || 0,
                  win_rate: _data.win_rate || 0,
                  last_accessed: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
                // Add to mock data
                mockProfiles.push(newProfile)
                return Promise.resolve({ data: newProfile, error: null })
              }
              return Promise.resolve({ data: null, error: null })
            },
          }),
        }),
        update: (_data: any) => ({
          eq: (_column: string, _value: any) => ({
            eq: (_column2: string, _value2: any) => Promise.resolve({ data: null, error: null }),
          }),
        }),
        upsert: (_data: any) => {
          if (tableName === 'games' || tableName === 'games_pgn') {
            return Promise.resolve({ data: null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
        delete: () => ({
          eq: (_column: string, _value: any) => ({
            eq: (_column2: string, _value2: any) => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }
  }

  return globalThis.__supabaseClient
}

// Initialize the client
const supabase = createSupabaseClient()

export { supabase }
