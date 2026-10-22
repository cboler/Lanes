import { expect, test } from './fixtures';
import { Page } from '@playwright/test';

async function march(page: Page, name: string) {
  const turn = await page.locator('#expedition-turn').textContent();
  await page.locator('.route-choice').filter({ hasText: name }).click();
  await page.locator('#march-btn').click();
  await expect(async () => {
    if (page.url().endsWith('/battle')) await expect(page.locator('app-battlefield')).toBeVisible();
    else {
      await expect(page.locator('#expedition-turn')).not.toHaveText(turn!);
      await expect(page.locator('.board')).toHaveAttribute('aria-busy', 'false');
    }
  }).toPass({ timeout: 8000 });
}

test('the expedition fills the window, moves every piece once per hop, and saves loot', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Thornwatch March' })).toBeVisible();
  await expect(page.locator('.enemy-marker')).toHaveCount(5);
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await expect(page.locator('#march-btn')).toBeVisible();
  for (const selector of ['#march-btn', '#wait-btn', '.company-heading a', '.route-choice']) {
    const bounds = await page.locator(selector).first().boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await page.screenshot({ path: `tmp/overworld-${test.info().project.name}.png` });
  const before = await page.locator('[data-patrol="wolves"]').getAttribute('aria-label');
  await page.getByRole('button', { name: 'How to play the overworld' }).click();
  await expect(page.getByText('The world moves with you.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await march(page, 'Old Cart Track');
  await expect(page.locator('#expedition-turn')).toHaveText('002');
  expect(await page.locator('[data-patrol="wolves"]').getAttribute('aria-label')).not.toBe(before);
  await expect(page.locator('[data-patrol="wolves"]')).toHaveAttribute(
    'aria-label',
    /at Stonebridge/,
  );
  for (const name of [
    'Three Roads',
    'Whispering Grove',
    'Birchwood Track',
    'Poacher’s Overlook',
    'Abandoned Pay Chest',
  ])
    await march(page, name);
  await expect(page.locator('#overworld-gold')).toHaveText('580');
  await expect(page.locator('.journey-message')).toContainText('Found 80 gold');
  expect(
    await page.evaluate(() => {
      const piece = document.querySelector('#company-piece')!.getBoundingClientRect();
      const viewport = document.querySelector('.map-scroll')!.getBoundingClientRect();
      return piece.left >= viewport.left && piece.right <= viewport.right;
    }),
  ).toBe(true);
  await page.screenshot({ path: `tmp/overworld-loot-${test.info().project.name}.png` });
  await page.reload();
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Abandoned Pay Chest/);
  await expect(page.locator('#expedition-turn')).toHaveText('007');
  await march(page, 'Whispering Grove');
  await march(page, 'Abandoned Pay Chest');
  await expect(page.locator('#overworld-gold')).toHaveText('580');
  await page.locator('#wait-btn').click();
  await expect(page.locator('#expedition-turn')).toHaveText('010');
  expect(errors).toEqual([]);
});

test('an intercepted hop enters battle and victory removes its patrol from the saved board', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Battle integration is independent of viewport.');
  await page.goto('/');
  await page.locator('[data-patrol="wolves"]').click();
  await expect(page.locator('.scouted-squad strong').first()).toBeVisible();
  const scouted = await page.locator('.scouted-squad strong').allTextContents();
  await page.locator('#field-return-btn').click();
  for (const name of ['Old Cart Track', 'Three Roads', 'Fern Hollow', 'Stonebridge'])
    await march(page, name);
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText('Grey Wolf Scouts');
  expect(
    (await page.locator('.enemy-unit .unit-name').allTextContents())
      .map((name) => name.trim())
      .sort(),
  ).toEqual(scouted.sort());
  await page.reload();
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText('Grey Wolf Scouts');
  expect(
    (await page.locator('.enemy-unit .unit-name').allTextContents())
      .map((name) => name.trim())
      .sort(),
  ).toEqual(scouted.sort());
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(
      document.querySelector('app-battlefield'),
    ).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await page.locator('#modal-overworld-btn').click();
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Stonebridge/);
  await expect(page.locator('[data-patrol="wolves"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.enemy-marker')).toHaveCount(4);
  await expect(page.locator('#march-btn')).toBeEnabled();
});

