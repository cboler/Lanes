import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test('the expedition controller waits, marches, and selects a road without advancing time', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Controller mapping is independent of viewport.');
  await installController(page);
  await page.goto('/');
  await expect(page.locator('.controller-status')).toBeVisible();
  await frames(page);
  await expect(page.locator('#march-btn')).toBeFocused();
  await tap(page, { buttons: [9] });
  await expect(page.locator('#company-menu')).toBeVisible();
  await expect(page.locator('#nav-link-overworld')).toBeFocused();
  await tap(page, { buttons: [2] });
  await expect(page.locator('#expedition-turn')).toHaveText('001');
  await tap(page, { buttons: [1] });
  await expect(page.locator('#company-menu')).toBeHidden();
  await expect(page.locator('#march-btn')).toBeFocused();
  await tap(page, { buttons: [2] });
  await expect(page.locator('#expedition-turn')).toHaveText('002');
  await expect(page.locator('#march-btn')).toBeFocused();
  await tap(page, { buttons: [0] });
  await expect(page.locator('#expedition-turn')).toHaveText('003');
  await expect(page.locator('#company-piece')).toHaveAttribute('aria-label', /Old Cart Track/);
  await expect(page.locator('#march-btn')).toBeFocused();
  await tap(page, { axes: [0, 0, 0.8, 0] });
  await expect(page.locator('.route-choice.chosen')).toContainText('Old Mill');
  await expect(page.locator('#expedition-turn')).toHaveText('003');
  await tap(page, { buttons: [3] });
  await expect(page.locator('#scout-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-patrol="wolves"]').focus();
  await tap(page, { buttons: [0] });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#field-return-btn')).toBeFocused();
  await controller(page, { connected: false });
  await controller(page);
  await expect(page.locator('#field-return-btn')).toBeFocused();
  await tap(page, { buttons: [2] });
  await expect(page.locator('#expedition-turn')).toHaveText('003');
  await tap(page, { buttons: [1] });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-patrol="wolves"]')).toBeFocused();
});

interface ControllerState {
  connected: boolean;
  buttons: number[];
  axes: number[];
}

declare global {
  interface Window {
    lanesTestController: ControllerState;
  }
}

async function installController(page: Page, heldButtons: number[] = []): Promise<void> {
  await page.addInitScript((buttons) => {
    window.lanesTestController = { connected: true, buttons, axes: [0, 0, 0, 0] };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => {
        const state = window.lanesTestController;
        return state.connected
          ? [
              {
                id: 'Lanes browser test standard controller',
                index: 0,
                connected: true,
                mapping: 'standard',
                timestamp: performance.now(),
                axes: state.axes,
                buttons: Array.from({ length: 17 }, (_, index) => ({
                  pressed: state.buttons.includes(index),
                  touched: state.buttons.includes(index),
                  value: state.buttons.includes(index) ? 1 : 0,
                })),
              },
            ]
          : [];
      },
    });
  }, heldButtons);
}

