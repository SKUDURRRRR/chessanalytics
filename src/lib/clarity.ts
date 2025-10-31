/**
 * Initialize Microsoft Clarity analytics
 * @param projectId - Your Clarity project ID from https://clarity.microsoft.com
 */
export function initializeClarity(projectId: string) {
  if (!projectId) {
    console.warn('Clarity project ID not provided')
    return
  }

  try {
    if (typeof window !== 'undefined') {
      // Clarity is loaded via script tag and available on window
      const clarityWindow = window as any
      if (clarityWindow.clarity) {
        clarityWindow.clarity('init', projectId)
        console.log('Microsoft Clarity initialized successfully')
      }
    }
  } catch (error) {
    console.error('Failed to initialize Microsoft Clarity:', error)
  }
}

/**
 * Set a custom tag for Clarity session tracking
 * @param key - Tag key
 * @param value - Tag value
 */
export function setClarityTag(key: string, value: string | string[]) {
  try {
    if (typeof window !== 'undefined') {
      const clarityWindow = window as any
      if (clarityWindow.clarity) {
        clarityWindow.clarity('set', key, value)
      }
    }
  } catch (error) {
    console.error('Failed to set Clarity tag:', error)
  }
}

/**
 * Identify a user in Clarity
 * @param userId - Unique user identifier
 * @param sessionId - Optional session identifier
 * @param pageId - Optional page identifier
 */
export function identifyUser(userId: string, sessionId?: string, pageId?: string) {
  try {
    if (typeof window !== 'undefined') {
      const clarityWindow = window as any
      if (clarityWindow.clarity) {
        clarityWindow.clarity('identify', userId, sessionId, pageId)
      }
    }
  } catch (error) {
    console.error('Failed to identify user in Clarity:', error)
  }
}

/**
 * Upgrade the current session to a more detailed recording
 * @param reason - Reason for upgrading (e.g., 'error', 'checkout')
 */
export function upgradeSession(reason: string) {
  try {
    if (typeof window !== 'undefined') {
      const clarityWindow = window as any
      if (clarityWindow.clarity) {
        clarityWindow.clarity('upgrade', reason)
      }
    }
  } catch (error) {
    console.error('Failed to upgrade Clarity session:', error)
  }
}
