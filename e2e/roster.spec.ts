import { expect, test } from '@playwright/test';

test('shows a persistent roster with stat sheets and deploys the chosen squad', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/roster');
  await expect(page.getByRole('heading', { name: 'Mercenary Roster' })).toBeVisible();
  const cards = page.locator('.merc-card');
  await expect(cards).toHaveCount(6);
  await expect(cards.first().locator('.stat-row')).toHaveCount(9);
  await expect(cards.first().locator('.grade')).toHaveCount(8);

  const names = await cards.locator('h2').allTextContents();
  await page.reload();
  expect(await page.locator('.merc-card h2').allTextContents()).toEqual(names);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBeFalsy();

  await page.locator('.merc-card.in-squad').first().getByRole('button').click();
  await expect(page.locator('#deploy-roster-btn')).toContainText('3/4');
  await page.reload();
  await expect(page.locator('#deploy-roster-btn')).toContainText('3/4');

  await page.locator('#deploy-roster-btn').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.player-unit')).toHaveCount(3);
  expect(errors).toEqual([]);
});