async function frames(page: Page, count = 3): Promise<void> {
  await page.evaluate(async (remaining) => {
    for (let frame = 0; frame < remaining; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, count);
}

async function controller(page: Page, state: Partial<ControllerState> = {}): Promise<void> {
  await page.evaluate((next) => {
    window.lanesTestController = {
      connected: true,
      buttons: [],
      axes: [0, 0, 0, 0],
      ...next,
    };
  }, state);
  await frames(page);
}

/**
 * Press for exactly one frame, then release. Navigation repeats after 400 ms of wall-clock hold,
 * so a press spanning several slow software-rendered frames would otherwise step twice.
 */
async function tap(page: Page, state: Partial<ControllerState>): Promise<void> {
  await page.evaluate(async (next) => {
    window.lanesTestController = { connected: true, buttons: [], axes: [0, 0, 0, 0], ...next };
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    window.lanesTestController = { connected: true, buttons: [], axes: [0, 0, 0, 0] };
  }, state);
  await frames(page);
}

/** These tests check gauges, focus and input rather than timing, so their skills land at once. */
async function timingOff(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('lanes.timing.v1', 'off'));
}

test('movement, attacks, and Guard use independent turn resources', async ({ page }) => {
  await timingOff(page);
  await page.goto('/battle');
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await expect(page.getByRole('progressbar', { name: 'Move Gauge', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(
    page.getByRole('progressbar', { name: 'Action Gauge', exact: true }),
  ).toHaveAttribute('aria-valuenow', '100');

  const archerId = await page.locator('.acting-unit').getAttribute('id');
  await page.locator('#move-right-btn').click();
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');

  await page.locator('#ability-btn-quick_shot').click();
  await expect(page.locator('.targeting-panel')).toBeVisible();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  const target = page.locator('.unit-node.targetable').first();
  const previousHp = Number(await target.locator('.hp-track').getAttribute('aria-valuenow'));
  await target.click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  const enemyGunner = page.locator('.enemy-unit').filter({ hasText: 'Enemy Gunner' });
  expect(Number(await enemyGunner.locator('.hp-track').getAttribute('aria-valuenow'))).toBeLessThan(
    previousHp,
  );

  await page.locator('#end-turn-btn').click();
  await expect(page.locator(`[id="${archerId}"] .guard-badge`)).toContainText('Guard');
  await expect(page.locator('.acting-unit')).not.toHaveAttribute('id', archerId!);
  await page.locator('#toggle-log-btn').click();
  await expect(page.locator('.combat-log-drawer')).toContainText('Brenna converts remaining AP');
});

test('holding a move key walks continuously, spending MG, and stops on release', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Keyboard walking is independent of viewport.');
  await page.goto('/battle');
  const gauge = page.locator('#move-gauge');
  await expect(gauge).toHaveAttribute('aria-valuenow', '100');
  // Let the stage finish its first-frame setup so the walk runs at a steady frame rate.
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', /webgl|fallback/);
  await page.waitForTimeout(300);
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const walked = Number(await gauge.getAttribute('aria-valuenow'));
  // More than the two MG a single tap costs, and never more than the hold could reach.
  expect(walked).toBeLessThan(96);
  expect(walked).toBeGreaterThan(70);
  await page.waitForTimeout(400);
  expect(Number(await gauge.getAttribute('aria-valuenow'))).toBe(walked);
});

test('selecting and cancelling abilities is free, and Enter confirms only once', async ({
  page,
}) => {
  await timingOff(page);
  await page.goto('/battle');
  await page.locator('#ability-btn-piercing_arrow').click();
  await expect(page.locator('#confirm-ability-btn')).toBeEnabled();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Escape');
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  await expect(page.locator('#ability-btn-piercing_arrow')).toBeFocused();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');

  await page.locator('#ability-btn-quick_shot').click();
  await expect(page.locator('.unit-node.selected-target')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await expect(page.locator('.targeting-panel')).toHaveCount(0);

  await page.locator('#ability-btn-volley').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '35');
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '100');
});

test('the War Room fields one to four roster mercenaries and restart keeps the formation', async ({
  page,
}) => {
  const deployed = async () =>
    (await page.locator('.player-unit .unit-name').allTextContents()).map((n) => n.trim()).sort();

  // The first battle of a visit already fields the roster's squad.
  await page.goto('/battle');
  await expect(page.locator('.player-unit')).toHaveCount(4);
  expect(await deployed()).toEqual(['Aldric', 'Brenna', 'Cassian', 'Dara']);

  await page.goto('/squad');
  const squad = page.getByRole('region', { name: 'Player Vanguard Roster' });
  const enemyRoster = page.getByRole('region', { name: 'Enemy Vanguard Roster' });
  await expect(squad.locator('.slot-name')).toHaveText(['Aldric', 'Brenna', 'Cassian', 'Dara']);
  await expect(squad.locator('.reserve-btn')).toHaveCount(2);
  await expect(squad.locator('.reserve-btn').first()).toBeDisabled();
  await expect(enemyRoster.locator('.slot-item')).toHaveCount(4);
  await expect(page.locator('#add-to-enemy-squad-btn')).toBeDisabled();

  for (let remaining = 4; remaining > 1; remaining--) {
    await squad.locator('.slot-remove-btn').first().click();
    await expect(squad.locator('.slot-item')).toHaveCount(remaining - 1);
  }
  await expect(squad.locator('.slot-remove-btn')).toBeDisabled();
  await expect(page.locator('#deploy-squad-btn')).toContainText('1 vs 4');
  for (const name of ['Fiora', 'Aldric', 'Edric']) {
    await squad.getByRole('button', { name: `Add ${name} to the squad` }).click();
  }
  await expect(squad.locator('.slot-name')).toHaveText(['Dara', 'Fiora', 'Aldric', 'Edric']);
  await expect(squad.locator('.reserve-btn').first()).toBeDisabled();
  await page.locator('#deploy-squad-btn').click();
  await expect(page.locator('.player-unit')).toHaveCount(4);
  expect(await deployed()).toEqual(['Aldric', 'Dara', 'Edric', 'Fiora']);
  // Two members share lane one, standing apart. The stage positions units once it is ready.
  await expect
    .poll(async () => {
      const lefts = await page
        .locator('.combat-lane[data-lane="0"] .player-unit')
        .evaluateAll((units) => units.map((unit) => Math.round(unit.getBoundingClientRect().left)));
      return new Set(lefts).size;
    })
    .toBe(2);

  await page.locator('#battle-menu-btn').click();
  await page.locator('#restart-battle-btn').click();
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  expect(await deployed()).toEqual(['Aldric', 'Dara', 'Edric', 'Fiora']);
});

test('the battlefield remains playable when WebGL is unavailable', async ({ page }) => {
  await timingOff(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto('/battle');
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('app-battle-stage canvas')).toBeHidden();
  await expect(page.locator('.unit-sprite')).toHaveCount(8);
  await expect(page.locator('.arena-backdrop')).toBeVisible();
  await page.locator('#move-right-btn').click();
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  expect(errors).toEqual([]);
});

test('the WebGL stage draws the battle and falls back to DOM sprites if the GPU context is lost', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Renderer lifecycle is independent of viewport.');
  await timingOff(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/battle');
  const stage = page.locator('app-battle-stage');
  await expect(stage).toHaveAttribute('data-renderer', /webgl|fallback/);
  test.skip(
    (await stage.getAttribute('data-renderer')) !== 'webgl',
    'This browser has no WebGL2 (for example a GPU-less CI runner).',
  );
  await expect(stage.locator('canvas')).toBeVisible();
  await expect(page.locator('.unit-sprite')).toHaveCount(0);
  // Unit buttons are laid over their sprites: player troop on the left, enemies on the right.
  await expect
    .poll(async () => {
      const player = await page.locator('.player-unit').first().boundingBox();
      const enemy = await page.locator('.enemy-unit').first().boundingBox();
      return !!player && !!enemy && player.x + player.width < enemy.x;
    })
    .toBe(true);

  await page.evaluate(() =>
    document
      .querySelector<HTMLCanvasElement>('app-battle-stage canvas')
      ?.getContext('webgl2')
      ?.getExtension('WEBGL_lose_context')
      ?.loseContext(),
  );
  await expect(stage).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('.unit-sprite')).toHaveCount(8);
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  expect(errors).toEqual([]);
});

test('standard controller navigates the squad screen, confirms targets, and moves one step', async ({
  page,
}) => {
  await timingOff(page);
  await installController(page);
  // Start on a menu page: a short landscape battle screen hides the site navigation.
  await page.goto('/status');
  await expect(page.locator('.controller-status')).toContainText('Controller connected');
  await frames(page);
  await tap(page, { buttons: [9] });
  await expect(page.locator('#company-menu')).toBeVisible();
  await expect(page.locator('#nav-link-overworld')).toBeFocused();
  await page.locator('#nav-link-squad').focus();
  await controller(page, { buttons: [0] });
  await expect(page).toHaveURL(/\/squad$/);
  await controller(page);
  await page.locator('#deploy-squad-btn').focus();
  await controller(page, { buttons: [0] });
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await controller(page);
  // Wait for the stage so its start-up cannot stretch a button press into a held repeat.
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', /webgl|fallback/);
  await frames(page);

  await page.locator('#ability-btn-quick_shot').focus();
  await controller(page, { buttons: [0] });
  await expect(page.locator('.targeting-panel')).toBeVisible();
  await expect(page.locator('.unit-node.selected-target')).toBeFocused();
  await frames(page, 35);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await frames(page, 35);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await controller(page);

  await controller(page, { buttons: [5] });
  await expect(page.locator('.targeting-panel')).toBeVisible();
  await controller(page);
  await controller(page, { buttons: [1] });
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await controller(page);

  await controller(page, { axes: [0, 0, 0.4, 0] });
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '100');
  await controller(page, { axes: [0, 0, 0.8, 0] });
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await frames(page, 35);
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await controller(page);
  await controller(page, { axes: [0, 0, 0.8, 0] });
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '96');
});

