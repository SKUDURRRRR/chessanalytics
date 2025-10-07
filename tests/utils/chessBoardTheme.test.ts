import { describe, it, expect } from 'vitest'
import { getDarkChessBoardTheme, DARK_CHESS_BOARD_THEME, HIGH_CONTRAST_DARK_THEME, MINIMAL_DARK_THEME } from '../../src/utils/chessBoardTheme'

describe('chessBoardTheme', () => {
  describe('getDarkChessBoardTheme', () => {
    it('should return default theme when no theme specified', () => {
      const theme = getDarkChessBoardTheme()
      expect(theme).toEqual(DARK_CHESS_BOARD_THEME)
    })

    it('should return default theme when "default" specified', () => {
      const theme = getDarkChessBoardTheme('default')
      expect(theme).toEqual(DARK_CHESS_BOARD_THEME)
    })

    it('should return high contrast theme when "high-contrast" specified', () => {
      const theme = getDarkChessBoardTheme('high-contrast')
      expect(theme).toEqual(HIGH_CONTRAST_DARK_THEME)
    })

    it('should return minimal theme when "minimal" specified', () => {
      const theme = getDarkChessBoardTheme('minimal')
      expect(theme).toEqual(MINIMAL_DARK_THEME)
    })
  })

  describe('theme configurations', () => {
    it('should have proper dark square styling', () => {
      expect(DARK_CHESS_BOARD_THEME.customDarkSquareStyle).toHaveProperty('backgroundColor')
      expect(DARK_CHESS_BOARD_THEME.customDarkSquareStyle).toHaveProperty('border')
    })

    it('should have proper light square styling', () => {
      expect(DARK_CHESS_BOARD_THEME.customLightSquareStyle).toHaveProperty('backgroundColor')
      expect(DARK_CHESS_BOARD_THEME.customLightSquareStyle).toHaveProperty('border')
    })

    it('should have proper board styling', () => {
      expect(DARK_CHESS_BOARD_THEME.customBoardStyle).toHaveProperty('borderRadius')
      expect(DARK_CHESS_BOARD_THEME.customBoardStyle).toHaveProperty('boxShadow')
    })

    it('should have proper notation styling', () => {
      expect(DARK_CHESS_BOARD_THEME.customNotationStyle).toHaveProperty('color')
      expect(DARK_CHESS_BOARD_THEME.customNotationStyle).toHaveProperty('fontSize')
    })
  })

  describe('theme variations', () => {
    it('should have different colors for different themes', () => {
      const defaultTheme = getDarkChessBoardTheme('default')
      const highContrastTheme = getDarkChessBoardTheme('high-contrast')
      const minimalTheme = getDarkChessBoardTheme('minimal')

      expect(defaultTheme.customDarkSquareStyle.backgroundColor).not.toBe(
        highContrastTheme.customDarkSquareStyle.backgroundColor
      )
      expect(defaultTheme.customDarkSquareStyle.backgroundColor).not.toBe(
        minimalTheme.customDarkSquareStyle.backgroundColor
      )
    })
  })
})
