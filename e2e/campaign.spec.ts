import { expect, test } from './fixtures';
import { Page } from '@playwright/test';

test.use({ seedCampaign: false });

async function winBattle(page: Page) {
  await expect(page.locator('app-battlefield')).toBeVisible();
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(
      document.querySelector('app-battlefield'),
    ).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await expect(page.locator('#modal-story-btn')).toBeVisible();
}

async function hop(page: Page, name: string) {
  await page.locator('.route-choice').filter({ hasText: name }).click();
  await page.locator('#march-btn').click();
  // The hop either settles on the map or, on contact, moves straight into battle.
  await expect(page.locator('.board[aria-busy="false"], app-battlefield')).toHaveCount(1);
}

test('the story starts on the overworld, encounters its named squad, and returns to the journey', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.enemy-marker')).toHaveCount(6);
  await expect(page.locator('.story-marker')).toHaveAttribute('data-patrol', 'story:north-road');
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await page.locator('#read-commission-btn').click();
  await expect(page.locator('#scene-next-btn')).toBeFocused();
  await expect(page.locator('#scene-speaker')).toHaveText('Guildmaster Hollis');
  await page.keyboard.press('Enter');
  await expect(page.locator('#scene-speaker')).toHaveText('Aldric');
  await page.screenshot({ path: `tmp/campaign-scene-${test.info().project.name}.png` });
  await page.locator('#scene-skip-btn').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await page.locator('.story-marker').click();
  await expect(page.locator('.scouted-squad')).toContainText('Brask');
  await expect(page.locator('.scouted-squad')).toContainText('Ivra');
  await page.locator('#field-return-btn').click();
  await hop(page, 'Old Cart Track');
  await hop(page, 'Three Roads');
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.locator('.contract-note')).toContainText('Wolves on the North Road');
  const names = (await page.locator('.enemy-unit .unit-name').allTextContents())
    .map((n) => n.trim())
    .sort();
  expect(names).toEqual(['Brask', 'Ivra']);
  await page.reload();
  await expect(page.locator('.troop-banner.enemy .troop-name')).toHaveText('Grey Wolf Scouts');
  expect(
    (await page.locator('.enemy-unit .unit-name').allTextContents()).map((n) => n.trim()).sort(),
  ).toEqual(names);
  await winBattle(page);
  await expect(page.locator('#reward-story')).toContainText('+150 gold');
  await page.locator('#modal-story-btn').click();
  await expect(page).toHaveURL(/debrief=north-road/);
  await expect(page.locator('.scene-title')).toContainText('AFTERMATH');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Three Roads/);
  await expect(page.locator('#expedition-turn')).toHaveText('003');
  await expect(page.locator('.story-marker')).toHaveAttribute('data-patrol', 'story:the-ford');
  await page.reload();
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Three Roads/);
  await page.locator('#company-menu-btn').click();
  await page.locator('#nav-link-campaign').click();
  await expect(page.locator('#campaign-progress')).toHaveText('1 / 10');
  await expect(page.locator('[data-mission="north-road"]')).toContainText('Won');
  await page.locator('#return-to-map').click();
  await expect(page.locator('#expedition-turn')).toHaveText('003');
  expect(errors).toEqual([]);
});

