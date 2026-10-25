import { expect, test } from './fixtures';

test('takes a contract from the guild board, fights its band, and a win replaces it', async ({
  page,
}) => {
  await page.goto('/guild');
  await expect(page.getByRole('heading', { name: 'Guild Hall' })).toBeVisible();
  await expect(page.locator('.contract-card')).toHaveCount(3);
  await expect(page.locator('#guild-party-level')).toHaveText('1');
  const normal = page.locator('.contract-card[data-tier="normal"]');
  const title = (await normal.locator('h3').textContent())!.trim();
  const band = (await normal.locator('p').first().textContent())!.match(/The (.+?) ·/)![1];
  const enemyNames = (await normal.locator('.enemy-list li span').allTextContents()).map(
    (text) => text.split(' · ')[0],
  );
  expect(enemyNames).toHaveLength(4);

  await page.locator('#take-contract-normal').click();
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.locator('.contract-note')).toContainText(title);
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText(band);
  // The stage lists units lane by lane, so compare the band as a set.
  // A Normal band also raises a barricade, which is not one of its fighters.
  const fighters = page.locator('.enemy-unit').filter({ hasNotText: 'Barricade' });
  await expect(fighters).toHaveCount(4);
  const onField = await fighters.locator('.unit-name').allTextContents();
  expect(onField.map((name) => name.trim()).sort()).toEqual([...enemyNames].sort());
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );

  // Restarting fights the same contract again.
  await page.locator('#battle-menu-btn').click();
  await page.locator('#restart-battle-btn').click();
  await expect(page.locator('.contract-note')).toContainText(title);

  // Winning outright takes many turns, so the band is felled through the dev-mode handle.
  await page.evaluate(() => {
    const host = document.querySelector('app-battlefield');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(host).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await expect(page.locator('.result-heading')).toHaveText('VICTORY ACHIEVED');
  await expect(page.locator('#reward-gold')).toBeVisible();

  await page.locator('#modal-guild-btn').click();
  await expect(page.locator('#guild-completed')).toHaveText('1');
  await expect(page.locator('.contract-card[data-tier="normal"] h3')).toHaveCount(1);
  await expect(page.locator('.contract-card')).toHaveCount(3);
  // The won contract's band left the board (a new one was posted in its place).
  const enemiesNow = await page
    .locator('.contract-card[data-tier="normal"] .enemy-list li span')
    .allTextContents();
  expect(enemiesNow.map((text) => text.split(' · ')[0])).not.toEqual(enemyNames);
});

test('a hard contract raises a barricade and sets two traps', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Placement is independent of viewport.');
  await page.goto('/guild');
  await page.locator('#take-contract-hard').click();
  await expect(page.locator('.enemy-unit')).toHaveCount(5);
  await expect(page.locator('.enemy-unit').filter({ hasText: 'Barricade' })).toHaveCount(1);
  await expect(page.locator('.trap-marker')).toHaveCount(2);
  // The barricade is not part of the band: four pips, four turns' worth of foes.
  await expect(page.locator('.troop-banner.enemy .pip')).toHaveCount(4);
  await expect(page.locator('.turn-token.enemy')).toHaveCount(4);
});

test('buys a sword in the armoury, equips it on the roster, and reforges it', async ({ page }) => {
  await page.goto('/guild');
  await expect(page.locator('#buy-sword-2')).toHaveCount(0);
  await page.locator('#buy-sword-1').click();
  await expect(page.locator('#guild-gold')).toHaveText('380');
  await expect(page.locator('.forge-row')).toContainText('Iron Sword');
  await page.screenshot({ path: `tmp/armoury-${test.info().project.name}.png`, fullPage: true });

  await page.goto('/roster');
  const aldric = page.locator('.merc-card').filter({ hasText: 'Aldric' });
  await aldric.locator('.gear-panel summary').click();
  await aldric.getByRole('button', { name: 'Equip Iron Sword on Aldric' }).click();
  await expect(aldric.locator('.gear-panel summary')).toContainText('1/3');

  await page.goto('/guild');
  await expect(page.locator('.forge-row')).toContainText('worn by Aldric');
  await page.getByRole('button', { name: /^Reforge Iron Sword for 60 gold/ }).click();
  await expect(page.locator('.forge-row')).toContainText('Iron Sword +1');
  await expect(page.locator('#guild-gold')).toHaveText('320');
});
