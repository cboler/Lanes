import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDefensePlan } from '../models/defense-plan.model';
import { DefensePlanService } from './defense-plan.service';
import { RosterService } from './roster.service';

describe('DefensePlanService', () => {
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

  const roster = () => TestBed.inject(RosterService).mercenaries();

  it('defaults to roster mercenaries', () => {
    const service = TestBed.inject(DefensePlanService);
    const ids = roster().map((merc) => merc.id);
    expect(service.plan().members).toHaveLength(4);
    expect(service.plan().members.every((m) => ids.includes(m.mercenary.id))).toBe(true);
  });

  it('saves locally and restores the exact validated plan in a new instance', () => {
    const service = TestBed.inject(DefensePlanService);
    const plan = createDefaultDefensePlan(roster());
    plan.members[0].orders[0].abilityId = 'guard';
    expect(service.save(plan)).toBe(true);
    TestBed.resetTestingModule();
    const restored = TestBed.inject(DefensePlanService).plan();
    expect(restored.members[0].orders[0].abilityId).toBe('guard');
    expect(restored.members[0].mercenary.id).toBe(plan.members[0].mercenary.id);
  });

  it('upgrades a saved class-only plan using the roster', () => {
    TestBed.inject(RosterService);
    storage.setItem(
      'lanes.defense-plan.v1',
      JSON.stringify({
        version: 1,
        members: [
          {
            classId: 'witch',
            orders: Array.from({ length: 4 }, () => ({
              abilityId: 'meteor',
              targetPriority: 'closest',
            })),
          },
        ],
      }),
    );
    const plan = TestBed.inject(DefensePlanService).plan();
    expect(plan.version).toBe(2);
    expect(plan.members[0].mercenary.classId).toBe('witch');
    expect(plan.members[0].orders[0].abilityId).toBe('meteor');
  });

  it('falls back safely from corrupt storage and rejects invalid saves', () => {
    storage.setItem('lanes.defense-plan.v1', '{invalid');
    const service = TestBed.inject(DefensePlanService);
    expect(service.plan().members).toHaveLength(4);
    expect(service.warning()).toContain('could not be loaded');
    expect(service.save({ version: 2, members: [] })).toBe(false);
    expect(service.plan().members).toHaveLength(4);
  });

  it('keeps orders in memory when device storage throws', () => {
    const service = TestBed.inject(DefensePlanService);
    const spy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    const plan = createDefaultDefensePlan(roster());
    plan.members[0].orders[0].abilityId = 'guard';
    expect(service.save(plan)).toBe(true);
    expect(service.plan().members[0].orders[0].abilityId).toBe('guard');
    expect(service.warning()).toContain('storage is unavailable');
    spy.mockRestore();
  });
});