test('company commands preserve the journey and contain keyboard focus without spending turns', async ({
  page,
}) => {
  await page.goto('/');
  await hop(page, 'Old Cart Track');
  for (const [id, path] of [
    ['roster', 'roster'],
    ['squad', 'squad'],
    ['defense', 'defense'],
    ['guild', 'guild'],
    ['campaign', 'campaign'],
    ['options', 'options'],
  ]) {
    await page.keyboard.press('c');
    await expect(page.locator('#company-menu')).toBeVisible();
    await page.locator('#close-company-btn').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#nav-link-overworld')).toBeFocused();
    // Map hotkeys must not march, scout or wait underneath the company menu.
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.screenshot({ path: `tmp/company-menu-${test.info().project.name}.png` });
    await page.locator(`#nav-link-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.locator('#company-menu')).toBeHidden();
    await page.locator('#return-to-map').click();
    await expect(page.locator('#expedition-turn')).toHaveText('002');
    await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Old Cart Track/);
  }
  await page.keyboard.press('c');
  await page.keyboard.press('Escape');
  await expect(page.locator('#company-menu')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `tmp/campaign-map-${test.info().project.name}.png` });
  const layout = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: innerHeight,
    sections: [
      ...document.querySelectorAll(
        '.app-header, .region-bar, .field, .journey-message, .command-deck',
      ),
    ].map((e) => ({
      name: e.className,
      top: e.getBoundingClientRect().top,
      height: e.getBoundingClientRect().height,
    })),
  }));
  expect(layout.height, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
});

test('all four scripted squads are encountered on their repeated circuits and a defeat regroups', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Story sequencing is independent of viewport.');
  const missions = [
    { id: 'north-road', landing: 'ford', names: ['Brask', 'Ivra'] },
    { id: 'the-ford', landing: 'east', names: ['Torv', 'Ulla', 'Odo'] },
    { id: 'thorn-keep', landing: 'gate', names: ['Gorm', 'Pell', 'Yrsa', 'Kell'] },
    { id: 'vargr', landing: 'gate', names: ['Vargr', 'Hask', 'Rhea', 'Sesk'] },
  ];
  await page.goto('/');
  for (const [index, mission] of missions.entries()) {
    // Place the company at the next landing to isolate each encounter's story integration.
    await page.evaluate(
      (position) =>
        localStorage.setItem(
          'lanes.overworld.v1',
          JSON.stringify({
            version: 1,
            position,
            turn: 0,
            collected: [],
            defeated: ['wolves', 'thorns', 'ravens', 'rangers', 'wardens'],
            encounter: null,
            complete: false,
          }),
        ),
      mission.landing,
    );
    await page.reload();
    await expect(page.locator('.story-marker')).toHaveAttribute(
      'data-patrol',
      `story:${mission.id}`,
    );
    await page.locator('#wait-btn').click();
    await expect(page.locator('#scene-next-btn')).toBeVisible();
    await page.locator('#scene-skip-btn').click();
    await expect(page).toHaveURL(/\/battle$/);
    expect(
      (await page.locator('.enemy-unit .unit-name').allTextContents())
        .map((n) => n.trim())
        .filter((name) => name !== 'Barricade')
        .sort(),
    ).toEqual([...mission.names].sort());
    if (index === 0) {
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const battle = (window as any).ng.getComponent(
          document.querySelector('app-battlefield'),
        ).battle;
        for (const unit of battle.playerUnits()) unit.takeDamage(99999);
        battle.endCurrentTurn(true);
      });
      await page.locator('#modal-story-btn').click();
      await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Wayfarer Camp/);
      await expect(page.locator('.story-marker')).toHaveAttribute(
        'data-patrol',
        'story:north-road',
      );
      // Re-encounter the same squad after regrouping.
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('lanes.overworld.v1')!);
        localStorage.setItem(
          'lanes.overworld.v1',
          JSON.stringify({ ...saved, position: 'ford', turn: 0 }),
        );
      });
      await page.reload();
      await page.locator('#wait-btn').click();
      await expect(page).toHaveURL(/\/battle$/);
    }
    await winBattle(page);
    await page.locator('#modal-story-btn').click();
    await expect(page.locator('.scene-title')).toContainText('AFTERMATH');
    await page.locator('#scene-skip-btn').click();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('lanes.campaign.v1')!).cleared.length,
      ),
    ).toBe(index + 1);
  }
  await expect(page.locator('.story-marker')).toHaveCount(0);
});

test('winning the prologue opens Saltmere, where chapter one begins', async ({ page }, info) => {
  test.skip(info.project.name === 'phone-landscape', 'Travel is covered at the other sizes.');
  await page.addInitScript(() => {
    if (!localStorage.getItem('lanes.campaign.v1')) {
      localStorage.setItem(
        'lanes.campaign.v1',
        JSON.stringify({
          version: 1,
          cleared: ['north-road', 'the-ford', 'thorn-keep', 'vargr'],
          accepted: [],
        }),
      );
    }
  });
  await page.goto('/');
  await expect(page.locator('#region-title')).toHaveText('The Thornwatch March');
  await expect(page.locator('.story-marker')).toHaveCount(0);
  await expect(page.locator('#travel-story-btn')).toContainText('The Seal on the Crates');
  await page.locator('#travel-story-btn').click();
  await expect(page.locator('#region-title')).toHaveText('The Saltmere Coast');
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Driftwood Camp/);
  await expect(page.locator('.story-marker')).toHaveAttribute('data-patrol', 'story:s1-docks');
  // The Travel dialog leads back, and each board keeps its place.
  await page.locator('#regions-btn').click();
  await page.locator('#travel-thornwatch').click();
  await expect(page.locator('#region-title')).toHaveText('The Thornwatch March');
  await page.locator('#regions-btn').click();
  await page.locator('#travel-saltmere').click();
  await expect(page.locator('#region-title')).toHaveText('The Saltmere Coast');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `tmp/saltmere-${info.project.name}.png` });
});
