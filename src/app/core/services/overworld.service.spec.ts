import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PATROLS, newExpedition } from '../models/overworld.model';
import { RosterService } from './roster.service';
import { OverworldService } from './overworld.service';
import { allMissions } from '../models/campaign.model';
import { CampaignService } from './campaign.service';
import { REGIONS } from '../models/overworld-regions';

describe('OverworldService', () => {
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
    values.set(
      'lanes.campaign.v1',
      JSON.stringify({ version: 1, cleared: allMissions().map((m) => m.id) }),
    );
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    TestBed.resetTestingModule();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    values.clear();
  });

  it('persists a scripted encounter and continues the story from the same position after victory', () => {
    values.delete('lanes.campaign.v1');
    let world = TestBed.inject(OverworldService);
    world.step('trail');
    world.step('fork');
    expect(world.state().encounter).toBe('story:north-road');
    expect(world.contract()!.enemies.map((e) => e.name)).toEqual(['Brask', 'Ivra']);
    const sheet = world.contract();
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.contract()).toEqual(sheet);
    expect(world.step('ford')).toBe(false);
    world.resolve(sheet!.id, true);
    TestBed.inject(CampaignService).complete('north-road', 'story-win');
    expect(world.state()).toMatchObject({
      encounter: null,
      position: 'fork',
      turn: 2,
      defeated: [],
    });
    expect(world.story()?.id).toBe('story:the-ford');
    expect(world.contract('story:the-ford')!.enemies.map((e) => e.name)).toEqual([
      'Torv',
      'Ulla',
      'Odo',
    ]);
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.story()?.id).toBe('story:the-ford');
    expect(world.state().position).toBe('fork');
  });

  it('regroups after a failed story contract without removing its scripted squad', () => {
    values.delete('lanes.campaign.v1');
    const world = TestBed.inject(OverworldService);
    world.step('trail');
    world.step('fork');
    world.resolve('mission_north-road', false);
    expect(world.state()).toMatchObject({ encounter: null, position: 'camp', turn: 2 });
    expect(world.story()?.id).toBe('story:north-road');
    expect(world.contract('story:north-road')!.enemies.map((e) => e.name)).toEqual([
      'Brask',
      'Ivra',
    ]);
  });

  it('pays gold and scroll detours once, including after reload', () => {
    let world = TestBed.inject(OverworldService);
    const roster = TestBed.inject(RosterService);
    world.state.update((s) => ({ ...s, defeated: PATROLS.map((p) => p.id) }));
    const gold = roster.gold();
    for (const id of ['trail', 'fork', 'grove', 'cache']) expect(world.step(id)).toBe(true);
    expect(roster.gold()).toBe(gold + 80);
    world.step('grove');
    world.step('cache');
    expect(roster.gold()).toBe(gold + 80);
    for (const id of ['grove', 'fork', 'lowroad', 'shrine']) world.step(id);
    expect(roster.count('tactics')).toBe(1);
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.state().position).toBe('shrine');
    expect(world.state().turn).toBe(10);
    world.step('lowroad');
    world.step('shrine');
    expect(TestBed.inject(RosterService).count('tactics')).toBe(1);
  });

  it('randomizes free-roaming squads once and preserves their full sheets on reload', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1);
    let world = TestBed.inject(OverworldService);
    const before = PATROLS.map((p) => world.contract(p.id)!);
    expect(before.every((squad) => squad.enemies.length >= 3 && squad.enemies.length <= 4)).toBe(
      true,
    );
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(PATROLS.map((p) => world.contract(p.id))).toEqual(before);
    // A new game rerolls composition; the map circuits themselves stay fixed.
    values.clear();
    clock.mockReturnValue(17);
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(PATROLS.map((p) => world.contract(p.id)!.enemies.map((m) => m.classId))).not.toEqual(
      before.map((s) => s.enemies.map((m) => m.classId)),
    );
  });

  it('extends a legacy journey with squads and replaces only an invalid saved squad', () => {
    values.set(
      'lanes.overworld.v1',
      JSON.stringify({ ...newExpedition(), position: 'grove', turn: 3, collected: ['cache'] }),
    );
    let world = TestBed.inject(OverworldService);
    expect(world.state()).toMatchObject({ position: 'grove', turn: 3, collected: ['cache'] });
    const other = world.contract('thorns');
    const saved = JSON.parse(values.get('lanes.overworld.v1')!);
    saved.squads.wolves.enemies = [];
    values.set('lanes.overworld.v1', JSON.stringify(saved));
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.contract('thorns')).toEqual(other);
    expect(world.contract('wolves')!.enemies).toHaveLength(3);
    expect(world.state().position).toBe('grove');
  });

  it('keeps encounters through reload, defeats clear one piece, and losses regroup at camp', () => {
    let world = TestBed.inject(OverworldService);
    for (const id of ['trail', 'fork', 'ford']) world.step(id);
    expect(world.state().encounter).toBeNull();
    world.step('bridge');
    expect(world.state().encounter).toBe('wolves');
    const contract = world.contract()!;
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.contract()).toEqual(contract);
    expect(world.step('east')).toBe(false);
    world.resolve('unrelated', true);
    expect(world.state().encounter).toBe('wolves');
    world.resolve(contract.id, true);
    expect(world.state()).toMatchObject({
      position: 'bridge',
      encounter: null,
      defeated: ['wolves'],
    });
    world.state.set({ ...world.state(), encounter: 'ravens' });
    world.resolve('overworld:ravens', false);
    expect(world.state()).toMatchObject({
      position: 'camp',
      encounter: null,
      defeated: ['wolves'],
    });
    world.resolve('overworld:ravens', true);
    expect(world.state()).toMatchObject({ position: 'camp', defeated: ['wolves', 'ravens'] });
  });

  it('pays the objective once, defers loot during an encounter, and saves cleared patrols', () => {
    const world = TestBed.inject(OverworldService);
    const roster = TestBed.inject(RosterService);
    const gold = roster.gold();
    world.state.set({
      ...newExpedition(),
      position: 'gate',
      defeated: ['wolves', 'thorns', 'ravens'],
    });
    world.step('keep');
    world.step('gate');
    world.step('keep');
    expect(roster.gold()).toBe(gold + 250);
    expect(world.state().complete).toBe(true);
    world.state.set({
      ...world.state(),
      position: 'shrine',
      encounter: 'thorns',
      defeated: ['wolves', 'ravens'],
    });
    expect(roster.count('tactics')).toBe(0);
    world.resolve('overworld:thorns', true);
    expect(roster.count('tactics')).toBe(1);
  });

  it('falls back from malformed storage and keeps a playable journey when saving fails', () => {
    values.set('lanes.overworld.v1', 'null');
    const world = TestBed.inject(OverworldService);
    expect(world.state()).toEqual(newExpedition());
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(world.step('trail')).toBe(true);
    expect(world.warning()).toContain('Saving is unavailable');
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  });

  it('opens Saltmere once the prologue is won, travels there, and finds the next contract', () => {
    const prologue = ['north-road', 'the-ford', 'thorn-keep', 'vargr'];
    values.set('lanes.campaign.v1', JSON.stringify({ version: 1, cleared: prologue.slice(0, 3) }));
    let world = TestBed.inject(OverworldService);
    expect(world.regions().map((r) => r.id)).toEqual(['thornwatch']);
    expect(world.travelTo('saltmere')).toBe(false);

    values.set('lanes.campaign.v1', JSON.stringify({ version: 1, cleared: prologue }));
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.regions().map((r) => r.id)).toEqual(['thornwatch', 'saltmere']);
    // The next contract waits in Saltmere, so no story squad walks Thornwatch.
    expect(world.storyRegion()?.id).toBe('saltmere');
    expect(world.story()).toBeUndefined();
    world.step('trail');
    expect(world.travelTo('saltmere')).toBe(true);
    expect(world.state()).toMatchObject({ region: 'saltmere', position: 's-camp', turn: 0 });
    expect(world.story()?.id).toBe('story:s1-docks');
    expect(world.contract('salt-wardens')?.title).toContain('Saltmere');

    // Regions and squads survive a reload.
    TestBed.resetTestingModule();
    world = TestBed.inject(OverworldService);
    expect(world.region().id).toBe('saltmere');
    expect(world.travelTo('thornwatch')).toBe(true);
    expect(world.state().position).toBe('trail');
  });

  it('mends wounds a little each step and rests them away at camp, passing a turn', () => {
    const roster = TestBed.inject(RosterService);
    const world = TestBed.inject(OverworldService);
    roster.mercenaries.update((list) => list.map((m) => ({ ...m, wear: 0.5 })));
    world.step('trail');
    expect(roster.mercenaries()[0].wear).toBeCloseTo(0.45);
    // Rest only at camp.
    expect(world.atCamp()).toBe(false);
    expect(world.rest()).toBe(false);
    world.step('camp');
    expect(world.atCamp()).toBe(true);
    const turn = world.state().turn;
    expect(world.rest()).toBe(true);
    expect(roster.mercenaries().every((m) => !m.wear)).toBe(true);
    expect(world.state().turn).toBe(turn + 1);
  });

  it('finds equipment on the road once, into the armoury', () => {
    const roster = TestBed.inject(RosterService);
    const world = TestBed.inject(OverworldService);
    world.step('trail');
    expect(world.travelTo('saltmere')).toBe(true);
    const saltmere = REGIONS.find((r) => r.id === 'saltmere')!;
    world.state.update((s) => ({ ...s, defeated: saltmere.patrols.map((p) => p.id) }));
    world.step('s-dunes');
    world.step('s-cliff');
    expect(roster.armory().map((p) => p.base)).toEqual(['glaive-2']);
    expect(world.message()).toContain('Steel Glaive');
    world.step('s-dunes');
    world.step('s-cliff');
    expect(roster.armory()).toHaveLength(1);
  });
});
