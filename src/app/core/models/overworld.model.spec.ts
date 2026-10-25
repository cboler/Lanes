import { describe, expect, it } from 'vitest';
import { allMissions, chapterOf } from './campaign.model';
import { REGIONS } from './overworld-regions';
import {
  MAP_NODES,
  MAP_EDGES,
  PATROLS,
  advanceExpedition,
  neighbors,
  newExpedition,
  parseExpedition,
  patrolPosition,
  regionById,
  storyPatrol,
  travel,
} from './overworld.model';

describe('expedition movement', () => {
  it('gives every scripted squad a repeating legal circuit and detects its shared landing and edge swap', () => {
    for (const mission of allMissions()) {
      const patrol = storyPatrol(mission);
      const region = regionById(chapterOf(mission.id)?.region);
      expect(patrol.path.length).toBeGreaterThan(1);
      for (const [index, id] of patrol.path.entries()) {
        expect(region.nodes.some((n) => n.id === id)).toBe(true);
        expect(
          neighbors(id).some((n) => n.id === patrol.path[(index + 1) % patrol.path.length]),
        ).toBe(true);
        expect(patrolPosition(patrol, index + patrol.path.length)).toBe(id);
      }
      const start = {
        ...newExpedition(region),
        position: patrol.path[1],
        defeated: region.patrols.map((p) => p.id),
      };
      const landing = advanceExpedition(start, start.position, patrol);
      expect(landing.encounter).toBe(patrol.id);
      expect(parseExpedition(landing)?.encounter).toBe(patrol.id);
      expect(advanceExpedition(start, patrol.path[0], patrol).encounter).toBe(patrol.id);
    }
    expect(parseExpedition({ ...newExpedition(), encounter: 'story:missing' })).toBeNull();
    expect(parseExpedition({ ...newExpedition(), encounter: 42 })).toBeNull();
  });
  it('allows only an adjacent step or a wait, advancing every patrol exactly once', () => {
    const start = newExpedition();
    expect(advanceExpedition(start, 'keep')).toBe(start);
    const hop = advanceExpedition(start, 'trail');
    expect(hop).toMatchObject({ position: 'trail', turn: 1 });
    expect(PATROLS.map((p) => patrolPosition(p, hop.turn))).toEqual([
      'bridge',
      'crossing',
      'pass',
      'logging',
      'marsh',
    ]);
    expect(advanceExpedition(hop, 'trail')).toMatchObject({ position: 'trail', turn: 2 });
    // Merely reading the state does not move time or patrols.
    expect(start.turn).toBe(0);
    expect(PATROLS.map((p) => patrolPosition(p, 0))).toEqual([
      'ford',
      'meadow',
      'gate',
      'mill',
      'lowroad',
    ]);
  });

  it('intercepts a shared landing and a swap across one edge', () => {
    const landing = advanceExpedition({ ...newExpedition(), position: 'bridge', turn: 1 }, 'east');
    expect(landing.encounter).toBe('wolves');
    const crossing = advanceExpedition({ ...newExpedition(), position: 'bridge', turn: 0 }, 'ford');
    expect(crossing.encounter).toBe('wolves');
    expect(advanceExpedition(crossing, 'fork')).toBe(crossing);
  });

  it('removes defeated patrols from collision checks', () => {
    const state = { ...newExpedition(), position: 'bridge', defeated: ['wolves'] };
    expect(advanceExpedition(state, 'ford').encounter).toBeNull();
  });

  it('keeps every path connected and every patrol hop on a real edge', () => {
    const reachable = new Set(['camp']);
    const pending = ['camp'];
    while (pending.length) {
      for (const node of neighbors(pending.pop()!)) {
        if (!reachable.has(node.id)) {
          reachable.add(node.id);
          pending.push(node.id);
        }
      }
    }
    expect(reachable.size).toBe(MAP_NODES.length);
    expect(MAP_EDGES.length - MAP_NODES.length + 1).toBeGreaterThanOrEqual(8);
    for (const patrol of PATROLS)
      for (let t = 0; t < patrol.path.length; t++) {
        expect(
          neighbors(patrolPosition(patrol, t)).some((n) => n.id === patrolPosition(patrol, t + 1)),
        ).toBe(true);
        expect(patrolPosition(patrol, t + patrol.path.length)).toBe(patrolPosition(patrol, t));
      }
  });

  it('offers a guarded short road and a longer clear route to the same treasure', () => {
    const start = { ...newExpedition(), position: 'fork', turn: 2 };
    let shortcut = start;
    for (const id of ['grove', 'cache']) shortcut = advanceExpedition(shortcut, id);
    expect(shortcut).toMatchObject({ position: 'cache', turn: 4, encounter: 'rangers' });
    let detour = start;
    for (const id of ['grove', 'logging', 'overlook', 'cache'])
      detour = advanceExpedition(detour, id);
    expect(detour).toMatchObject({ position: 'cache', turn: 6, encounter: null });
    // Unlimited turns: a repeated patrol circuit still has the same timing far into a journey.
    expect(parseExpedition({ ...newExpedition(), turn: 1_000_001 })).not.toBeNull();
    for (const patrol of PATROLS)
      expect(patrolPosition(patrol, 84)).toBe(patrolPosition(patrol, 0));
  });

  it('refuses corrupt saves and sanitizes duplicate or unknown collected ids', () => {
    expect(parseExpedition(null)).toBeNull();
    for (const change of [
      { position: 'missing' },
      { turn: -1 },
      { turn: Infinity },
      { turn: 0.5 },
      { collected: [null] },
      { encounter: 'missing' },
    ]) {
      expect(parseExpedition({ ...newExpedition(), ...change })).toBeNull();
    }
    expect(
      parseExpedition({
        ...newExpedition(),
        collected: ['cache', 'cache', 'fake'],
        defeated: ['wolves', 'fake'],
      }),
    ).toMatchObject({ collected: ['cache'], defeated: ['wolves'] });
  });
});