test('held controller buttons require release after startup, reconnect, and window focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Lifecycle behavior is independent of viewport.');
  await installController(page, [0]);
  await page.goto('/battle');
  // In battle, the corner hint names the controller's buttons once one is connected.
  await expect(page.locator('.battle-hint')).toContainText('guard & end');
  await expect(page.locator('.battle-hint kbd').last()).toHaveText('X');
  await page.locator('#ability-btn-quick_shot').focus();
  await frames(page, 12);
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('.targeting-panel')).toBeVisible();

  await controller(page, { connected: false, buttons: [0] });
  await expect(page.locator('.controller-status')).toHaveCount(0);
  await controller(page, { buttons: [0] });
  // The shell's controller status is hidden in battle, but present once it reconnects.
  await expect(page.locator('.controller-status')).toBeAttached();
  await frames(page, 12);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await frames(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await frames(page, 12);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await frames(page, 12);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
});

test('default auto-battle reaches a result and restart creates a fresh manual battle', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Run the complete simulation once.');
  test.setTimeout(95_000);
  await page.goto('/battle');
  await page.locator('#speed-toggle-btn').click();
  await page.locator('#auto-battle-btn').click();
  await expect(page.locator('.battle-result-overlay')).toBeVisible({ timeout: 85_000 });
  await expect(page.locator('.result-heading')).toHaveText(/VICTORY ACHIEVED|VANGUARD DEFEATED/);
  // Win or lose, the battle pays gold, and EXP to each mercenary who fought.
  const gold = Number((await page.locator('#reward-gold').textContent())!.match(/\d+/)![0]);
  expect(gold).toBeGreaterThan(0);
  await expect(page.locator('.reward-list li')).toHaveCount(4);
  await expect(page.locator('.reward-list li').first()).toContainText('EXP');
  await page.locator('#modal-restart-btn').click();
  await expect(page.locator('.battle-result-overlay')).toHaveCount(0);
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('#auto-battle-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await page.goto('/roster');
  await expect(page.locator('#roster-gold')).toContainText(`${500 + gold} gold`);
});

