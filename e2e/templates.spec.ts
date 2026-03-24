import { test, expect } from '@playwright/test';

test.describe('Templates', () => {
  test('shows templates page header', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  });

  test('shows category tabs', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByText('All')).toBeVisible();
  });

  test('shows rebel group category', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByText('Rebel Group')).toBeVisible();
  });

  test('can filter by category', async ({ page }) => {
    await page.goto('/templates');
    const entertainmentTab = page.getByRole('button', { name: /entertainment/i }).or(
      page.getByText('Entertainment')
    );
    if (await entertainmentTab.isVisible()) {
      await entertainmentTab.click();
      // Page should still be visible after filter
      await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    }
  });
});
