import { test, expect } from '@playwright/test';

test.describe('Lanes Tactical RPG Responsive Shell Smoke Tests', () => {
  test('should load application cleanly without runtime errors or horizontal overflow', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    // 1. Root shell and brand verification
    await expect(page.locator('.brand-title')).toBeVisible();
    await expect(page.locator('#starter-title')).toHaveText('Lanes');

    // 2. Primary layout elements are visible
    await expect(page.locator('header[role="banner"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('footer[role="contentinfo"]')).toBeVisible();

    // 3. Prevent accidental horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // 4. Verify 3 tactical combat lanes exist
    const lanes = page.locator('.combat-lane');
    await expect(lanes).toHaveCount(3);

    // 5. Navigate to Squad Builder
    const squadLink = page.locator('#nav-link-squad');
    await expect(squadLink).toBeVisible();
    await squadLink.click();

    await expect(page).toHaveURL(/.*squad/);
    await expect(page.locator('.squad-builder-container')).toBeVisible();
    await expect(page.locator('#deploy-squad-btn')).toBeVisible();

    // Verify 6 unit classes in picker
    const classButtons = page.locator('.class-pick-btn');
    await expect(classButtons).toHaveCount(6);

    // 6. Navigate back to Battlefield via deploy
    await page.locator('#deploy-squad-btn').click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.locator('.battlefield-container')).toBeVisible();

    // 7. Client-side navigation to status screen
    const statusLink = page.locator('#nav-link-status');
    await expect(statusLink).toBeVisible();
    await statusLink.click();

    await expect(page).toHaveURL(/.*status/);
    await expect(page.locator('#status-heading')).toBeVisible();
    await expect(page.locator('#base-uri-val')).toBeVisible();

    // Verify no horizontal overflow on status route
    const statusOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(statusOverflow).toBeFalsy();

    // 8. Return to battlefield
    await page.locator('#back-home-link').click();
    await expect(page).toHaveURL(/\/?$/);
    await expect(page.locator('#starter-title')).toBeVisible();

    // 9. Zero unhandled console errors or exceptions
    expect(consoleErrors).toEqual([]);
  });

  test('should engage auto-battle, render chibi sprites, and resolve combat maneuvers automatically', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Chibi sprites rendered in lanes
    const sprites = page.locator('app-unit-sprite .chibi-sprite-svg');
    await expect(sprites.first()).toBeVisible();
    await expect(sprites).toHaveCount(6);

    // 2. Auto-Battle toggle
    const autoBtn = page.locator('#auto-battle-btn');
    await expect(autoBtn).toBeVisible();
    await expect(autoBtn).toContainText('OFF');

    // 3. Engage Auto-Battle
    await autoBtn.click();
    await expect(autoBtn).toContainText('ON');
    await expect(autoBtn).toHaveClass(/active-gold/);

    // 4. Set 2x speed for fast resolution
    const speedBtn = page.locator('#speed-toggle-btn');
    await speedBtn.click();
    await expect(speedBtn).toContainText('2x');

    // 5. Open Combat Log and verify maneuvers are being executed automatically
    const logBtn = page.locator('#toggle-log-btn');
    await logBtn.click();
    const logDrawer = page.locator('.combat-log-drawer');
    await expect(logDrawer).toBeVisible();

    // Wait for at least 3 logs to accumulate as units act autonomously
    await expect(async () => {
      const logs = page.locator('.log-entry');
      const count = await logs.count();
      expect(count).toBeGreaterThan(2);
    }).toPass({ timeout: 10000 });
  });
});
