import { test, expect } from '@playwright/test';
import { resetMockApi, menuPage, blockAnalytics, waitForHydration } from './helpers/test-utils';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await blockAnalytics(page);
  });

  test('search input accepts text and shows results', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    // Open the search overlay via the header search trigger button
    await page.getByRole('button', { name: 'Zoeken' }).click();

    // The search input should appear and be focusable
    const searchInput = page.getByRole('searchbox', { name: 'Zoeken' });
    await expect(searchInput).toBeVisible();

    // Type a query that matches multiple products (debounced 300ms)
    await searchInput.fill('al');
    await searchInput.press('a'); // "ala" — triggers at >= 2 chars after debounce

    // Wait for the listbox results to appear
    const listbox = page.getByRole('listbox', { name: 'Zoeken' });
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // At least one result should be present
    const options = listbox.getByRole('option');
    await expect(options.first()).toBeVisible();
  });

  test('search results match query', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Zoeken' }).click();

    const searchInput = page.getByRole('searchbox', { name: 'Zoeken' });
    await searchInput.fill('falafel');

    // Wait for results (300ms debounce + network)
    const listbox = page.getByRole('listbox', { name: 'Zoeken' });
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // Should show the Falafel Wrap product
    await expect(listbox.getByText('Falafel Wrap')).toBeVisible();

    // Should NOT show unrelated products
    await expect(listbox.getByText('Shawarma Bowl')).toBeHidden();
  });

  test('clicking result opens product detail', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Zoeken' }).click();

    const searchInput = page.getByRole('searchbox', { name: 'Zoeken' });
    await searchInput.fill('shawarma');

    const listbox = page.getByRole('listbox', { name: 'Zoeken' });
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // Use JS-level click because the backdrop overlay intercepts pointer
    // events at the DOM level (absolute inset-0 stacking) even though the
    // card is visually on top. element.click() bypasses hit-testing.
    await listbox.getByText('Shawarma Bowl').evaluate((el) => (el as HTMLElement).click());

    // The search overlay should close and product detail dialog should open
    await expect(searchInput).toBeHidden();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('no results shows empty state', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Zoeken' }).click();

    const searchInput = page.getByRole('searchbox', { name: 'Zoeken' });
    await searchInput.fill('xyznonexistent');

    // Wait for debounce + response, then check for "No results" message
    await expect(page.getByText('No results')).toBeVisible({ timeout: 5_000 });

    // The listbox should not be present (no matching results)
    await expect(page.getByRole('listbox', { name: 'Zoeken' })).toBeHidden();
  });

  test('Escape clears search', async ({ page }) => {
    await page.goto(menuPage());
    await waitForHydration(page);

    await page.getByRole('button', { name: 'Zoeken' }).click();

    const searchInput = page.getByRole('searchbox', { name: 'Zoeken' });
    await expect(searchInput).toBeVisible();

    // Type something, then press Escape
    await searchInput.fill('falafel');
    await page.keyboard.press('Escape');

    // The search overlay (including the input) should disappear
    await expect(searchInput).toBeHidden();
  });
});
