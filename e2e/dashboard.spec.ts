import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('shows page header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows stats cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Active Agents')).toBeVisible();
    await expect(page.getByText('Runs Today')).toBeVisible();
  });

  test('shows quality score card', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Quality Score')).toBeVisible();
  });

  test('shows monthly spend card', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Monthly Spend')).toBeVisible();
  });

  test('displays insights section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Insights')).toBeVisible();
  });

  test('displays budget overview', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Budget')).toBeVisible();
  });
});
