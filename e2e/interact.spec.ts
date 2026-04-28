import { test, expect } from '@playwright/test';

test('click next and check screenshot', async ({ page }) => {
  await page.goto('http://localhost:4322/blog/frau-luske-kaffeehaus/');
  await page.waitForTimeout(1000);
  
  // Take screenshot before click
  await page.screenshot({ path: 'before-click.png' });
  
  // Click next
  await page.locator('.carousel-nav.next').click();
  await page.waitForTimeout(1000); // wait for scroll
  
  // Take screenshot after click
  await page.screenshot({ path: 'after-click.png' });
  
  // Click next again
  await page.locator('.carousel-nav.next').click();
  await page.waitForTimeout(1000); // wait for scroll
  
  // Take screenshot after second click
  await page.screenshot({ path: 'after-click-2.png' });
});
