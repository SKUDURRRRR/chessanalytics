/**
 * Dark theme configuration for chess boards to match the app's dark theme
 */

export const DARK_CHESS_BOARD_THEME = {
  // Dark squares - using a dark slate color that complements the app's dark theme
  customDarkSquareStyle: {
    backgroundColor: '#1e293b', // slate-800
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  // Light squares - using a lighter slate color for contrast
  customLightSquareStyle: {
    backgroundColor: '#334155', // slate-700
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  // Board container styling
  customBoardStyle: {
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  // Notation styling to match dark theme
  customNotationStyle: {
    color: '#cbd5e1', // slate-300
    fontSize: '12px',
    fontWeight: '500',
  },
  
  // Drop square highlighting
  customDropSquareStyle: {
    boxShadow: 'inset 0 0 1px 6px rgba(59, 130, 246, 0.6)', // blue-500 with opacity
  },
  
  // Premove square styling
  customPremoveDarkSquareStyle: {
    backgroundColor: '#dc2626', // red-600
    opacity: 0.8,
  },
  
  customPremoveLightSquareStyle: {
    backgroundColor: '#ef4444', // red-500
    opacity: 0.8,
  },
} as const

/**
 * Alternative dark theme with more contrast
 */
export const HIGH_CONTRAST_DARK_THEME = {
  customDarkSquareStyle: {
    backgroundColor: '#0f172a', // slate-900
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },
  
  customLightSquareStyle: {
    backgroundColor: '#1e293b', // slate-800
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },
  
  customBoardStyle: {
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },
  
  customNotationStyle: {
    color: '#e2e8f0', // slate-200
    fontSize: '12px',
    fontWeight: '600',
  },
  
  customDropSquareStyle: {
    boxShadow: 'inset 0 0 1px 6px rgba(59, 130, 246, 0.8)',
  },
  
  customPremoveDarkSquareStyle: {
    backgroundColor: '#dc2626',
    opacity: 0.9,
  },
  
  customPremoveLightSquareStyle: {
    backgroundColor: '#ef4444',
    opacity: 0.9,
  },
} as const

/**
 * Minimal dark theme with subtle styling
 */
export const MINIMAL_DARK_THEME = {
  customDarkSquareStyle: {
    backgroundColor: '#1f2937', // gray-800
  },
  
  customLightSquareStyle: {
    backgroundColor: '#374151', // gray-700
  },
  
  customBoardStyle: {
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  
  customNotationStyle: {
    color: '#9ca3af', // gray-400
    fontSize: '11px',
  },
  
  customDropSquareStyle: {
    boxShadow: 'inset 0 0 1px 4px rgba(59, 130, 246, 0.5)',
  },
  
  customPremoveDarkSquareStyle: {
    backgroundColor: '#dc2626',
    opacity: 0.7,
  },
  
  customPremoveLightSquareStyle: {
    backgroundColor: '#ef4444',
    opacity: 0.7,
  },
} as const

/**
 * Get the recommended dark theme based on app preferences
 */
export function getDarkChessBoardTheme(theme: 'default' | 'high-contrast' | 'minimal' = 'default') {
  switch (theme) {
    case 'high-contrast':
      return HIGH_CONTRAST_DARK_THEME
    case 'minimal':
      return MINIMAL_DARK_THEME
    default:
      return DARK_CHESS_BOARD_THEME
  }
}
