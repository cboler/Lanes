import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT,
  applyEquipment,
  canWear,
  equipment,
  openTier,
  parseEquipped,
  pieceBonus,
  pieceName,
  reforgeCost,
  rollDrop,
  sellValue,
} from './equipment.model';
import { REGIONS } from './overworld-regions';
import { allMissions } from './campaign.model';
import { deriveCombatStats, generateMercenary, seededRandom } from './mercenary.model';
import { FIGHTER_CLASS } from './unit-class.model';

describe('equipment', () => {
  it('has unique ids, weapons and armour for every class, and accessories for all', () => {
    expect(new Set(EQUIPMENT.map((e) => e.id)).size).toBe(EQUIPMENT.length);
    for (const classId of ['fighter', 'cleric', 'archer', 'witch', 'lancer', 'gunner']) {
      for (const slot of ['weapon', 'armor'] as const) {
        const fits = EQUIPMENT.filter((e) => e.slot === slot && canWear(classId, e));
        expect(fits.map((e) => e.tier).sort()).toEqual([1, 2, 3]);
      }
    }
    expect(EQUIPMENT.filter((e) => e.slot === 'accessory').every((e) => !e.classes)).toBe(true);
  });

  it('reforges up to +5, each step a fifth stronger and dearer, and sells for 40%', () => {
    const piece = { uid: 'p', base: 'sword-2', plus: 0 };
    const base = equipment('sword-2')!.bonus.attack!;
    expect(pieceBonus(piece).attack).toBe(base);
    expect(pieceBonus({ ...piece, plus: 5 }).attack).toBe(base * 2);
    expect(reforgeCost(piece)).toBe(150);
    expect(reforgeCost({ ...piece, plus: 1 })).toBe(300);
    expect(reforgeCost({ ...piece, plus: 5 })).toBeNull();
    expect(pieceName({ ...piece, plus: 2 })).toBe('Steel Sword +2');
    expect(sellValue(piece)).toBe(120);
    expect(sellValue({ ...piece, plus: 1 })).toBe(Math.floor((300 + 150) * 0.4));
  });

  it('adds its bonuses to the battle sheet, never magic to a class without it', () => {
    const merc = generateMercenary('fighter', seededRandom(4));
    const bare = deriveCombatStats(FIGHTER_CLASS, merc);
    const geared = deriveCombatStats(FIGHTER_CLASS, {
      ...merc,
      equipment: {
        weapon: { uid: 'a', base: 'sword-1', plus: 0 },
        armor: { uid: 'b', base: 'plate-1', plus: 0 },
      },
    });
    expect(geared.attack).toBeGreaterThan(bare.attack);
    expect(geared.defense).toBeGreaterThan(bare.defense);
    expect(geared.maxHp).toBeGreaterThan(bare.maxHp);
    expect(
      applyEquipment(bare, { weapon: { uid: 'c', base: 'staff-3', plus: 0 } }).magicAttack,
    ).toBe(0);
  });

  it('keeps only pieces of the right slot that the class can wear when loaded', () => {
    expect(
      parseEquipped(
        {
          weapon: { uid: 'a', base: 'longbow-1', plus: 0 },
          armor: { uid: 'b', base: 'plate-1', plus: 9 },
          accessory: { uid: 'c', base: 'sword-1', plus: 0 },
        },
        'fighter',
      ),
    ).toEqual({});
    expect(parseEquipped({ weapon: { uid: 'a', base: 'sword-1', plus: 3 } }, 'fighter')).toEqual({
      weapon: { uid: 'a', base: 'sword-1', plus: 3 },
    });
  });

  it('drops pieces the squad can use, of the open tier or the next one up', () => {
    expect([1, 3, 4, 7, 8, 30].map(openTier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(rollDrop(() => 0, 0, 5, ['fighter'])).toBeNull();
    expect(rollDrop(() => 0.99, 0.5, 5, ['fighter'])).toBeNull();
    const random = seededRandom(7);
    const tiers = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const id = rollDrop(random, 1, 4, ['archer']);
      const item = equipment(id!)!;
      expect(canWear('archer', item)).toBe(true);
      tiers.add(item.tier);
    }
    expect([...tiers].sort()).toEqual([2, 3]);
  });

  it('only names real equipment on the map and in story rewards', () => {
    const gear = [
      ...REGIONS.flatMap((region) => region.nodes.flatMap((node) => node.gear ?? [])),
      ...allMissions().flatMap((mission) => mission.reward.gear ?? []),
    ];
    expect(gear.length).toBeGreaterThan(5);
    for (const id of gear) expect(equipment(id), id).toBeDefined();
  });
});
