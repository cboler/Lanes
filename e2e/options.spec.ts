import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

test('downloads a backup, restores it after starting over, and the progress returns', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Save data is independent of viewport.');
  // Spend some gold so the backup holds something a new game would not.
  await page.goto('/');
  await page.locator('#buy-charm').click();
  await expect(page.locator('#guild-gold')).toHaveText('300');

  await page.locator('#nav-link-options').click();
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('#export-save-btn').click();
  const file = await (await download).path();
  expect(JSON.parse(await readFile(file, 'utf8')).game).toBe('lanes');

  // Starting over takes two presses, then the game begins again at the Guild Hall.
  await page.locator('#reset-save-btn').click();
  await expect(page.locator('#reset-save-btn')).toHaveText(/Press again/);
  await page.locator('#reset-save-btn').click();
  await expect(page.getByRole('heading', { name: 'Guild Hall' })).toBeVisible();
  await expect(page.locator('#guild-gold')).toHaveText('500');
  await expect(page.locator('#owned-charm')).toHaveText('Owned: 0');

  // A file that is not a backup changes nothing.
  await page.goto('/options');
  await page.locator('#import-save-input').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.locator('#save-message')).toContainText('not a Lanes backup');

  await page.locator('#import-save-input').setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Guild Hall' })).toBeVisible();
  await expect(page.locator('#guild-gold')).toHaveText('300');
  await expect(page.locator('#owned-charm')).toHaveText('Owned: 1');
});
