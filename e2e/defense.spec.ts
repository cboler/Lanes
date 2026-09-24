import { expect, test } from '@playwright/test';

test('saves a four-turn defense plan and practices against its first order', async ({ page }) => {
  await page.goto('/defense');
  await expect(page.getByRole('heading', { name: 'Defense Orders' })).toBeVisible();
  await expect(page.locator('.defense-member')).toHaveCount(4);
  await page.getByRole('button', { name: 'Member 1 turn 1 action: Auto fallback' }).click();
  await expect(
    page.getByRole('button', { name: 'Member 1 turn 1 action: Guard and end' }),
  ).toBeVisible();
  await page.locator('#save-defense-btn').click();
  await expect(page.locator('.defense-status')).toContainText('saved on this device');

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Member 1 turn 1 action: Guard and end' }),
  ).toBeVisible();
  await page.locator('#practice-defense-btn').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.battlefield-container > .practice-note')).toBeVisible();
  await page.locator('#end-turn-btn').click();
  await page.locator('#end-turn-btn').click();
  await page.locator('#toggle-log-btn').click();
  await expect(page.locator('.combat-log-drawer')).toContainText(
    'Enemy Lancer follows turn 1 order: Guard',
  );
  await expect(
    page.locator('.enemy-unit').filter({ hasText: 'Enemy Lancer' }).locator('.guard-badge'),
  ).toBeVisible();
  await page.locator('#restart-battle-btn').click();
  await expect(page.locator('.battlefield-container > .practice-note')).toBeVisible();
});

test('class changes reset incompatible actions and roster stays within one to four', async ({
  page,
}) => {
  await page.goto('/defense');
  const first = page.getByRole('region', { name: 'Defense member 1' });
  await first.getByRole('button', { name: 'Member 1 turn 1 action: Auto fallback' }).click();
  await first.getByRole('button', { name: 'Member 1 turn 1 action: Guard and end' }).click();
  await expect(first.getByRole('button', { name: /Member 1 turn 1 action: Thrust/ })).toBeVisible();
  await first.getByRole('button', { name: 'Change class for member 1' }).click();
  await expect(
    first.getByRole('button', { name: 'Member 1 turn 1 action: Auto fallback' }),
  ).toBeVisible();

  for (let remaining = 4; remaining > 1; remaining--) {
    await page.getByRole('button', { name: 'Remove member 1' }).click();
    await expect(page.locator('.defense-member')).toHaveCount(remaining - 1);
  }
  await expect(page.getByRole('button', { name: 'Remove member 1' })).toBeDisabled();
  for (let count = 1; count < 4; count++) {
    await page.locator('#add-defense-member-btn').click();
    await expect(page.locator('.defense-member')).toHaveCount(count + 1);
  }
  await expect(page.locator('#add-defense-member-btn')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
