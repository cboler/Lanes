import { expect, test } from './fixtures';

test('plays the first story mission from briefing to aftermath and opens the next', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#guild-campaign-link')).toHaveText(/Begin the story/);
  await page.locator('#guild-campaign-link').click();
  await expect(page).toHaveURL(/\/campaign$/);
  await expect(page.locator('#campaign-progress')).toHaveText('0 / 4');
  await expect(page.locator('#begin-the-ford')).toHaveCount(0);

  // The briefing reads line by line; the squad leader (Aldric) speaks in it.
  await page.locator('#begin-north-road').click();
  await expect(page.locator('#scene-next-btn')).toBeFocused();
  await expect(page.locator('#scene-speaker')).toHaveText('Guildmaster Hollis');
  await page.keyboard.press('Enter');
  await expect(page.locator('#scene-speaker')).toHaveText('Aldric');
  await page.locator('#scene-skip-btn').click();

  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.locator('.contract-note')).toContainText('Wolves on the North Road');
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText('Grey Wolf Scouts');
  const names = await page.locator('.enemy-unit .unit-name').allTextContents();
  expect(names.map((name) => name.trim()).sort()).toEqual(['Brask', 'Ivra']);

  // Winning takes several turns, so the band is felled through the dev-mode handle.
  await page.evaluate(() => {
    const host = document.querySelector('app-battlefield');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(host).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await expect(page.locator('#reward-story')).toContainText('+150 gold');
  await page.locator('#modal-story-btn').click();

  await expect(page).toHaveURL(/debrief=north-road/);
  await expect(page.locator('.scene-title')).toContainText('Aftermath');
  await page.keyboard.press('Escape');
  await expect(page.locator('.scene-dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/campaign$/);
  await expect(page.locator('#campaign-progress')).toHaveText('1 / 4');
  await expect(page.locator('[data-mission="north-road"]')).toContainText('Won');
  await expect(page.locator('#begin-the-ford')).toBeVisible();

  // Progress survives a reload; the guild now continues the story.
  await page.goto('/');
  await expect(page.locator('#guild-campaign-link')).toHaveText(/Continue the story/);
  await expect(page.locator('.guild-story')).toContainText('Spikes at the Ford');
});
