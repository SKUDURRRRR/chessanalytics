import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_ANALYSIS_API_URL: 'http://localhost:8002',
  },
  writable: true,
})


const chainStub = {
  select: vi.fn(() => chainStub),
  eq: vi.fn(() => chainStub),
  not: vi.fn(() => chainStub),
  order: vi.fn(() => chainStub),
  limit: vi.fn(() => chainStub),
  update: vi.fn(() => chainStub),
  insert: vi.fn(() => chainStub),
  delete: vi.fn(() => chainStub),
  upsert: vi.fn(() => chainStub),
  single: vi.fn(async () => ({ data: null, error: null })),
  maybeSingle: vi.fn(async () => ({ data: null, error: { code: 'PGRST116' } })),
}

;(globalThis as any).__supabaseClient = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ data: null, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
  from: vi.fn(() => chainStub),
}

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock ResizeObserver for Recharts
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))