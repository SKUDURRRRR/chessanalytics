/**
 * Test Configuration Example
 * Copy this file to test-config.ts and customize with your test users
 */

export const TEST_CONFIG = {
  // Lichess test user (must be a real user with games)
  lichess: {
    username: 'Pakrovejas69', // Real Lichess username
    platform: 'lichess' as const,
  },

  // Chess.com test user (must be a real user with games)
  chesscom: {
    username: 'hikaru', // Real Chess.com username
    platform: 'chess.com' as const,
  },

  // Default test user
  default: {
    username: process.env.TEST_USER || 'Pakrovejas69',
    platform: (process.env.TEST_PLATFORM as 'lichess' | 'chess.com') || 'lichess',
  },

  // Timeouts (in milliseconds)
  timeouts: {
    pageLoad: 10000,
    import: 30000,
    analysis: 90000,
    navigation: 30000,
  },
};
