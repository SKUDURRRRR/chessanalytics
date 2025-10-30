// Security utilities for input validation and sanitization
import { z } from 'zod'

// ============================================================================
// ZOD VALIDATION SCHEMAS (RECOMMENDED)
// ============================================================================

/**
 * User ID validation schema
 * - Alphanumeric characters, underscores, hyphens, and dots only
 * - 1-100 characters
 */
export const userIdSchema = z
  .string()
  .min(1, 'User ID is required')
  .max(100, 'User ID must be 100 characters or less')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'User ID can only contain letters, numbers, underscores, hyphens, and dots')

/**
 * Platform validation schema
 * - Must be either 'lichess' or 'chess.com'
 */
export const platformSchema = z.enum(['lichess', 'chess.com'], {
  errorMap: () => ({ message: 'Platform must be either "lichess" or "chess.com"' })
})

/**
 * Game ID validation schema
 * - Alphanumeric characters, underscores, and hyphens only
 * - 1-100 characters
 */
export const gameIdSchema = z
  .string()
  .min(1, 'Game ID is required')
  .max(100, 'Game ID must be 100 characters or less')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Game ID can only contain letters, numbers, underscores, and hyphens')

/**
 * Comprehensive input validation schemas
 */
export const validationSchemas = {
  userId: userIdSchema,
  platform: platformSchema,
  gameId: gameIdSchema,

  /** Analysis request validation */
  analysisRequest: z.object({
    userId: userIdSchema,
    platform: platformSchema,
    limit: z.number().int().min(1).max(100).optional(),
  }),

  /** Game request validation */
  gameRequest: z.object({
    userId: userIdSchema,
    platform: platformSchema,
    gameId: gameIdSchema,
  }),
} as const

/**
 * Validate input using Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and parsed data
 * @throws ZodError if validation fails
 */
export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Safe validation that returns result object instead of throwing
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success status and either data or error
 */
export function safeValidateInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}


// Normalize user identifiers consistently across services
export function normalizeUserId(userId: string, platform: 'lichess' | 'chess.com'): string {
  const trimmed = userId.trim()
  return platform === 'chess.com' ? trimmed.toLowerCase() : trimmed
}

// ============================================================================
// LEGACY FUNCTIONS (DEPRECATED - Use Zod schemas instead)
// ============================================================================

/**
 * @deprecated Use Zod validation with userIdSchema, platformSchema, etc. instead
 * This provides weak security compared to proper Zod validation with Supabase's parameterized queries
 *
 * SQL injection prevention (legacy)
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/['";\\]/g, '') // Remove quotes and backslashes
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .replace(/\*\//g, '') // Remove block comments
    .trim()
}

/**
 * @deprecated Use Zod validation with appropriate schemas instead
 *
 * Validate database query parameters (legacy)
 */
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
