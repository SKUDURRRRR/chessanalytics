// Security utilities for input validation and sanitization
import { z } from 'zod'

// Input validation schemas
export const userIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid user ID format')
export const platformSchema = z.enum(['lichess', 'chess.com'])
export const gameIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid game ID format')


// Normalize user identifiers consistently across services
export function normalizeUserId(userId: string, platform: 'lichess' | 'chess.com'): string {
  const trimmed = userId.trim()
  return platform === 'chess.com' ? trimmed.toLowerCase() : trimmed
}
// SQL injection prevention
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .replace(/\*\//g, '') // Remove block comments
    .trim()
}

// Validate database query parameters
export function validateQueryParams(params: Record<string, any>): Record<string, any> {
  const validated: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      validated[key] = sanitizeInput(value)
    } else {
      validated[key] = value
    }
  }
  
  return validated
}

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const key = identifier
  const current = rateLimitMap.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (current.count >= maxRequests) {
    return false
  }
  
  current.count++
  return true
}
