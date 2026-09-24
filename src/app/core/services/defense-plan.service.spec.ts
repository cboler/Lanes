import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDefensePlan } from '../models/defense-plan.model';
import { DefensePlanService } from './defense-plan.service';

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

  it('saves locally and restores the exact validated plan in a new instance', () => {
    const service = TestBed.inject(DefensePlanService);
    const plan = createDefaultDefensePlan();
    plan.members[0].orders[0].abilityId = 'guard';
    expect(service.save(plan)).toBe(true);
    TestBed.resetTestingModule();
    expect(TestBed.inject(DefensePlanService).plan().members[0].orders[0].abilityId).toBe('guard');
  });

  it('falls back safely from corrupt storage and rejects invalid saves', () => {
    storage.setItem('lanes.defense-plan.v1', '{invalid');
    const service = TestBed.inject(DefensePlanService);
    expect(service.plan().members).toHaveLength(4);
    expect(service.warning()).toContain('could not be loaded');
    expect(service.save({ version: 1, members: [] })).toBe(false);
    expect(service.plan().members).toHaveLength(4);
  });

  it('keeps orders in memory when device storage throws', () => {
    const service = TestBed.inject(DefensePlanService);
    const spy = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    const plan = createDefaultDefensePlan();
    plan.members[0].orders[0].abilityId = 'guard';
    expect(service.save(plan)).toBe(true);
    expect(service.plan().members[0].orders[0].abilityId).toBe('guard');
    expect(service.warning()).toContain('storage is unavailable');
    spy.mockRestore();
  });
});
