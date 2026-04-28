import { test, expect } from '@playwright/test';

test('dots visible without hover', async ({ page }) => {
  await page.goto('http://localhost:4321/blog/frau-luske-kaffeehaus/');
  const dots = page.locator('.carousel-dots');
  await expect(dots).toBeVisible();
});
