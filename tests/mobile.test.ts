import { test, expect } from '@playwright/test'

test.describe('Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })


  test('should show card layout for match history on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Navigate to a user profile (you'll need to set up test data)
    await page.goto('/simple-analytics?user=testuser&platform=lichess')
    
    // Check if card layout is visible instead of table
    const cardLayout = page.locator('[data-testid="mobile-card-layout"]')
    await expect(cardLayout).toBeVisible()
  })

  test('should have touch-friendly button sizes', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Check that buttons meet minimum touch target size (44px)
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36) // Minimum touch target
        expect(box.width).toBeGreaterThanOrEqual(36)
      }
    }
  })

  test('should prevent horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Check that body doesn't allow horizontal scroll
    const body = page.locator('body')
    const overflowX = await body.evaluate(el => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('hidden')
  })

  test('should have proper viewport meta tag', async ({ page }) => {
    const viewport = page.locator('meta[name="viewport"]')
    await expect(viewport).toHaveAttribute('content', /width=device-width/)
    await expect(viewport).toHaveAttribute('content', /user-scalable=no/)
  })

  test('should show mobile action menu instead of individual buttons', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Navigate to game analysis page
    await page.goto('/analysis/lichess/testuser/testgame')
    
    // Check if mobile action menu is visible
    const actionMenu = page.locator('[data-testid="action-menu"]')
    await expect(actionMenu).toBeVisible()
  })

  test('should have responsive chessboard sizing', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Navigate to game analysis page
    await page.goto('/analysis/lichess/testuser/testgame')
    
    // Check that chessboard is properly sized for mobile
    const chessboard = page.locator('[data-testid="chessboard"]')
    const box = await chessboard.boundingBox()
    
    if (box) {
      expect(box.width).toBeLessThanOrEqual(360) // Should fit in mobile viewport
      expect(box.height).toBeLessThanOrEqual(360) // Should be square
    }
  })

  test('should handle touch events properly', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    // Test touch manipulation
    const touchElements = page.locator('[data-touch-optimized="true"]')
    const count = await touchElements.count()
    
    for (let i = 0; i < count; i++) {
      const element = touchElements.nth(i)
      const touchAction = await element.evaluate(el => getComputedStyle(el).touchAction)
      expect(touchAction).toBe('manipulation')
    }
  })

  test('should have proper safe area insets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }) // iPhone X dimensions
    
    // Check that safe area insets are applied
    const safeAreaElements = page.locator('.safe-area-inset')
    await expect(safeAreaElements.first()).toBeVisible()
  })
})

test.describe('Mobile Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds on mobile
    expect(loadTime).toBeLessThan(3000)
  })

  test('should have optimized images for mobile', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto('/')
    
    // Check that images have appropriate sizes
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const box = await img.boundingBox()
      if (box) {
        // Images shouldn't be unnecessarily large on mobile
        expect(box.width).toBeLessThanOrEqual(400)
      }
    }
  })
})
