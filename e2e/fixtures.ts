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

export const test = base.extend<{ seedRoster: boolean; seedCampaign: boolean }>({
  /** Off for tests of the randomly generated starter roster. */
  seedRoster: [true, { option: true }],
  // Non-story checks exercise free exploration without story encounters interrupting their route.
  seedCampaign: [true, { option: true }],
  page: async ({ page, seedRoster, seedCampaign }, use) => {
    if (seedCampaign)
      await page.addInitScript(() => {
        if (!localStorage.getItem('lanes.campaign.v1'))
          localStorage.setItem(
            'lanes.campaign.v1',
            JSON.stringify({
              version: 1,
              // Every mission, so free-exploration tests see no story squad.
              cleared: [
                ...['north-road', 'the-ford', 'thorn-keep', 'vargr'],
                ...['s1-docks', 's1-lighthouse', 's1-fort'],
                ...['v2-trenches', 'v2-walls', 'v2-keep'],
              ],
            }),
          );
      });
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