test('ranged skills fire from a sweeping cursor, and a cursor left to run out misses', async ({
  page,
}) => {
  await page.goto('/battle');
  await expect(page.locator('#timing-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
  // Read the gauge before aiming: on a slow machine the cursor can run out before a later check.
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('.unit-node.selected-target').click();
  await expect(page.locator('.aim-panel')).toBeVisible();
  await expect(page.locator('#aim-fire-btn')).toBeFocused();
  const target = page.locator('.unit-node.aim-target');
  await expect(target).toHaveCount(1);
  const targetId = await target.getAttribute('id');
  const hp = await target.locator('.hp-track').getAttribute('aria-valuenow');

  // Untouched, the cursor runs off the end of the track: the AP is spent and nothing is hit.
  await expect(page.locator('.aim-panel')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await expect(page.locator(`[id="${targetId}"] .floating-text`)).toContainText('MISS');
  await expect(page.locator(`[id="${targetId}"] .hp-track`)).toHaveAttribute('aria-valuenow', hp!);

  // Space fires wherever focus is.
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('.aim-panel')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.aim-panel')).toHaveCount(0);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '60');

  // So does a click (or tap) anywhere on the screen, away from the aim bar.
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('.aim-panel')).toBeVisible();
  const box = (await page.locator('.arena-viewport').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(page.locator('.aim-panel')).toHaveCount(0);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '40');
});

test('melee skills chain into a combo when pressed again in the window', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Combo timing is independent of viewport.');
  // The window is about a second wide; a software-rendered stage can stall key events past it,
  // so the combo runs on a paused clock. Each press is followed by one frame so Angular renders.
  // Advancing the clock runs every queued frame, so use the cheap DOM stage, not WebGL.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      value: undefined,
      configurable: true,
    });
  });
  // Dara fights alone, front to front with the enemy Lancer: exactly at polearm reach.
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('lanes.roster.v1')!);
    raw.squadIds = ['merc_dara'];
    localStorage.setItem('lanes.roster.v1', JSON.stringify(raw));
  });
  await page.clock.install();
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Dara');
  await page.locator('#ability-btn-thrust').click();
  await expect(page.locator('.unit-node.selected-target')).toBeFocused();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  const press = async (key: string) => {
    await page.keyboard.press(key);
    await page.clock.runFor(16);
  };
  await press('Enter');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '85');
  await expect(page.locator('.combo-panel')).toContainText('1 hit');
  await expect(page.locator('#ability-btn-thrust')).toHaveClass(/chainable/);

  // Too early, before the strike lands: swallowed, so a double tap cannot drop the combo.
  await page.clock.runFor(184);
  await press('1');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '85');

  // On the white flash: a Just Cancel.
  await page.clock.runFor(400);
  await press('1');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '70');
  await expect(page.locator('.combo-panel')).toContainText('2 hits');

  // Left alone, the window closes.
  await page.clock.runFor(1300);
  await expect(page.locator('.combo-panel')).toHaveCount(0);
  await page.clock.resume();
  await page.locator('#toggle-log-btn').click();
  await expect(page.locator('.combat-log-drawer')).toContainText('JUST CANCEL');
});

