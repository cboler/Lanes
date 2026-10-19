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
  });
});
