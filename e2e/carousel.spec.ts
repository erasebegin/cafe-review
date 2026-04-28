import { test, expect } from '@playwright/test';

test('carousel works', async ({ page }) => {
  await page.goto('http://localhost:4322/blog/frau-luske-kaffeehaus/');
  
  // Wait for the carousel
  const carousel = page.locator('.carousel-container');
  await expect(carousel).toBeVisible();

  const nextBtn = page.locator('.carousel-nav.next');
  await expect(nextBtn).toBeVisible();

  const activeDot = page.locator('.carousel-dots .dot.active');
  const initialIndex = await activeDot.getAttribute('data-index');
  console.log('Initial index:', initialIndex);

  await nextBtn.click();
  await page.waitForTimeout(500); // wait for scroll

  const newActiveDot = page.locator('.carousel-dots .dot.active');
  const newIndex = await newActiveDot.getAttribute('data-index');
  console.log('New index:', newIndex);
});
