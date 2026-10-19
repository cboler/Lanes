import { describe, expect, it } from 'vitest';
import { TIERS, generateBoard, generateContract, parseContract, veteran } from './contract.model';
import { CLASS_FOCUS, generateMercenary, seededRandom } from './mercenary.model';
import { battleExp, battleGold } from './progression.model';
import { ALL_CLASSES } from './unit-class.model';

describe('contracts', () => {
  it('raises a veteran to its level with every point invested in its class focus', () => {
    const rookie = veteran('fighter', 1, seededRandom(4));
    const elder = veteran('fighter', 6, seededRandom(4));
    expect(elder.level).toBe(6);
    expect(elder.statPoints).toBe(0);
    const focus = CLASS_FOCUS['fighter'];
    const gained = focus.reduce((sum, stat) => sum + elder.stats[stat] - rookie.stats[stat], 0);
    // Five points a level for five levels, plus aptitude bonus points.
    expect(gained).toBeGreaterThanOrEqual(25);
    expect(elder.stats.mag).toBe(rookie.stats.mag);
  });

  it('scales each tier to the squad: size, level and reward', () => {
    const board = generateBoard(4, seededRandom(9));
    expect(board.map((c) => c.tier)).toEqual(['easy', 'normal', 'hard']);
    expect(board.map((c) => c.level)).toEqual([3, 4, 6]);
    expect(board.map((c) => c.enemies.length)).toEqual([3, 4, 4]);
    expect(board.map((c) => c.rewardMultiplier)).toEqual([1.2, 1.6, 2.2]);
    expect(new Set(board.map((c) => c.band)).size).toBe(3);
    for (const contract of board) {
      expect(contract.enemies.every((e) => e.level === contract.level)).toBe(true);
      const lead = ALL_CLASSES.find((cls) => cls.id === contract.enemies[0].classId)!;
      expect(['tank', 'melee']).toContain(lead.role);
    }
    expect(generateContract('easy', 1, seededRandom(1)).level).toBe(1);
  });

  it('pays more for harder contracts', () => {
    const report = { id: 'r', outcome: 'victory' as const, enemiesDefeated: 4, mercenaries: [] };
    const merc = { ...generateMercenary('archer', seededRandom(2)) };
    merc.stats = { ...merc.stats, tec: 17 };
    const hard = { ...report, rewardMultiplier: TIERS.hard.reward };
    expect(battleGold(hard)).toBe(Math.round(battleGold(report) * 2.2));
    expect(battleExp(hard, merc, true)).toBeGreaterThan(battleExp(report, merc, true));
  });

  it('round-trips a saved contract and never trusts a saved reward', () => {
    const contract = generateContract('hard', 3, seededRandom(5));
    const copy = parseContract(JSON.parse(JSON.stringify(contract)));
    expect(copy).toEqual(contract);
    expect(parseContract({ ...contract, rewardMultiplier: 99 })?.rewardMultiplier).toBe(2.2);
    expect(parseContract({ ...contract, tier: 'legendary' })).toBeNull();
    expect(parseContract({ ...contract, enemies: [] })).toBeNull();
  });
});
