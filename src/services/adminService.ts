import { config } from '../lib/config'
import { supabase } from '../lib/supabase'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { logger } from '../utils/logger'

const API_URL = config.getApi().baseUrl

export interface AdminCheckResponse {
  is_admin: boolean
}

export interface AdminUsersStats {
  total: number
  new_7d: number
  by_tier: Record<string, number>
}

export interface AdminActivityStats {
  games_total: number
  games_24h: number
  games_7d: number
  analyses_total: number
  analyses_24h: number
  analyses_7d: number
  active_users_7d: number
  active_users_30d: number
}

export interface AdminQueueStats {
  total_jobs?: number
  pending?: number
  running?: number
  completed?: number
  failed?: number
  cancelled?: number
  active_workers?: number
  [key: string]: unknown
}

export interface AdminAiStatus {
  available: boolean
  enabled: boolean
  model: string | null
}

export interface AdminSystemStats {
  stockfish_available: boolean
  database_connected: boolean
  ai: AdminAiStatus
  memory: Record<string, unknown>
  caches: Array<Record<string, unknown>> | Record<string, unknown>
  engine_pool: Record<string, unknown>
}

export interface AdminSubscriptionsStats {
  paying_active: number
  by_status: Record<string, number>
  paying_by_tier: Record<string, number>
}

export interface AdminOverviewResponse {
  generated_at: string
  users: Partial<AdminUsersStats>
  activity: Partial<AdminActivityStats>
  queue: AdminQueueStats
  system: Partial<AdminSystemStats>
  subscriptions: Partial<AdminSubscriptionsStats>
  errors: string[]
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export interface AdminUserRow {
  id: string
  email: string | null
  account_tier: string | null
  subscription_status: string | null
  chess_com_username: string | null
  lichess_username: string | null
  primary_platform: string | null
  created_at: string | null
  last_active_at: string | null
}

export interface AdminUsersResponse {
  users: AdminUserRow[]
  total: number
  limit: number
  offset: number
}

export const AdminService = {
  async check(): Promise<boolean> {
    try {
      const headers = await authHeaders()
      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/admin/check`,
        { method: 'GET', headers },
        TIMEOUT_CONFIG.DEFAULT
      )
      if (!response.ok) return false
      const json: AdminCheckResponse = await response.json()
      return Boolean(json.is_admin)
    } catch (error) {
      logger.warn('AdminService.check failed:', error)
      return false
    }
  },

  async overview(): Promise<AdminOverviewResponse> {
    const headers = await authHeaders()
    const response = await fetchWithTimeout(
      `${API_URL}/api/v1/admin/overview`,
      { method: 'GET', headers },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Admin overview failed (${response.status}): ${detail}`)
    }
    return response.json()
  },

  async users(params: { limit?: number; offset?: number; search?: string } = {}): Promise<AdminUsersResponse> {
    const headers = await authHeaders()
    const qs = new URLSearchParams()
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.offset) qs.set('offset', String(params.offset))
    if (params.search) qs.set('search', params.search)
    const url = `${API_URL}/api/v1/admin/users${qs.toString() ? '?' + qs.toString() : ''}`
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Admin users failed (${response.status}): ${detail}`)
    }
    return response.json()
  },
}