test('a controller confirms a target, then fires the aim with A', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Controller input is independent of viewport.');
  await installController(page);
  await page.goto('/battle');
  await expect(page.locator('.controller-status')).toContainText('Controller connected');
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', /webgl|fallback/);
  await frames(page);
  await page.locator('#ability-btn-quick_shot').focus();
  await controller(page, { buttons: [0] });
  await expect(page.locator('.unit-node.selected-target')).toBeFocused();
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('#aim-fire-btn')).toBeFocused();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('.aim-panel')).toHaveCount(0);
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
});

test('turning timing off resolves skills at once and is remembered', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The preference is independent of viewport.');
  await page.goto('/battle');
  await page.locator('#timing-toggle-btn').click();
  await expect(page.locator('#timing-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.locator('#timing-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await expect(page.locator('.aim-panel')).toHaveCount(0);
});

test('battle speed is remembered, and shown in Options', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The preference is independent of viewport.');
  await page.goto('/battle');
  await expect(page.locator('#speed-toggle-btn')).toContainText('1x');
  await page.locator('#speed-toggle-btn').click();
  await page.reload();
  await expect(page.locator('#speed-toggle-btn')).toContainText('2x');
  await page.goto('/options');
  await expect(page.locator('#options-speed-btn')).toContainText('2x');
  await page.locator('#options-speed-btn').click();
  await expect(page.locator('#options-speed-btn')).toContainText('1x');
});

