import { test, expect } from '@playwright/test';

test.describe('Insights', () => {
  test('shows insights page', async ({ page }) => {
    await page.goto('/insights');
    await expect(page.getByRole('heading', { name: /insights/i })).toBeVisible();
  });

  test('displays insight cards', async ({ page }) => {
    await page.goto('/insights');
    // Wait for loading
    await page.waitForTimeout(1000);
    // Should have some content loaded
    const content = page.locator('main').or(page.locator('[class*="content"]'));
    await expect(content).toBeVisible();
  });
});