describe('regions', () => {
  it('keep every board connected, with unique waypoints and patrols on real roads', () => {
    const seen = new Set<string>();
    for (const region of REGIONS) {
      for (const node of region.nodes) {
        expect(seen.has(node.id)).toBe(false);
        seen.add(node.id);
      }
      for (const [a, b] of region.edges) {
        expect(region.nodes.some((n) => n.id === a) && region.nodes.some((n) => n.id === b)).toBe(
          true,
        );
      }
      const reachable = new Set([region.start]);
      const pending = [region.start];
      while (pending.length) {
        for (const next of neighbors(pending.pop()!)) {
          if (reachable.has(next.id)) continue;
          reachable.add(next.id);
          pending.push(next.id);
        }
      }
      expect(reachable.size).toBe(region.nodes.length);
      expect(reachable.has(region.goal)).toBe(true);
      for (const patrol of region.patrols) {
        for (const [index, id] of patrol.path.entries()) {
          const next = patrol.path[(index + 1) % patrol.path.length];
          expect(neighbors(id).some((n) => n.id === next)).toBe(true);
        }
        // No patrol starts on the company's arrival.
        expect(patrol.path[0]).not.toBe(region.start);
      }
    }
  });

  it('travel keeps each region’s progress and resumes it on return', () => {
    const [thornwatch, saltmere] = REGIONS;
    const walked = { ...advanceExpedition(newExpedition(), 'trail'), collected: ['cache'] };
    const there = travel(walked, saltmere);
    expect(there).toMatchObject({ region: 'saltmere', position: 's-camp', turn: 0, collected: [] });
    const moved = advanceExpedition(there, 's-dunes');
    const back = travel(moved, thornwatch);
    expect(back).toMatchObject({ region: 'thornwatch', position: 'trail', turn: 1 });
    expect(back.collected).toEqual(['cache']);
    expect(travel(back, saltmere)).toMatchObject({ position: 's-dunes', turn: 1 });
    // The atlas survives a save, and an encounter pins the company in place.
    expect(parseExpedition(JSON.parse(JSON.stringify(back)))).toEqual(back);
    expect(travel({ ...back, encounter: 'wolves' }, saltmere).region).toBe('thornwatch');
  });
});
