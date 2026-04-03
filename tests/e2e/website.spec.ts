import { test, expect } from '@playwright/test';

test.describe('Jernkorset Website E2E Tests', () => {

  test.describe('Letter List Page', () => {

    test('should load the home page with letter list', async ({ page }) => {
      await page.goto('/');

      // Should show page title
      await expect(page.getByRole('heading', { name: /letters/i })).toBeVisible();

      // Should show the table with letters
      await expect(page.locator('table')).toBeVisible();

      // Should have table headers (English names)
      await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /place/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /sender/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /recipient/i })).toBeVisible();
    });

    test('should display letters in the table', async ({ page }) => {
      await page.goto('/');

      // Wait for table data to load
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });

      // Should have rows (pagination is 10)
      const rows = page.locator('[data-testid="letter-row"]');
      expect(await rows.count()).toBeGreaterThanOrEqual(10);
    });

    test('should navigate to letter detail when clicking date', async ({ page }) => {
      await page.goto('/');

      // Wait for table to load
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });

      // Click on the first letter's date link (button with date)
      const firstDateLink = page.locator('[data-testid="letter-row"]').first().locator('button');
      await firstDateLink.click();

      // Should navigate to letter detail page
      await expect(page).toHaveURL(/\/letters\/\d+/);
    });

    test('should show pagination for many letters', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });

      // Should have pagination
      await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    });
  });

  test.describe('Letter Detail Page', () => {

    test('should display letter with sender and recipient', async ({ page }) => {
      await page.goto('/letters/1');

      // Wait for content to load
      await page.waitForLoadState('networkidle');

      // Should show sender and recipient data
      await expect(page.locator('[data-testid="letter-sender"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="letter-recipient"]')).toBeVisible();

      // Should show the labels "Fra" and "Til"
      await expect(page.getByText('Fra', { exact: true })).toBeVisible();
      await expect(page.getByText('Til', { exact: true })).toBeVisible();
    });

    test('should display navigation buttons', async ({ page }) => {
      await page.goto('/letters/5');
      await page.waitForLoadState('networkidle');

      // Should have Previous and Next buttons (in Danish: Forrige and Næste)
      await expect(page.getByRole('button', { name: /previous|forrige/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next|næste/i })).toBeVisible();
    });

    test('should navigate to next letter', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Click next button
      await page.getByRole('button', { name: /next|næste/i }).click();

      // Should navigate to letter 2
      await expect(page).toHaveURL('/letters/2');
    });

    test('should navigate to previous letter', async ({ page }) => {
      await page.goto('/letters/5');
      await page.waitForLoadState('networkidle');

      // Click previous button
      await page.getByRole('button', { name: /previous|forrige/i }).click();

      // Should navigate to letter 4
      await expect(page).toHaveURL('/letters/4');
    });

    test('should disable previous button on first letter', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Previous button should be disabled
      const prevButton = page.getByRole('button', { name: /previous|forrige/i });
      await expect(prevButton).toBeDisabled();
    });

    test('should show text mode toggle', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Should have Original / Moderne dansk toggle (ADR-041)
      await expect(page.locator('[data-testid="text-mode-toggle"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Original' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Moderne dansk' })).toBeVisible();
    });

    test('should display letter text content', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Letter should contain text - check for the content area
      await expect(page.locator('[data-testid="letter-text"]')).toBeVisible({ timeout: 10000 });

      // Letter text should be present (check page has significant content)
      const content = await page.content();
      expect(content).toContain('Trine');
    });

    test('should load different letters correctly', async ({ page }) => {
      // Test letter 1
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Get some identifying content from letter 1
      const letter1Url = page.url();
      expect(letter1Url).toContain('/letters/1');

      // Test letter 10
      await page.goto('/letters/10');
      await page.waitForLoadState('networkidle');

      const letter10Url = page.url();
      expect(letter10Url).toContain('/letters/10');
    });
  });

  test.describe('Moderne Sprog Toggle (ADR-041)', () => {

    test('should show toggle with Original active by default', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      const toggle = page.locator('[data-testid="text-mode-toggle"]');
      await expect(toggle).toBeVisible();

      // Original button should have active styling (bg-ink)
      const originalBtn = page.getByRole('button', { name: 'Original' });
      await expect(originalBtn).toHaveClass(/bg-ink/);
    });

    test('should switch text when clicking Moderne dansk', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Capture original text
      const letterText = page.locator('[data-testid="letter-text"]');
      const originalContent = await letterText.innerHTML();

      // Click Moderne dansk
      await page.getByRole('button', { name: 'Moderne dansk' }).click();

      // Text should change
      const modernContent = await letterText.innerHTML();
      expect(modernContent).not.toBe(originalContent);

      // Click back to Original
      await page.getByRole('button', { name: 'Original' }).click();
      const restoredContent = await letterText.innerHTML();
      expect(restoredContent).toBe(originalContent);
    });

    test('should persist toggle state across navigation', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Switch to modern
      await page.getByRole('button', { name: 'Moderne dansk' }).click();

      // Navigate to next letter
      await page.getByRole('button', { name: /next|næste/i }).click();
      await expect(page).toHaveURL('/letters/2');
      await page.waitForLoadState('networkidle');

      // Moderne dansk should still be active
      const modernBtn = page.getByRole('button', { name: 'Moderne dansk' });
      await expect(modernBtn).toHaveClass(/bg-ink/);
    });
  });

  test.describe('Navigation and Routing', () => {

    test('should handle direct URL navigation to letter', async ({ page }) => {
      await page.goto('/letters/100');
      await page.waitForLoadState('networkidle');

      // Should load letter 100 - sender should be visible
      await expect(page.locator('[data-testid="letter-sender"]')).toBeVisible({ timeout: 10000 });
    });

    test('should handle browser back navigation', async ({ page }) => {
      // Start at home
      await page.goto('/');
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });

      // Navigate to a letter
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();

      // Should be back at home
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Error Handling', () => {

    test('should handle non-existent letter gracefully', async ({ page }) => {
      // Non-existent letter should show "Letter not found" message
      const response = await page.goto('/letters/99999');

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check page content - should either show error or empty state
      const content = await page.content();
      // Page rendered something (didn't completely crash)
      expect(content.length).toBeGreaterThan(100);
    });

    test('should handle invalid letter ID format', async ({ page }) => {
      // Invalid letter ID should be handled gracefully
      await page.goto('/letters/invalid');

      // Wait for page to attempt to load
      await page.waitForTimeout(2000);

      // Check page content
      const content = await page.content();
      // Page rendered something (didn't completely crash)
      expect(content.length).toBeGreaterThan(100);
    });
  });

  test.describe('Responsive Design', () => {

    test('should be usable on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Page should still be functional
      await expect(page.getByRole('heading', { name: /letters/i })).toBeVisible();
    });

    test('should be usable on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Letter sender should be visible
      await expect(page.locator('[data-testid="letter-sender"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Data Integrity', () => {

    test('should display letters in table', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });

      // Check row count
      const rows = page.locator('[data-testid="letter-row"]');
      const rowCount = await rows.count();

      // Should have letters
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should show letter text on detail page', async ({ page }) => {
      await page.goto('/letters/1');
      await page.waitForLoadState('networkidle');

      // Letter text should be present
      const pageContent = await page.content();
      expect(pageContent.length).toBeGreaterThan(1000);
    });

    test('should display sender name Peter Mærsk', async ({ page }) => {
      await page.goto('/letters/1');

      // Wait for the sender to appear (indicates letter is loaded)
      await page.waitForSelector('[data-testid="letter-sender"]', { timeout: 10000 });

      // First letter is from Peter Mærsk - check page content
      const content = await page.content();
      expect(content).toContain('Peter');
    });
  });

  test.describe('Performance', () => {

    test('should load letter list within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForSelector('[data-testid="letter-row"]', { timeout: 10000 });
      const loadTime = Date.now() - startTime;

      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test('should load letter detail within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/letters/1');
      await page.waitForSelector('[data-testid="letter-sender"]', { timeout: 10000 });
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
