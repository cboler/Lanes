import { ItemId } from './item.model';
import { Mission, findMission } from './campaign.model';

export interface MapPatrol {
  readonly id: string;
  readonly name: string;
  readonly tier: 'easy' | 'normal';
  readonly path: readonly string[];
}

export function storyPatrol(mission: Mission): MapPatrol {
  return {
    id: `story:${mission.id}`,
    name: mission.band,
    tier: mission.enemies.length < 4 ? 'easy' : 'normal',
    path: mission.route,
  };
}

export interface MapNode {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly kind?: 'camp' | 'goal' | 'gold' | 'chest';
  readonly gold?: number;
  readonly item?: ItemId;
}

/** Coordinates share the painted board's space; edges alone decide legal movement. */
export const MAP_NODES: readonly MapNode[] = [
  { id: 'camp', name: 'Wayfarer Camp', x: 10, y: 55, kind: 'camp' },
  { id: 'trail', name: 'Old Cart Track', x: 18, y: 49 },
  { id: 'fork', name: 'Three Roads', x: 27, y: 47 },
  { id: 'ford', name: 'Fern Hollow', x: 37, y: 45 },
  { id: 'bridge', name: 'Stonebridge', x: 47, y: 37 },
  { id: 'east', name: 'Eastern Bank', x: 57, y: 32 },
  { id: 'pass', name: 'Watchman’s Rise', x: 68, y: 32 },
  { id: 'gate', name: 'Broken Gate', x: 78, y: 28 },
  { id: 'keep', name: 'The Old Watchtower', x: 88, y: 23, kind: 'goal' },
  { id: 'grove', name: 'Whispering Grove', x: 27, y: 30 },
  { id: 'cache', name: 'Abandoned Pay Chest', x: 37, y: 22, kind: 'gold', gold: 80 },
  { id: 'ridge', name: 'Hunter’s Ridge', x: 47, y: 25 },
  { id: 'lowroad', name: 'The Low Road', x: 30, y: 64 },
  { id: 'shrine', name: 'Forgotten Shrine', x: 42, y: 73, kind: 'chest', item: 'tactics' },
  { id: 'meadow', name: 'Amber Meadow', x: 54, y: 69 },
  { id: 'crossing', name: 'South Crossing', x: 64, y: 57 },
  { id: 'steps', name: 'Pilgrim’s Steps', x: 68, y: 44 },
  { id: 'purse', name: 'Smuggler’s Stash', x: 78, y: 64, kind: 'gold', gold: 120 },
  { id: 'ruins', name: 'Wayside Ruins', x: 86, y: 47, kind: 'chest', item: 'charm' },
  { id: 'mill', name: 'Old Mill', x: 11, y: 34 },
  { id: 'logging', name: 'Birchwood Track', x: 18, y: 24 },
  { id: 'overlook', name: 'Poacher’s Overlook', x: 28, y: 16 },
  { id: 'northpass', name: 'High Ridge', x: 52, y: 16 },
  { id: 'pinewatch', name: 'Pinewatch', x: 64, y: 16 },
  { id: 'lookout', name: 'Signal Cairn', x: 76, y: 15 },
  { id: 'orchard', name: 'Abandoned Orchard', x: 18, y: 70 },
  { id: 'marsh', name: 'Reed Marsh', x: 27, y: 83 },
  { id: 'barrow', name: 'King’s Barrow', x: 40, y: 87, kind: 'gold', gold: 60 },
];

export const MAP_EDGES: readonly (readonly [string, string])[] = [
  ['camp', 'trail'],
  ['trail', 'fork'],
  ['fork', 'ford'],
  ['ford', 'bridge'],
  ['bridge', 'east'],
  ['east', 'pass'],
  ['pass', 'gate'],
  ['gate', 'keep'],
  ['fork', 'grove'],
  ['grove', 'cache'],
  ['cache', 'ridge'],
  ['ridge', 'east'],
  ['fork', 'lowroad'],
  ['lowroad', 'shrine'],
  ['shrine', 'meadow'],
  ['meadow', 'crossing'],
  ['crossing', 'steps'],
  ['steps', 'pass'],
  ['crossing', 'purse'],
  ['purse', 'ruins'],
  ['ruins', 'gate'],
  ['camp', 'mill'],
  ['mill', 'logging'],
  ['logging', 'overlook'],
  ['overlook', 'cache'],
  ['logging', 'grove'],
  ['trail', 'mill'],
  ['ridge', 'northpass'],
  ['northpass', 'pinewatch'],
  ['pinewatch', 'lookout'],
  ['lookout', 'gate'],
  ['camp', 'orchard'],
  ['orchard', 'marsh'],
  ['marsh', 'lowroad'],
  ['marsh', 'barrow'],
  ['barrow', 'shrine'],
];