test('scroll detours and the watchtower pay once and are included in a backup', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Reward persistence is independent of viewport.');
  await page.goto('/');
  for (const name of ['Old Cart Track', 'Three Roads', 'The Low Road', 'Forgotten Shrine'])
    await march(page, name);
  await expect(page.locator('.journey-message')).toContainText('Tactics Scroll');
  await page.goto('/guild');
  await expect(page.locator('#owned-tactics')).toHaveText('Owned: 1');
  // Seed a late expedition to check its terminal reward without skipping the tested walk above.
  await page.evaluate(() =>
    localStorage.setItem(
      'lanes.overworld.v1',
      JSON.stringify({
        version: 1,
        position: 'gate',
        turn: 10,
        collected: ['shrine'],
        defeated: ['wolves', 'thorns', 'ravens', 'rangers', 'wardens'],
        encounter: null,
        complete: false,
      }),
    ),
  );
  await page.goto('/');
  await page.reload();
  await march(page, 'The Old Watchtower');
  await expect(page.locator('#overworld-gold')).toHaveText('750');
  await expect(page.getByRole('heading', { name: 'A road reclaimed' })).toBeVisible();
  await page.locator('#field-return-btn').click();
  await march(page, 'Broken Gate');
  await march(page, 'The Old Watchtower');
  await expect(page.locator('#overworld-gold')).toHaveText('750');
  await page.goto('/options');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-save-btn').click();
  const { readFile } = await import('node:fs/promises');
  const file = await (await downloaded).path();
  const backup = JSON.parse(await readFile(file!, 'utf8'));
  expect(JSON.parse(backup.data['lanes.overworld.v1']).complete).toBe(true);
});

test('arrow selection and march work with reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard navigation is independent of viewport.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('m');
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Old Cart Track/);
  await expect(page.locator('#march-btn')).toBeEnabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.route-choice.chosen')).toContainText('Old Mill');
});

test('scouting reveals the repeating circuit and exact squad without spending turns', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#scout-btn').click();
  await expect(page.locator('.patrol-destination')).toHaveCount(5);
  await expect(page.locator('[data-next="wolves"]')).toHaveAttribute('data-node', 'bridge');
  await page.locator('[data-patrol="wolves"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.scouted-squad > div')).toHaveCount(3);
  await expect(page.locator('.patrol-cycle')).toContainText('repeats every 4 hops');
  await expect(page.locator('#field-return-btn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#field-return-btn')).toBeFocused();
  await page.screenshot({ path: `tmp/overworld-squad-${test.info().project.name}.png` });
  await page.keyboard.press('m');
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-patrol="wolves"]')).toBeFocused();
  for (const name of ['Old Cart Track', 'Three Roads', 'Fern Hollow']) await march(page, name);
  await expect(page.locator('#step-preview')).toContainText('Grey Wolf Scouts will intercept');
  await expect(page.locator('#wait-btn')).toHaveAttribute('aria-label', /Enemy contact/);
  await expect(page.locator('.route-choice').filter({ hasText: 'Stonebridge' })).toHaveClass(
    /risky/,
  );
  await page.screenshot({ path: `tmp/overworld-tactics-${test.info().project.name}.png` });
  await march(page, 'Stonebridge');
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText('Grey Wolf Scouts');
});

test('the expedition report celebrates completion once and can be reopened after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('lanes.overworld.v1'))
      localStorage.setItem(
        'lanes.overworld.v1',
        JSON.stringify({
          version: 1,
          position: 'gate',
          turn: 10,
          collected: ['cache', 'shrine'],
          defeated: ['wolves', 'thorns', 'ravens', 'rangers', 'wardens'],
          encounter: null,
          complete: false,
        }),
      );
  });
  await page.goto('/');
  await march(page, 'The Old Watchtower');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#field-dialog-title')).toHaveText('Thornwatch secured');
  await expect(page.locator('#report-turns')).toHaveText('11');
  await expect(page.locator('.recovered-loot')).toContainText('80 gold');
  await expect(page.locator('.recovered-loot')).toContainText('Tactics Scroll');
  await expect(page.locator('#overworld-gold')).toHaveText('750');
  await page.screenshot({ path: `tmp/overworld-report-${test.info().project.name}.png` });
  await page.locator('#field-return-btn').click();
  await march(page, 'Broken Gate');
  await march(page, 'The Old Watchtower');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#expedition-report-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#overworld-gold')).toHaveText('750');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
