import { ItemId } from './item.model';
import { REGIONS, Region, THORNWATCH } from './overworld-regions';
import { Mission, findMission } from './campaign.model';

export interface MapPatrol {
  readonly id: string;
  readonly name: string;
  readonly tier: 'easy' | 'normal' | 'hard';
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

// The boards themselves live in overworld-regions.ts; Thornwatch is the default here.
export const MAP_NODES = THORNWATCH.nodes;
export const MAP_EDGES = THORNWATCH.edges;
export const PATROLS = THORNWATCH.patrols;

export function regionById(id: string | undefined): Region {
  return REGIONS.find((region) => region.id === id) ?? THORNWATCH;
}

/** The region whose board holds a waypoint, or undefined. */
export function regionOfNode(id: string): Region | undefined {
  return REGIONS.find((region) => region.nodes.some((node) => node.id === id));
}

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
