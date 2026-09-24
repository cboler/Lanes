import { expect, test, type Page } from '@playwright/test';

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

test('movement, attacks, and Guard use independent turn resources', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('.unit-node.acting-unit .unit-name')).toHaveText('Player Archer');
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
  await expect(page.locator('.combat-log-drawer')).toContainText(
    'Player Archer converts remaining AP',
  );
});

test('selecting and cancelling abilities is free, and Enter confirms only once', async ({
  page,
}) => {
  await page.goto('/');
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

test('squads enforce one to four members and restart preserves the deployed formation', async ({
  page,
}) => {
  await page.goto('/squad');
  const playerRoster = page.getByRole('region', { name: 'Player Vanguard Roster' });
  const enemyRoster = page.getByRole('region', { name: 'Enemy Vanguard Roster' });
  await expect(playerRoster.locator('.slot-item')).toHaveCount(4);
  await expect(enemyRoster.locator('.slot-item')).toHaveCount(4);
  await expect(page.locator('#add-to-player-squad-btn')).toBeDisabled();
  await expect(page.locator('#add-to-enemy-squad-btn')).toBeDisabled();

  for (let remaining = 4; remaining > 1; remaining--) {
    await playerRoster.locator('.slot-remove-btn').last().click();
    await expect(playerRoster.locator('.slot-item')).toHaveCount(remaining - 1);
  }
  await expect(playerRoster.locator('.slot-remove-btn')).toBeDisabled();
  await expect(page.locator('#deploy-squad-btn')).toContainText('1 vs 4');
  for (let added = 0; added < 3; added++) {
    await page.locator('#add-to-player-squad-btn').click();
    await expect(playerRoster.locator('.slot-item')).toHaveCount(added + 2);
  }
  await expect(playerRoster.locator('.slot-item')).toHaveCount(4);
  await expect(page.locator('#add-to-player-squad-btn')).toBeDisabled();
  await page.locator('#deploy-squad-btn').click();
  await expect(page.locator('.player-unit .unit-name')).toHaveText(Array(4).fill('Player Fighter'));
  const firstLanePositions = await page
    .locator('.combat-lane[data-lane="0"] .player-unit')
    .evaluateAll((units) => units.map((unit) => (unit as HTMLElement).style.left));
  expect(new Set(firstLanePositions).size).toBe(2);

  await page.locator('#restart-battle-btn').click();
  await expect(page.locator('.player-unit .unit-name')).toHaveText(Array(4).fill('Player Fighter'));
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
});

test('the battlefield remains playable when WebGL is unavailable', async ({ page }) => {
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
  await page.goto('/');
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('app-arena-scene canvas')).toBeHidden();
  await expect(page.locator('.arena-backdrop')).toBeVisible();
  await page.locator('#move-right-btn').click();
  await expect(page.locator('#move-gauge')).toHaveAttribute('aria-valuenow', '98');
  await page.locator('#ability-btn-quick_shot').click();
  await page.locator('#confirm-ability-btn').click();
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '80');
  expect(errors).toEqual([]);
});

test('standard controller navigates the squad screen, confirms targets, and moves one step', async ({
  page,
}) => {
  await installController(page);
  await page.goto('/');
  await expect(page.locator('.controller-status')).toContainText('Controller connected');
  await frames(page);
  await page.locator('#nav-link-home').focus();
  await controller(page, { buttons: [15] });
  await expect(page.locator('#nav-link-squad')).toBeFocused();
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page).toHaveURL(/\/squad$/);
  await controller(page);
  await page.locator('#deploy-squad-btn').focus();
  await controller(page, { buttons: [0] });
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await controller(page);

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
  await page.goto('/');
  await expect(page.locator('.controller-status')).toBeVisible();
  await page.locator('#ability-btn-quick_shot').focus();
  await frames(page, 12);
  await expect(page.locator('.targeting-panel')).toHaveCount(0);
  await controller(page);
  await controller(page, { buttons: [0] });
  await expect(page.locator('.targeting-panel')).toBeVisible();

  await controller(page, { connected: false, buttons: [0] });
  await expect(page.locator('.controller-status')).toHaveCount(0);
  await controller(page, { buttons: [0] });
  await expect(page.locator('.controller-status')).toBeVisible();
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
  await page.goto('/');
  await page.locator('#speed-toggle-btn').click();
  await page.locator('#auto-battle-btn').click();
  await expect(page.locator('.battle-result-overlay')).toBeVisible({ timeout: 85_000 });
  await expect(page.locator('.result-heading')).toHaveText(/VICTORY ACHIEVED|VANGUARD DEFEATED/);
  await page.locator('#modal-restart-btn').click();
  await expect(page.locator('.battle-result-overlay')).toHaveCount(0);
  await expect(page.locator('.unit-node')).toHaveCount(8);
  await expect(page.locator('#auto-battle-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#action-gauge')).toHaveAttribute('aria-valuenow', '100');
});