export const PATROLS = [
  {
    id: 'wolves',
    name: 'Grey Wolf Scouts',
    tier: 'easy',
    path: ['ford', 'bridge', 'east', 'bridge'],
  },
  {
    id: 'thorns',
    name: 'Thornwood Patrol',
    tier: 'normal',
    path: ['meadow', 'crossing', 'purse', 'crossing'],
  },
  {
    id: 'ravens',
    name: 'Red Raven Guard',
    tier: 'normal',
    path: ['gate', 'pass', 'steps', 'pass'],
  },
  {
    id: 'rangers',
    name: 'Birchwood Rangers',
    tier: 'normal',
    path: ['mill', 'logging', 'overlook', 'cache', 'grove', 'fork', 'trail'],
  },
  {
    id: 'wardens',
    name: 'Barrow Wardens',
    tier: 'normal',
    path: ['lowroad', 'marsh', 'barrow', 'shrine', 'barrow', 'marsh'],
  },
] as const;

export interface Expedition {
  readonly version: 1;
  readonly position: string;
  readonly turn: number;
  readonly collected: readonly string[];
  readonly defeated: readonly string[];
  readonly encounter: string | null;
  readonly complete: boolean;
}

export function newExpedition(): Expedition {
  return {
    version: 1,
    position: 'camp',
    turn: 0,
    collected: [],
    defeated: [],
    encounter: null,
    complete: false,
  };
}

export function nodeAt(id: string): MapNode {
  return MAP_NODES.find((node) => node.id === id)!;
}

export function neighbors(id: string): MapNode[] {
  return MAP_EDGES.filter((edge) => edge.includes(id)).map(([a, b]) => nodeAt(a === id ? b : a));
}

export function patrolPosition(patrol: MapPatrol, turn: number): string {
  return patrol.path[turn % patrol.path.length];
}

/** One legal hop or wait advances EVERY patrol once, including edge-crossing encounters. */
export function advanceExpedition(
  state: Expedition,
  destination: string,
  story?: MapPatrol,
): Expedition {
  if (
    state.encounter ||
    (destination !== state.position && !neighbors(state.position).some((n) => n.id === destination))
  )
    return state;
  const turn = state.turn + 1;
  const encounter =
    (story ? [story, ...PATROLS] : PATROLS).find(
      (patrol) =>
        !state.defeated.includes(patrol.id) &&
        (patrolPosition(patrol, turn) === destination ||
          (patrolPosition(patrol, state.turn) === destination &&
            patrolPosition(patrol, turn) === state.position)),
    )?.id ?? null;
  return { ...state, position: destination, turn, encounter };
}

/** Validate persisted positions and counters before they can index the board. */
export function parseExpedition(raw: unknown): Expedition | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Expedition;
  const strings = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((id) => typeof id === 'string');
  if (
    s.version !== 1 ||
    !MAP_NODES.some((n) => n.id === s.position) ||
    !Number.isSafeInteger(s.turn) ||
    s.turn < 0 ||
    !strings(s.collected) ||
    !strings(s.defeated) ||
    typeof s.complete !== 'boolean' ||
    (s.encounter !== null &&
      !PATROLS.some((p) => p.id === s.encounter) &&
      !(
        typeof s.encounter === 'string' &&
        s.encounter.startsWith('story:') &&
        findMission(s.encounter.slice(6))
      ))
  )
    return null;
  return {
    version: 1,
    position: s.position,
    turn: s.turn,
    collected: [
      ...new Set(
        s.collected.filter((id) => MAP_NODES.some((n) => n.id === id && (n.gold || n.item))),
      ),
    ],
    defeated: [...new Set(s.defeated.filter((id) => PATROLS.some((p) => p.id === id)))],
    encounter: s.encounter,
    complete: s.complete,
  };
}
