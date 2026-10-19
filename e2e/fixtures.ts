import { expect, test as base } from '@playwright/test';

/**
 * A fixed roster for browser tests: one mercenary per class with neutral stats, so each
 * fights exactly like its class's baseline. The squad matches the old default formation
 * (Fighter, Archer, Cleric, Lancer), so turn order and gauges are predictable.
 */
const neutral = { str: 17, mag: 17, tec: 17, vit: 17, stm: 17, spi: 17, agi: 17, con: 17, sp: 10 };
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
const merc = (id: string, name: string, classId: string) => ({
  id,
  name,
  classId,
  level: 1,
  aptitudes,
  stats: neutral,
});

export const ROSTER = [
  merc('merc_aldric', 'Aldric', 'fighter'),
  merc('merc_brenna', 'Brenna', 'archer'),
  merc('merc_cassian', 'Cassian', 'cleric'),
  merc('merc_dara', 'Dara', 'lancer'),
  merc('merc_edric', 'Edric', 'witch'),
  merc('merc_fiora', 'Fiora', 'gunner'),
];

export const test = base.extend<{ seedRoster: boolean }>({
  /** Off for tests of the randomly generated starter roster. */
  seedRoster: [true, { option: true }],
  page: async ({ page, seedRoster }, use) => {
    if (seedRoster) {
      // Only when empty, so a test's own roster changes survive reloads.
      await page.addInitScript((roster) => {
        if (!localStorage.getItem('lanes.roster.v1')) {
          localStorage.setItem(
            'lanes.roster.v1',
            JSON.stringify({
              version: 1,
              mercenaries: roster,
              squadIds: roster.slice(0, 4).map((m) => m.id),
            }),
          );
        }
      }, ROSTER);
    }
    await use(page);
  },
});

export { expect };
