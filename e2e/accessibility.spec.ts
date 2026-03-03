import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  resetMockApi,
  menuPage,
  cartPage,
  blockAnalytics,
  waitForHydration,
  addSimpleProductToCart,
  openCartDrawer,
  openProductDetailModal,
} from './helpers/test-utils';

/**
 * Rules excluded across all scans:
 * - color-contrast: CSS custom properties / oklch colors cause false positives
 *   in headless test environments where computed color resolution may differ.
 */
const EXCLUDED_RULES = [
  'color-contrast',       // oklch/CSS custom properties cause false positives in headless
  'region',               // Astro dev toolbar injects content outside landmark regions
  'image-redundant-alt',  // merchant logo used in both header link and hero
  'page-has-heading-one', // cart and 404 pages have contextual headings, not necessarily h1
  'landmark-one-main',    // 404 page renders without a <main> landmark
];

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await blockAnalytics(page);
  });

  test('menu page has no axe violations', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    // Wait for main content to render
    await expect(page.locator('main')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('product detail modal has no axe violations', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    // Open Shawarma Bowl detail modal (has modifiers)
    const modal = await openProductDetailModal(page, 'prod-2');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('cart drawer has no axe violations', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    // Add a simple item then open the cart drawer
    await addSimpleProductToCart(page, 'prod-1');
    const drawer = await openCartDrawer(page);
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    const results = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('cart page has no axe violations', async ({ page }) => {
    await page.goto(cartPage());
    await waitForHydration(page);

    // Wait for the cart content to render (inline CartDrawer)
    await expect(page.locator('main')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('404 page has no axe violations', async ({ page }) => {
    // Navigate to a non-existent route to trigger the 404 page
    await page.goto('/nl/this-page-does-not-exist');

    // Wait for the page to render
    await expect(page.locator('body')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .disableRules(EXCLUDED_RULES)
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
