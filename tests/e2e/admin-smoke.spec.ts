import { test, expect } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000';

test.use({ baseURL: ADMIN_URL });

test.describe('Admin App Smoke Tests', () => {

  test.describe('Navigation', () => {

    test('should show nav with all four sections', async ({ page }) => {
      await page.goto('/');
      const nav = page.getByRole('navigation');
      await expect(nav.getByRole('link', { name: 'Breve' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Personer' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Billeder' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Steder' })).toBeVisible();
    });

    test('should highlight active nav link', async ({ page }) => {
      await page.goto('/personer');
      const link = page.getByRole('navigation').getByRole('link', { name: 'Personer' });
      await expect(link).toHaveClass(/bg-parchment/);
    });
  });

  test.describe('Breve (Letters) page', () => {

    test('should load letter list with table', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /letters/i })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /sender/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /recipient/i })).toBeVisible();
    });

    test('should show letter count', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/\d+ breve fra/)).toBeVisible();
    });

    test('should have clickable dates that navigate to detail', async ({ page }) => {
      await page.goto('/');
      // Click first letter date button
      const firstDateBtn = page.getByRole('row').nth(1).getByRole('button').first();
      await firstDateBtn.click();
      await expect(page).toHaveURL(/\/letters\/\d+/);
    });
  });

  test.describe('Personer page', () => {

    test('should load person list with table', async ({ page }) => {
      await page.goto('/personer');
      await expect(page.getByRole('heading', { name: 'Personer' })).toBeVisible();
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      // Verify table has data rows (header + at least one data row)
      await expect(table.getByRole('row')).not.toHaveCount(0);
    });

    test('should show person count', async ({ page }) => {
      await page.goto('/personer');
      await expect(page.getByText(/\d+ af \d+/)).toBeVisible();
    });

    test('should show Peter Mærsk as first person', async ({ page }) => {
      await page.goto('/personer');
      const firstRow = page.getByRole('row').nth(1);
      await expect(firstRow.getByRole('cell', { name: 'Peter Mærsk' })).toBeVisible();
    });

    test('should have a search box', async ({ page }) => {
      await page.goto('/personer');
      await expect(page.getByRole('textbox', { name: /søg/i })).toBeVisible();
    });
  });

  test.describe('Billeder page', () => {

    test('should load image gallery', async ({ page }) => {
      await page.goto('/billeder');
      await expect(page.getByRole('heading', { name: 'Billeder' })).toBeVisible();
    });

    test('should show image count', async ({ page }) => {
      await page.goto('/billeder');
      await expect(page.getByText(/\d+ af \d+/)).toBeVisible();
    });

    test('should show category filter buttons', async ({ page }) => {
      await page.goto('/billeder');
      await expect(page.getByRole('button', { name: 'Alle' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Portræt' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sted' })).toBeVisible();
    });
  });

  test.describe('Steder page', () => {

    test('should load places list with table', async ({ page }) => {
      await page.goto('/steder');
      await expect(page.getByRole('heading', { name: 'Steder' })).toBeVisible();
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      await expect(table.getByRole('row')).not.toHaveCount(0);
    });

    test('should show place count', async ({ page }) => {
      await page.goto('/steder');
      await expect(page.getByText(/\d+ af \d+/)).toBeVisible();
    });

    test('should have a search box', async ({ page }) => {
      await page.goto('/steder');
      await expect(page.getByRole('textbox', { name: /søg/i })).toBeVisible();
    });
  });

  test.describe('Download', () => {

    test('should show download data button', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /download data/i })).toBeVisible();
    });
  });
});