test('a veteran uses a skill its pattern taught, leaving a status on the target', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const neutral = { str: 17, mag: 17, tec: 17, vit: 17, stm: 17, spi: 17, agi: 17, con: 17 };
    const aptitudes = {
      str: 'C',
      mag: 'C',
      tec: 'C',
      vit: 'C',
      stm: 'C',
      spi: 'C',
      agi: 'C',
      con: 'C',
    };
    const brenna = {
      id: 'merc_brenna',
      name: 'Brenna',
      classId: 'archer',
      level: 9,
      aptitudes,
      stats: { ...neutral, sp: 10 },
      pattern: [
        { id: 'pinning_shot', level: 3 },
        { id: 'arrow_storm', level: 6 },
      ],
    };
    localStorage.setItem(
      'lanes.roster.v1',
      JSON.stringify({ version: 1, mercenaries: [brenna], squadIds: [brenna.id] }),
    );
    localStorage.setItem('lanes.timing.v1', 'off');
  });
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await expect(page.locator('.skill-btn')).toHaveCount(5);
  await expect(page.locator('#ability-btn-pinning_shot')).toContainText('Pinning Shot');
  await page.keyboard.press('4');
  await expect(page.locator('#ability-btn-pinning_shot')).toHaveClass(/selected/);
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '55');
  await expect(page.locator('.enemy-unit .status-badge')).toContainText(['STUN']);
});

test('an archer sets a snare ahead of it, one at a time', async ({ page }) => {
  await page.addInitScript(() => {
    const neutral = { str: 17, mag: 17, tec: 17, vit: 17, stm: 17, spi: 17, agi: 17, con: 17 };
    const grade = 'C';
    const aptitudes = Object.fromEntries(Object.keys(neutral).map((stat) => [stat, grade]));
    const brenna = {
      id: 'merc_brenna',
      name: 'Brenna',
      classId: 'archer',
      level: 5,
      aptitudes,
      stats: { ...neutral, sp: 10 },
      pattern: [
        { id: 'snare_trap', level: 2 },
        { id: 'pinning_shot', level: 6 },
      ],
    };
    localStorage.setItem(
      'lanes.roster.v1',
      JSON.stringify({ version: 1, mercenaries: [brenna], squadIds: [brenna.id] }),
    );
  });
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await page.locator('#ability-btn-snare_trap').click();
  await expect(page.locator('.targeting-panel')).toContainText('Snare Trap · 30 AP');
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '70');
  await expect(page.locator('.trap-marker.own')).toHaveCount(1);
  await expect(page.locator('.trap-marker.own')).toHaveAttribute(
    'aria-label',
    /^Your snare in lane/,
  );
  // A second snare waits until the first is sprung.
  await page.locator('#ability-btn-snare_trap').click();
  await expect(page.locator('#placement-warning')).toContainText('One at a time');
  await expect(page.locator('#confirm-ability-btn')).toBeDisabled();
});

test('the battle screen fits the window without scrolling, even with five skills', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('lanes.roster.v1')!);
    // Brenna, who acts first, has learned her whole pattern.
    raw.mercenaries[1].level = 9;
    localStorage.setItem('lanes.roster.v1', JSON.stringify(raw));
  });
  await page.goto('/battle');
  await expect(page.locator('.skill-btn')).toHaveCount(5);
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', /webgl|fallback/);
  const fits = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollHeight <= innerHeight && root.scrollWidth <= innerWidth;
    });
  expect(await fits()).toBe(true);
  // Every control the turn needs is on screen.
  for (const id of ['#ability-btn-quick_shot', '#move-right-btn', '#end-turn-btn']) {
    await expect(page.locator(id)).toBeInViewport();
  }
  await page.locator('#ability-btn-quick_shot').click();
  expect(await fits()).toBe(true);
  // Menus may scroll; leaving the battle releases the page.
  await page.goto('/roster');
  expect(await page.evaluate(() => document.body.classList.contains('battle-screen'))).toBe(false);
});

