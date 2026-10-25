import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterService } from './roster.service';
import {
  RECRUIT_COUNT,
  REFRESH_COST,
  ROSTER_LIMIT,
  STARTING_GOLD,
  hireCost,
} from '../models/progression.model';

describe('RosterService', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };

  beforeEach(() => {
    values.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    TestBed.resetTestingModule();
  });

  it('creates and saves a starter roster with a four-member squad', () => {
    const service = TestBed.inject(RosterService);
    expect(service.mercenaries()).toHaveLength(6);
    expect(service.squad()).toHaveLength(4);
    expect(values.has('lanes.roster.v1')).toBe(true);
  });

  it('keeps the same mercenaries and squad after a reload', () => {
    const first = TestBed.inject(RosterService);
    const dropped = first.squadIds()[0];
    first.toggleSquad(dropped);
    first.toggleSquad(first.mercenaries()[5].id);
    const before = { roster: first.mercenaries(), squad: first.squadIds() };
    expect(before.squad).not.toContain(dropped);

    TestBed.resetTestingModule();
    const second = TestBed.inject(RosterService);
    expect(second.mercenaries()).toEqual(before.roster);
    expect(second.squadIds()).toEqual(before.squad);
  });

  it('enforces one to four squad members', () => {
    const service = TestBed.inject(RosterService);
    service.toggleSquad(service.mercenaries()[5].id);
    expect(service.squadIds()).toHaveLength(4);
    for (const id of [...service.squadIds()]) service.toggleSquad(id);
    expect(service.squadIds()).toHaveLength(1);
  });

  it('replaces corrupt or invalid storage with a fresh roster and says so', () => {
    storage.setItem('lanes.roster.v1', '{invalid');
    let service = TestBed.inject(RosterService);
    expect(service.mercenaries()).toHaveLength(6);
    expect(service.warning()).toContain('could not be loaded');

    TestBed.resetTestingModule();
    storage.setItem(
      'lanes.roster.v1',
      JSON.stringify({ version: 1, mercenaries: [{}], squadIds: [] }),
    );
    service = TestBed.inject(RosterService);
    expect(service.mercenaries()).toHaveLength(6);
    expect(service.warning()).toContain('could not be loaded');
  });

  it('drops unknown squad ids from saved data', () => {
    const first = TestBed.inject(RosterService);
    const keep = first.mercenaries()[2].id;
    const saved = JSON.parse(values.get('lanes.roster.v1')!);
    saved.squadIds = ['ghost', keep];
    storage.setItem('lanes.roster.v1', JSON.stringify(saved));
    TestBed.resetTestingModule();
    expect(TestBed.inject(RosterService).squadIds()).toEqual([keep]);
  });

  it('keeps working in memory when device storage throws', () => {
    const spy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    const service = TestBed.inject(RosterService);
    expect(service.mercenaries()).toHaveLength(6);
    expect(service.warning()).toContain('storage is unavailable');
    spy.mockRestore();
  });

  describe('economy', () => {
    it('starts with a purse and a board of recruits, and saves both', () => {
      const service = TestBed.inject(RosterService);
      expect(service.gold()).toBe(STARTING_GOLD);
      expect(service.recruits()).toHaveLength(RECRUIT_COUNT);
      TestBed.resetTestingModule();
      const again = TestBed.inject(RosterService);
      expect(again.gold()).toBe(STARTING_GOLD);
      expect(again.recruits()).toEqual(service.recruits());
    });

    it('upgrades a version 1 save with the opening purse and a board', () => {
      const first = TestBed.inject(RosterService);
      const saved = JSON.parse(values.get('lanes.roster.v1')!);
      storage.setItem(
        'lanes.roster.v1',
        JSON.stringify({ version: 1, mercenaries: saved.mercenaries, squadIds: saved.squadIds }),
      );
      TestBed.resetTestingModule();
      const upgraded = TestBed.inject(RosterService);
      expect(upgraded.warning()).toBe('');
      expect(upgraded.mercenaries()).toEqual(first.mercenaries());
      expect(upgraded.gold()).toBe(STARTING_GOLD);
      expect(upgraded.recruits()).toHaveLength(RECRUIT_COUNT);
    });

    it('hires a recruit for its price, and refuses when gold or room runs out', () => {
      const service = TestBed.inject(RosterService);
      const recruit = service.recruits()[0];
      const price = hireCost(recruit);
      expect(service.hire(recruit.id)).toBe(true);
      expect(service.gold()).toBe(STARTING_GOLD - price);
      expect(service.mercenaries().at(-1)).toEqual(recruit);
      expect(service.recruits().some((r) => r.id === recruit.id)).toBe(false);
      expect(service.hire(recruit.id)).toBe(false);

      service.gold.set(0);
      expect(service.hire(service.recruits()[0].id)).toBe(false);
      expect(service.refreshRecruits()).toBe(false);
      service.gold.set(100_000);
      while (service.mercenaries().length < ROSTER_LIMIT) {
        if (!service.recruits().length) service.refreshRecruits();
        service.hire(service.recruits()[0].id);
      }
      if (!service.recruits().length) service.refreshRecruits();
      expect(service.hire(service.recruits()[0].id)).toBe(false);
    });

    it('charges for a new board', () => {
      const service = TestBed.inject(RosterService);
      const before = service.recruits();
      expect(service.refreshRecruits()).toBe(true);
      expect(service.gold()).toBe(STARTING_GOLD - REFRESH_COST);
      expect(service.recruits()).not.toEqual(before);
    });

    it('dismisses a mercenary but always keeps one in the roster and the squad', () => {
      const service = TestBed.inject(RosterService);
      for (const id of service.squadIds().slice(1)) service.toggleSquad(id);
      const only = service.squadIds()[0];
      expect(service.dismiss(only)).toBe(true);
      expect(service.squadIds()).toHaveLength(1);
      expect(service.squadIds()[0]).not.toBe(only);
      while (service.mercenaries().length > 1) service.dismiss(service.mercenaries()[0].id);
      expect(service.dismiss(service.mercenaries()[0].id)).toBe(false);
    });

    it('pays a battle once, levelling mercenaries who earn enough', () => {
      const service = TestBed.inject(RosterService);
      const [a, b] = service.squad();
      const report = {
        id: 'battle-1',
        outcome: 'victory' as const,
        enemiesDefeated: 4,
        mercenaries: [
          { id: a.id, survived: true },
          { id: b.id, survived: false },
          { id: 'dismissed', survived: true },
        ],
      };
      const rewards = service.claimRewards(report);
      expect(rewards.gold).toBeGreaterThan(0);
      expect(rewards.mercenaries.map((m) => m.id)).toEqual([a.id, b.id]);
      expect(rewards.mercenaries[0].exp).toBeGreaterThan(rewards.mercenaries[1].exp);
      expect(service.gold()).toBe(STARTING_GOLD + rewards.gold);
      const levelled = service.mercenaries().find((m) => m.id === a.id)!;
      expect(levelled.level).toBe(rewards.mercenaries[0].level);

      expect(service.claimRewards(report)).toBe(rewards);
      expect(service.gold()).toBe(STARTING_GOLD + rewards.gold);
    });

    it('invests stat points and saves them', () => {
      const service = TestBed.inject(RosterService);
      const merc = service.mercenaries()[0];
      expect(service.invest(merc.id, 'str')).toBe(false);
      service.mercenaries.update((list) =>
        list.map((m) => (m.id === merc.id ? { ...m, statPoints: 1 } : m)),
      );
      expect(service.invest(merc.id, 'str')).toBe(true);
      TestBed.resetTestingModule();
      const saved = TestBed.inject(RosterService).mercenaries()[0];
      expect(saved.statPoints).toBe(0);
      expect(saved.invested.str).toBe(1);
      expect(saved.stats.str).toBeGreaterThan(merc.stats.str);
    });

    it('equips supports within SP and names skills a level-up teaches', () => {
      const service = TestBed.inject(RosterService);
      const merc = service.mercenaries()[0];
      expect(service.toggleSupport(merc.id, 'vigor')).toBe(true);
      expect(service.mercenaries()[0].supports).toEqual(['vigor']);
      expect(service.toggleSupport(merc.id, 'might')).toBe(false);
      expect(service.toggleSupport(merc.id, 'vigor')).toBe(true);
      expect(service.mercenaries()[0].supports).toEqual([]);

      const step = merc.pattern[0];
      const rewards = service.claimRewards({
        id: 'learn',
        outcome: 'victory',
        enemiesDefeated: 4,
        mercenaries: [{ id: merc.id, survived: true }],
      });
      const paid = rewards.mercenaries[0];
      const skill = service.classOf(merc).advancedAbilities.find((a) => a.id === step.id)!;
      expect(paid.learned.includes(skill.name)).toBe(paid.level >= step.level);
    });
  });

  it('sells scrolls, spends them on mercenaries, and keeps the inventory after a reload', () => {
    const service = TestBed.inject(RosterService);
    const merc = service.mercenaries()[0];
    expect(service.buy('tactics')).toBe(true);
    expect(service.gold()).toBe(STARTING_GOLD - 300);
    expect(service.buy('tactics')).toBe(false);
    expect(service.count('tactics')).toBe(1);
    const stat = (['str', 'mag', 'tec'] as const).find((s) => merc.aptitudes[s] !== 'S')!;
    expect(service.useTactics(merc.id, stat)).toBe(true);
    expect(service.count('tactics')).toBe(0);
    expect(service.useTactics(merc.id, stat)).toBe(false);
    expect(service.mercenaries()[0].aptitudes[stat]).not.toBe(merc.aptitudes[stat]);

    service.grant(0, ['charm']);
    // Nothing invested yet: the scroll is kept.
    expect(service.useCharm(merc.id)).toBe(false);
    expect(service.count('charm')).toBe(1);

    TestBed.resetTestingModule();
    expect(TestBed.inject(RosterService).items()).toEqual({ charm: 1 });
  });

  it('scribes a learned skill into a grimoire and teaches it to another of the class', () => {
    const service = TestBed.inject(RosterService);
    const teacher = { ...service.mercenaries()[0], level: 10 };
    const pool = service.classOf(teacher).advancedAbilities.map((a) => a.id);
    const student = {
      ...teacher,
      id: 'student',
      name: 'Student',
      pattern: pool
        .filter((id) => id !== teacher.pattern[0].id)
        .slice(0, 2)
        .map((id, i) => ({ id, level: 3 + i })),
    };
    service.mercenaries.set([teacher, student]);
    const skill = teacher.pattern[0].id;
    expect(service.scribe(teacher.id, skill)).toBe(true);
    expect(service.gold()).toBe(STARTING_GOLD - 150);
    expect(service.useGrimoire('student', `grimoire:${skill}`, student.pattern[1].id)).toBe(true);
    expect(service.mercenaries()[1].pattern[1]).toEqual({ id: skill, level: 4 });
    expect(service.count(`grimoire:${skill}`)).toBe(0);
  });

  it('grows bonds from a battle report, names new ranks, and drops a dismissed mercenary', () => {
    const service = TestBed.inject(RosterService);
    const [a, b, c] = service.mercenaries();
    const fought = {
      id: 'bond-battle',
      outcome: 'victory' as const,
      enemiesDefeated: 4,
      mercenaries: [
        { id: a.id, survived: true },
        { id: b.id, survived: true },
        { id: c.id, survived: true },
      ],
      assists: [[a.id, b.id]] as [string, string][],
    };
    service.claimRewards(fought);
    const rewards = service.claimRewards({ ...fought, id: 'bond-battle-2' });
    expect(service.bondPoints(a.id, b.id)).toBe(24);
    const named = rewards.bonds!.find(
      (bond) => bond.names.includes(a.name) && bond.names.includes(b.name),
    );
    expect(named?.title).toBe('Comrades');
    TestBed.resetTestingModule();
    const again = TestBed.inject(RosterService);
    expect(again.bondPoints(a.id, b.id)).toBe(24);
    again.dismiss(b.id);
    expect(again.bondPoints(a.id, b.id)).toBe(0);
    expect(again.bondPoints(a.id, c.id)).toBe(16);
  });

  it('buys, equips, reforges and sells equipment, and keeps it through a reload', () => {
    const service = TestBed.inject(RosterService);
    const fighter = service.mercenaries().find((m) => m.classId === 'fighter')!;
    // Tier 2 opens at squad level 4.
    expect(service.buyEquipment('sword-2')).toBe(false);
    expect(service.buyEquipment('sword-1')).toBe(true);
    expect(service.buyEquipment('copper-ring')).toBe(true);
    expect(service.gold()).toBe(STARTING_GOLD - 120 - 150);
    const [sword, ring] = service.armory();
    // A longbow-only archer cannot hold a sword.
    const archer = service.mercenaries().find((m) => m.classId === 'archer')!;
    expect(service.equip(archer.id, sword.uid)).toBe(false);
    expect(service.equip(fighter.id, sword.uid)).toBe(true);
    expect(service.armory().map((p) => p.uid)).toEqual([ring.uid]);
    expect(service.reforge(sword.uid)).toBe(true);
    expect(service.mercenaries().find((m) => m.id === fighter.id)!.equipment?.weapon?.plus).toBe(1);
    expect(service.sellPiece(sword.uid)).toBe(false);
    expect(service.sellPiece(ring.uid)).toBe(true);
    TestBed.resetTestingModule();
    const again = TestBed.inject(RosterService);
    expect(again.mercenaries().find((m) => m.id === fighter.id)!.equipment?.weapon).toEqual({
      ...sword,
      plus: 1,
    });
    expect(again.unequip(fighter.id, 'weapon')).toBe(true);
    expect(again.armory()).toHaveLength(1);
  });

  it('builds facilities with gold, and their effects apply', () => {
    const service = TestBed.inject(RosterService);
    service.gold.set(5000);
    expect(service.rosterLimit()).toBe(12);
    expect(service.upgradeFacility('barracks')).toBe(true);
    expect(service.rosterLimit()).toBe(14);
    expect(service.gold()).toBe(4600);
    expect(service.upgradeFacility('smithy')).toBe(true);
    expect(service.reforgePrice({ uid: 'x', base: 'sword-1', plus: 0 })).toBe(54);
    service.gold.set(10);
    expect(service.upgradeFacility('training')).toBe(false);
    TestBed.resetTestingModule();
    expect(TestBed.inject(RosterService).facilities()).toEqual({ barracks: 1, smithy: 1 });
  });
});
