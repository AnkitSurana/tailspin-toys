import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the correct title', async ({ page }) => {
    // Check that the page title is correct
    await expect(page).toHaveTitle('Tailspin Toys - Crowdfunding your new favorite game!');
  });

  test('should display the main heading', async ({ page }) => {
    // Check that the main page heading is present
    await expect(page.getByRole('heading', { name: 'Welcome to Tailspin Toys', exact: true })).toBeVisible();
  });

  test('should display the site branding in header', async ({ page }) => {
    // Check that the site branding is present in the header (no longer an h1)
    await expect(page.getByText('Tailspin Toys').first()).toBeVisible();
  });

  test('should display the welcome message', async ({ page }) => {
    // Check that the welcome message is present using more specific locator
    await expect(page.getByText('Find your next game! And maybe even back one! Explore our collection!')).toBeVisible();
  });

  test('filters games by category and clears the selection', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const strategy = page.getByLabel('Strategy', { exact: true });
    const initialCount = await cards.count();

    await expect(cards).toHaveCount(initialCount);
    await strategy.check();
    await expect(cards).toHaveCount(4);
    await expect(page.getByTestId('filter-results')).toHaveText('Showing 4 games');

    await page.getByTestId('filter-reset').click();
    await expect(cards).toHaveCount(initialCount);
    await expect(strategy).not.toBeChecked();
  });

  test('filters games by publisher and combines publisher with category', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const publisher = page.getByTestId('filter-publisher');

    await publisher.selectOption({ label: 'CodeForge Studios' });
    await expect(cards).toHaveCount(6);

    await page.getByLabel('Strategy', { exact: true }).check();
    await expect(cards).toHaveCount(1);
    await expect(page.getByTestId('filter-results')).toHaveText('Showing 1 game');
  });

  test('supports multiple categories with keyboard controls', async ({ page }) => {
    const cards = page.locator('[data-testid="game-card"]:not([hidden])');
    const strategy = page.getByLabel('Strategy', { exact: true });
    const puzzle = page.getByLabel('Puzzle', { exact: true });

    await strategy.focus();
    await expect(strategy).toBeFocused();
    await page.keyboard.press('Space');
    await puzzle.focus();
    await page.keyboard.press('Space');

    await expect(strategy).toBeChecked();
    await expect(puzzle).toBeChecked();
    await expect(cards).toHaveCount(8);
    await expect(page.getByTestId('filter-results')).toHaveText('Showing 8 games');
  });
});