test('a full assist orb calls an ally to attack outside its turn, free of AP', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Assist rules are independent of viewport.');
  await timingOff(page);
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await expect(page.locator('#assist-btn')).toHaveCount(0);
  // Filling the gauge takes several turns of damage, so this test grants one orb directly.
  await page.evaluate(() => {
    const host = document.querySelector('app-battlefield');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ng.getComponent(host).battle.assistGauge.set({ player: 100, enemy: 0 });
  });
  await expect(page.locator('.troop-banner.player .orb.ready')).toHaveCount(1);
  await expect(page.locator('#assist-btn')).toContainText('Assist · 1');
  await page.keyboard.press('q');
  await expect(page.locator('.assist-panel')).toBeVisible();
  // Aldric's shield cannot reach the enemy line from where he starts; Cassian's smite can.
  await expect(page.locator('.assist-panel')).not.toContainText('Aldric');
  await expect(page.locator('.assist-panel')).toContainText('Cassian: Holy Smite');
  await page.keyboard.press('1');
  await expect(page.locator('.assist-panel')).toHaveCount(0);
  await expect(page.locator('#assist-btn')).toHaveCount(0);
  // Brenna, whose turn it is, spent nothing.
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
  await page.locator('#toggle-log-btn').click();
  await expect(page.locator('.combat-log-drawer')).toContainText("Cassian answers Brenna's call");
});

test('melee skills need the enemy within reach; walking closer brings it in', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Reach rules are independent of viewport.');
  await timingOff(page);
  await page.addInitScript(() => {
    const raw = JSON.parse(localStorage.getItem('lanes.roster.v1')!);
    raw.squadIds = ['merc_dara'];
    localStorage.setItem('lanes.roster.v1', JSON.stringify(raw));
  });
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Dara');
  // Two steps back puts the enemy Lancer just beyond her polearm.
  await page.locator('#move-left-btn').click();
  await page.locator('#move-left-btn').click();
  await page.locator('#ability-btn-thrust').click();
  await expect(page.locator('#reach-warning')).toBeVisible();
  await expect(page.locator('#confirm-ability-btn')).toBeDisabled();
  await page.locator('#ability-btn-thrust').click();
  await page.locator('#move-right-btn').click();
  await page.locator('#move-right-btn').click();
  await page.locator('#ability-btn-thrust').click();
  await expect(page.locator('#reach-warning')).toHaveCount(0);
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '85');
});

