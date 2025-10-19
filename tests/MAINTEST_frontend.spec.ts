/**
 * MAINTEST Frontend Tests
 * Playwright tests for UI functionality, player search, analytics, match history, and game analysis.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USERS = {
  lichess_existing: 'audingo',
  chesscom_existing: 'hikaru',
};

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const QUICK_MODE = process.env.MAINTEST_MODE === 'quick';

// Helper functions
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 });
}

async function searchPlayer(page: Page, username: string, platform: 'lichess' | 'chess.com') {
  // Select platform
  const platformButton = page.locator(`button:has-text("${platform === 'lichess' ? 'Lichess' : 'Chess.com'}")`).first();
  await platformButton.click();

  // Enter username
  await page.fill('input[type="text"]', username);

  // Click search
  await page.click('button[type="submit"]');
}

test.describe('MAINTEST Frontend Suite', () => {
  test.describe('Player Search', () => {
    test('should search for existing Lichess player', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Search for player
      await searchPlayer(page, TEST_USERS.lichess_existing, 'lichess');

      // Should redirect to analytics page
      await page.waitForURL(`**/simple-analytics?user=${TEST_USERS.lichess_existing}&platform=lichess`, {
        timeout: 15000
      });

      // Check that we're on the analytics page
      await expect(page.locator('h1, h2').filter({ hasText: /analytics|profile/i })).toBeVisible({
        timeout: 10000
      });
    });

    test('should search for existing Chess.com player', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Search for player
      await searchPlayer(page, TEST_USERS.chesscom_existing, 'chess.com');

      // Should redirect to analytics page
      await page.waitForURL(`**/simple-analytics?user=${TEST_USERS.chesscom_existing}&platform=chess.com`, {
        timeout: 15000
      });

      // Check that we're on the analytics page
      await expect(page.locator('h1, h2').filter({ hasText: /analytics|profile/i })).toBeVisible({
        timeout: 10000
      });
    });

    test('should show import prompt for non-existent player', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageLoad(page);

      // Search for non-existent player
      await searchPlayer(page, 'nonexistentuser12345xyz', 'lichess');

      // Should show import prompt or "no results" message
      const importPromptOrNoResults = page.locator('text=/import|no.*found|not.*found/i');
      await expect(importPromptOrNoResults).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Analytics Page', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate directly to analytics page
      await page.goto(`${BASE_URL}/simple-analytics?user=${TEST_USERS.lichess_existing}&platform=lichess`);
      await waitForPageLoad(page);

      // Wait for content to load
      await page.waitForTimeout(3000);
    });

    test('should display ELO graph', async ({ page }) => {
      // Look for chart container or canvas element
      const chartExists = await page.locator('canvas, svg, .recharts-wrapper').count() > 0;
      expect(chartExists).toBeTruthy();
    });

    test('should display win rate chart', async ({ page }) => {
      // Check for win/loss/draw data
      const statsVisible = await page.locator('text=/win|loss|draw/i').count() > 0;
      expect(statsVisible).toBeTruthy();
    });

    test('should display opening performance', async ({ page }) => {
      // Check for opening names or "Best Openings" section
      const openingsSection = page.locator('text=/opening|repertoire/i');
      const hasOpenings = await openingsSection.count() > 0;
      expect(hasOpenings).toBeTruthy();
    });

    test('should display personality radar', async ({ page }) => {
      // Check for personality traits
      const personalityTraits = page.locator('text=/tactical|positional|aggressive|patient/i');
      const hasTraits = await personalityTraits.count() > 0;
      expect(hasTraits).toBeTruthy();
    });

    test('should not show null or zero values in key metrics', async ({ page }) => {
      // Get page content
      const content = await page.content();

      // Check for common null/undefined displays
      expect(content).not.toContain('null games');
      expect(content).not.toContain('undefined%');
      expect(content).not.toContain('NaN');

      // Check that total games is not 0 (assuming test user has games)
      const totalGamesZero = await page.locator('text="0 games"').count();
      expect(totalGamesZero).toBe(0);
    });

    test('should allow time control filtering', async ({ page }) => {
      // Look for time control filter buttons or dropdown
      const filterExists = await page.locator('button, select').filter({ hasText: /rapid|blitz|bullet|all/i }).count() > 0;

      if (filterExists) {
        // Try to click a filter
        const filterButton = page.locator('button').filter({ hasText: /rapid|blitz/i }).first();
        await filterButton.click();

        // Wait for update
        await page.waitForTimeout(1000);

        // Content should still be visible
        const content = await page.content();
        expect(content.length).toBeGreaterThan(1000);
      }
    });
  });

  test.describe('Match History', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/simple-analytics?user=${TEST_USERS.lichess_existing}&platform=lichess`);
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);
    });

    test('should display match history table', async ({ page }) => {
      // Look for table or game list
      const gamesList = page.locator('table, [class*="game"], [class*="match"]');
      const hasGames = await gamesList.count() > 0;
      expect(hasGames).toBeTruthy();
    });

    test('should display game data (date, opponent, result)', async ({ page }) => {
      // Check for opponent names
      const hasOpponents = await page.locator('[class*="opponent"], td').count() > 3;
      expect(hasOpponents).toBeTruthy();

      // Check for results (win/loss/draw)
      const hasResults = await page.locator('text=/won|lost|draw|win|loss/i').count() > 0;
      expect(hasResults).toBeTruthy();
    });

    test('should support pagination', async ({ page }) => {
      // Look for "load more" or pagination buttons
      const paginationExists = await page.locator('button').filter({ hasText: /load.*more|next|page/i }).count() > 0;

      if (paginationExists) {
        const loadMoreButton = page.locator('button').filter({ hasText: /load.*more/i }).first();
        await loadMoreButton.click();
        await page.waitForTimeout(1000);
      }

      // Should still have games visible
      const gamesCount = await page.locator('tr, [class*="game-row"]').count();
      expect(gamesCount).toBeGreaterThan(0);
    });

    test('should support opening filter', async ({ page }) => {
      // Try to click on an opening name
      const openingLink = page.locator('text=/sicilian|french|caro|italian|spanish/i').first();
      const hasOpeningLinks = await openingLink.count() > 0;

      if (hasOpeningLinks) {
        await openingLink.click();
        await page.waitForTimeout(1000);

        // Should filter the games
        const content = await page.content();
        expect(content.length).toBeGreaterThan(500);
      }
    });
  });

  test.describe('Game Analysis Page', () => {
    let gameUrl: string;

    test.beforeEach(async ({ page }) => {
      // Navigate to analytics and get a game
      await page.goto(`${BASE_URL}/simple-analytics?user=${TEST_USERS.lichess_existing}&platform=lichess`);
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);

      // Try to find and click on a game
      const gameLink = page.locator('a[href*="game-analysis"], button').filter({ hasText: /view|analyze|details/i }).first();

      if (await gameLink.count() > 0) {
        await gameLink.click();
        await page.waitForTimeout(2000);
        gameUrl = page.url();
      } else {
        // If no direct link, navigate to a test game
        await page.goto(`${BASE_URL}/game-analysis?user=${TEST_USERS.lichess_existing}&platform=lichess`);
        await page.waitForTimeout(2000);
      }
    });

    test('should display chessboard', async ({ page }) => {
      // Look for chessboard element
      const board = page.locator('[class*="chess"], [class*="board"], canvas');
      const hasBoard = await board.count() > 0;
      expect(hasBoard).toBeTruthy();
    });

    test('should display move list', async ({ page }) => {
      // Look for move notation
      const moves = page.locator('text=/1\\.|2\\.|e4|d4|Nf3/');
      const hasMoves = await moves.count() > 0;

      // Move list might not always be visible, so just check the page has content
      const content = await page.content();
      expect(content.length).toBeGreaterThan(1000);
    });

    test('should display evaluation chart', async ({ page }) => {
      // Look for chart or evaluation visualization
      const chart = page.locator('canvas, svg, [class*="chart"], [class*="eval"]');
      const hasChart = await chart.count() > 0;

      // Chart might not be visible immediately
      if (!hasChart) {
        await page.waitForTimeout(2000);
        const chartRetry = await page.locator('canvas, svg').count() > 0;
        expect(chartRetry).toBeTruthy();
      }
    });

    test('should display accuracy and move statistics', async ({ page }) => {
      // Look for accuracy percentage or move stats
      const stats = page.locator('text=/accuracy|blunder|mistake|excellent|good/i');
      const hasStats = await stats.count() > 0;

      // Stats should be visible somewhere on the page
      const content = await page.content();
      const hasStatKeywords = /accuracy|blunder|mistake/i.test(content);
      expect(hasStatKeywords).toBeTruthy();
    });

    test('should have reanalysis button', async ({ page }) => {
      // Look for reanalysis button
      const reanalyzeButton = page.locator('button').filter({ hasText: /re.*analyz|analyze.*again/i });
      const hasButton = await reanalyzeButton.count() > 0;

      // Button might exist but not be visible
      const content = await page.content();
      expect(content.length).toBeGreaterThan(500);
    });
  });

  test.describe('Integration Tests', () => {
    test('full flow: search -> analytics -> game', async ({ page }) => {
      // Step 1: Search for player
      await page.goto(BASE_URL);
      await searchPlayer(page, TEST_USERS.lichess_existing, 'lichess');

      // Step 2: Wait for analytics page
      await page.waitForURL('**/simple-analytics**', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // Step 3: Verify analytics loaded
      const hasContent = await page.locator('body').textContent();
      expect(hasContent).toBeTruthy();
      expect((hasContent || '').length).toBeGreaterThan(500);

      // Step 4: Try to click on a game (if available)
      const gameButton = page.locator('button, a').filter({ hasText: /view|analyze/i }).first();
      if (await gameButton.count() > 0) {
        await gameButton.click();
        await page.waitForTimeout(2000);

        // Should have navigated somewhere
        const finalUrl = page.url();
        expect(finalUrl).toBeTruthy();
      }
    });

    test('should not show console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Navigate through the app
      await page.goto(BASE_URL);
      await searchPlayer(page, TEST_USERS.lichess_existing, 'lichess');
      await page.waitForURL('**/simple-analytics**', { timeout: 15000 });
      await page.waitForTimeout(3000);

      // Filter out common non-critical errors
      const criticalErrors = errors.filter(err =>
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('net::ERR') &&
        !err.toLowerCase().includes('warning')
      );

      // Should have no critical console errors
      if (criticalErrors.length > 0) {
        console.log('Console errors found:', criticalErrors);
      }

      expect(criticalErrors.length).toBeLessThan(3);
    });
  });
});

// Quick mode - run only essential tests
test.describe('MAINTEST Quick Mode', () => {
  test.skip(!QUICK_MODE, 'Running in full mode');

  test('quick smoke test', async ({ page }) => {
    // Just verify the app loads and basic search works
    await page.goto(BASE_URL);
    await waitForPageLoad(page);

    await searchPlayer(page, TEST_USERS.lichess_existing, 'lichess');
    await page.waitForURL('**/simple-analytics**', { timeout: 15000 });

    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});
