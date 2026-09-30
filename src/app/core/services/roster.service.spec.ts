import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterService } from './roster.service';

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
});
