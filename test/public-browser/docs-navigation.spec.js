import { test, expect } from '@playwright/test';

test('desktop Docs navigation follows the visible header while scrolling', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop sticky navigation');
  await page.goto('/docs/');
  await expect(page.locator('.docs-page')).toHaveAttribute('style', /--public-header-height/);
  const navigation = page.locator('.docs-navigation');
  const header = page.locator('.docs-header');
  await page.evaluate(() => window.scrollTo({ top: 650, behavior: 'instant' }));
  await expect(header).not.toHaveClass(/is-scroll-returned/);
  await expect
    .poll(() => navigation.evaluate((element) => element.getBoundingClientRect().top))
    .toBe(24);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await expect(header).toHaveClass(/is-scroll-returned/);
  await expect
    .poll(() => navigation.evaluate((element) => element.getBoundingClientRect().top))
    .toBe((await header.evaluate((element) => element.offsetHeight)) + 24);
  expect(
    await navigation.evaluate((element) => element.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) - 24);
});