test('a controller plays a whole turn: walk, log, assist, Guard and End, and the verdict', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Controller input is independent of viewport.');
  await timingOff(page);
  await installController(page);
  await page.goto('/battle');
  await expect(page.locator('app-battle-stage')).toHaveAttribute('data-renderer', /webgl|fallback/);
  await frames(page);
  // The corner hint names the controller's buttons.
  await expect(page.locator('.battle-hint')).toContainText(/LT\s*RT\s*walk/);
  // A controller player's turn starts on the first skill.
  await expect(page.locator('#ability-btn-quick_shot')).toBeFocused();
  await expect(page.locator('#end-turn-btn .pad-glyph')).toHaveText('X');

  // Holding RT walks on, further than a single step.
  await controller(page, { buttons: [7] });
  await frames(page, 40);
  await controller(page);
  expect(Number(await page.locator('#move-gauge').getAttribute('aria-valuenow'))).toBeLessThan(96);

  // View opens and closes the combat log.
  await tap(page, { buttons: [8] });
  await expect(page.locator('.combat-log-drawer')).toBeVisible();
  await tap(page, { buttons: [8] });
  await expect(page.locator('.combat-log-drawer')).toHaveCount(0);

  // Y opens the assist panel on its first ally; B closes it.
  await page.evaluate(() => {
    const host = document.querySelector('app-battlefield');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ng.getComponent(host).battle.assistGauge.set({ player: 100, enemy: 0 });
  });
  await tap(page, { buttons: [3] });
  await expect(page.locator('.assist-panel')).toBeVisible();
  await expect(page.locator('.assist-options button').first()).toBeFocused();
  await tap(page, { buttons: [1] });
  await expect(page.locator('.assist-panel')).toHaveCount(0);

  // X is Guard and End.
  const acting = await page.locator('.unit-node.acting-unit').getAttribute('id');
  await tap(page, { buttons: [2] });
  await expect(page.locator('.unit-node.acting-unit')).not.toHaveAttribute('id', acting!);

  // The verdict takes focus, so A answers it.
  await page.evaluate(() => {
    const host = document.querySelector('app-battlefield');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(host).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await expect(page.locator('#modal-restart-btn')).toBeFocused();
  await tap(page, { buttons: [0] });
  await expect(page.locator('.battle-result-overlay')).toHaveCount(0);
});

test('a killing blow shows its number, and a skirmish verdict leads back to the map', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Battle feedback is independent of viewport.');
  await timingOff(page);
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await page.locator('#ability-btn-quick_shot').click();
  // Leave the target one hit from falling.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(
      document.querySelector('app-battlefield'),
    ).battle;
    battle.units().find((unit: { id: string }) => unit.id === battle.targetedUnitId()).currentHp =
      1;
  });
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('.unit-node.fallen .floating-text')).toContainText('HP');
  await expect(page.locator('.unit-node.fallen')).toHaveCount(0, { timeout: 5000 });

  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(
      document.querySelector('app-battlefield'),
    ).battle;
    for (const unit of battle.enemyUnits()) unit.takeDamage(99999);
    battle.endCurrentTurn(true);
  });
  await expect(page.locator('.command-deck')).toHaveCount(0);
  await expect(page.locator('#modal-restart-btn')).toBeVisible();
  await page.locator('#modal-map-btn').click();
  await expect(page).toHaveURL(/\/$/);
});

test('pressing a foe aims the first skill that reaches it, and pressing again attacks', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Targeting is independent of viewport.');
  await timingOff(page);
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  // The foe Quick Shot (her first skill) can reach.
  const foe = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const battle = (window as any).ng.getComponent(
      document.querySelector('app-battlefield'),
    ).battle;
    battle.selectAbility('quick_shot');
    const id = battle.validTargets()[0].id;
    battle.selectAbility(null);
    return id;
  });
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  await page.locator(`[id="unit-${foe}"]`).click();
  await expect(page.locator('.targeting-panel')).toContainText('Quick Shot');
  await expect(page.locator(`[id="unit-${foe}"]`)).toHaveClass(/selected-target/);
  await page.locator(`[id="unit-${foe}"]`).click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
});

test('an attack is voiced, and turning sound off in Options silences it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Sound is independent of viewport.');
  await timingOff(page);
  // Count the oscillators each cue starts.
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).oscillators = 0;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).oscillators++;
      return original.call(this);
    };
  });
  const oscillators = () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.evaluate(() => (window as any).oscillators as number);
  await page.goto('/battle');
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Brenna');
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect.poll(oscillators).toBeGreaterThan(2);

  await page.goto('/options');
  await page.locator('#options-sound-btn').click();
  await expect(page.locator('#options-sound-btn')).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/battle');
  const before = await oscillators();
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  await page.waitForTimeout(800);
  expect(await oscillators()).toBe(before);
});
