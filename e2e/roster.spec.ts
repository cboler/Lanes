import { expect, test } from './fixtures';

test.describe('starter roster', () => {
  // These tests cover the randomly generated starter roster.
  test.use({ seedRoster: false });

  test('shows a persistent roster with stat sheets and deploys the chosen squad', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/roster');
    await expect(page.getByRole('heading', { name: 'Mercenary Roster' })).toBeVisible();
    const cards = page.locator('.merc-card:not(.recruit)');
    await expect(cards).toHaveCount(6);
    await expect(cards.first().locator('.stat-row')).toHaveCount(9);
    await expect(cards.first().locator('.grade')).toHaveCount(8);

    const names = await cards.locator('h2').allTextContents();
    await page.reload();
    expect(await page.locator('.merc-card:not(.recruit) h2').allTextContents()).toEqual(names);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBeFalsy();

    await page.locator('.merc-card.in-squad').first().locator('.squad-toggle').click();
    await expect(page.locator('#deploy-roster-btn')).toContainText('3/4');
    await page.reload();
    await expect(page.locator('#deploy-roster-btn')).toContainText('3/4');

    await page.locator('#deploy-roster-btn').click();
    await expect(page).toHaveURL(/\/battle$/);
    await expect(page.locator('.player-unit')).toHaveCount(3);
    expect(errors).toEqual([]);
  });
});

test('hires recruits with gold, refreshes the board, and dismisses with a confirmation', async ({
  page,
}) => {
  await page.goto('/roster');
  await expect(page.locator('#roster-gold')).toContainText('500 gold');
  const mercs = page.locator('.merc-card:not(.recruit)');
  await expect(mercs).toHaveCount(6);
  const recruits = page.locator('.merc-card.recruit');
  await expect(recruits).toHaveCount(3);

  const hire = recruits.first().locator('.hire-btn');
  const price = Number((await hire.textContent())!.match(/\d+/)![0]);
  const name = (await recruits.first().locator('h2').textContent())!.trim();
  await hire.click();
  await expect(mercs).toHaveCount(7);
  await expect(recruits).toHaveCount(2);
  await expect(page.locator('#roster-gold')).toContainText(`${500 - price} gold`);
  await page.reload();
  await expect(mercs.locator('h2')).toContainText([name]);

  await page.locator('#refresh-recruits-btn').click();
  await expect(recruits).toHaveCount(3);
  await expect(page.locator('#roster-gold')).toContainText(`${500 - price - 20} gold`);

  const card = mercs.filter({ hasText: name });
  await card.getByRole('button', { name: `Dismiss ${name}` }).click();
  await expect(mercs).toHaveCount(7);
  await card.getByRole('button', { name: `Confirm dismissing ${name}` }).click();
  await expect(mercs).toHaveCount(6);
});

test('equips support skills within SP and shows each skill pattern', async ({ page }) => {
  await page.goto('/roster');
  const card = page.locator('.merc-card:not(.recruit)').filter({ hasText: 'Aldric' });
  await card.locator('.skills-panel summary').click();
  await expect(card.locator('.skills-panel summary')).toContainText('0/10 SP');
  // Three core skills known, and two pattern skills still locked behind levels.
  await expect(card.locator('.skill-chips li')).toHaveCount(5);
  await expect(card.locator('.skill-chips li.locked')).toHaveCount(2);
  await card.getByRole('button', { name: /^Vigor for Aldric/ }).click();
  await expect(card.locator('.skills-panel summary')).toContainText('4/10 SP');
  await expect(card.getByRole('button', { name: /^Might for Aldric/ })).toBeDisabled();
  await page.reload();
  await card.locator('.skills-panel summary').click();
  await expect(card.getByRole('button', { name: /^Vigor for Aldric/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.merc-card.recruit .pattern-note').first()).toContainText('Learns');
});

test('buys a Tactics Scroll at the guild store and raises an aptitude on the roster', async ({
  page,
}) => {
  await page.goto('/guild');
  await page.locator('#buy-tactics').click();
  await expect(page.locator('#owned-tactics')).toHaveText('Owned: 1');
  await expect(page.locator('#guild-gold')).toHaveText('200');

  await page.goto('/roster');
  const aldric = page.locator('.merc-card').filter({ hasText: 'Aldric' });
  await aldric.locator('.items-panel summary').click();
  await aldric
    .getByRole('button', { name: 'Use a Tactics Scroll on STR for Aldric: C to B' })
    .click();
  await expect(aldric.locator('.stat-row').first().locator('.grade')).toHaveText('B');
  await expect(aldric.locator('.items-panel summary')).toContainText('0 Tactics');
  // With no scroll left, every aptitude button is disabled.
  await expect(aldric.locator('.grades button:enabled')).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator('.merc-card').filter({ hasText: 'Aldric' }).locator('.stat-row .grade').first(),
  ).toHaveText('B');
});

test('a levelled mercenary can auto-invest by class focus, flagged on the map', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('lanes.roster.v1')!);
    raw.mercenaries[0].statPoints = 5;
    localStorage.setItem('lanes.roster.v1', JSON.stringify(raw));
  });
  await page.goto('/');
  await expect(page.locator('.portrait .points-badge').first()).toHaveText('+5');
  await page.goto('/roster');
  await expect(page.locator('.unspent-note')).toContainText('1 mercenary has stat points');
  await page.locator('#auto-invest-all-btn').click();
  await expect(page.locator('.unspent-note')).toHaveCount(0);
  await expect(page.locator('.points-note')).toHaveCount(0);
});
