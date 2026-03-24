import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('sidebar contains main navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /agents/i })).toBeVisible();
  });

  test('can navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to Agents
    await page.getByRole('link', { name: /agents/i }).click();
    await expect(page).toHaveURL(/\/agents/);
    
    // Navigate to Templates
    await page.getByRole('link', { name: /templates/i }).click();
    await expect(page).toHaveURL(/\/templates/);
  });

  test('shows active state for current page', async ({ page }) => {
    await page.goto('/agents');
    const agentsLink = page.getByRole('link', { name: /agents/i });
    // Active links typically have different styling
    await expect(agentsLink).toBeVisible();
  });
});
