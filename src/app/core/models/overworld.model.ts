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

/** Where a company stands in one region, kept while it travels elsewhere. */
export interface RegionProgress {
  readonly position: string;
  readonly turn: number;
  readonly collected: readonly string[];
  readonly defeated: readonly string[];
  readonly complete: boolean;
}

export interface Expedition extends RegionProgress {
  readonly version: 1;
  /** The region the company is in; saves from before regions are in Thornwatch. */
  readonly region?: string;
  readonly encounter: string | null;
  /** Progress in the other regions visited, by region id. */
  readonly atlas?: Readonly<Record<string, RegionProgress>>;
}

export function newExpedition(region: Region = THORNWATCH): Expedition {
  return {
    version: 1,
    region: region.id,
    position: region.start,
    turn: 0,
    collected: [],
    defeated: [],
    encounter: null,
    complete: false,
  };
}

/** Waypoint ids are unique across regions, so a waypoint is found on whichever board has it. */
export function nodeAt(id: string): MapNode {
  return regionOfNode(id)?.nodes.find((node) => node.id === id) ?? THORNWATCH.nodes[0];
}

export function neighbors(id: string): MapNode[] {
  const region = regionOfNode(id) ?? THORNWATCH;
  return region.edges.filter((edge) => edge.includes(id)).map(([a, b]) => nodeAt(a === id ? b : a));
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
  const patrols = regionById(state.region).patrols;
  const encounter =
    (story ? [story, ...patrols] : patrols).find(
      (patrol) =>
        !state.defeated.includes(patrol.id) &&
        (patrolPosition(patrol, turn) === destination ||
          (patrolPosition(patrol, state.turn) === destination &&
            patrolPosition(patrol, turn) === state.position)),
    )?.id ?? null;
  return { ...state, position: destination, turn, encounter };
}

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

/** One region's saved progress, checked against that region's board, or null. */
function parseProgress(raw: unknown, region: Region): RegionProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as RegionProgress;
  if (
    !region.nodes.some((n) => n.id === s.position) ||
    !Number.isSafeInteger(s.turn) ||
    s.turn < 0 ||
    !strings(s.collected) ||
    !strings(s.defeated) ||
    typeof s.complete !== 'boolean'
  )
    return null;
  return {
    position: s.position,
    turn: s.turn,
    collected: [
      ...new Set(
        s.collected.filter((id) => region.nodes.some((n) => n.id === id && (n.gold || n.item))),
      ),
    ],
    defeated: [...new Set(s.defeated.filter((id) => region.patrols.some((p) => p.id === id)))],
    complete: s.complete,
  };
}

/** Validate persisted positions and counters before they can index the board. */
export function parseExpedition(raw: unknown): Expedition | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Expedition;
  const region = REGIONS.find((r) => r.id === (s.region ?? THORNWATCH.id));
  const progress = region && parseProgress(s, region);
  if (
    s.version !== 1 ||
    !region ||
    !progress ||
    (s.encounter !== null &&
      !region.patrols.some((p) => p.id === s.encounter) &&
      !(
        typeof s.encounter === 'string' &&
        s.encounter.startsWith('story:') &&
        findMission(s.encounter.slice(6))
      ))
  )
    return null;
  const atlas: Record<string, RegionProgress> = {};
  for (const other of REGIONS) {
    const kept = other.id !== region.id && parseProgress(s.atlas?.[other.id], other);
    if (kept) atlas[other.id] = kept;
  }
  return {
    version: 1,
    region: region.id,
    ...progress,
    encounter: s.encounter,
    ...(Object.keys(atlas).length ? { atlas } : {}),
  };
}

/** Leaves the current region (its progress goes to the atlas) for `region`, where the
 * company resumes where it last stood, or arrives at its start. */
export function travel(state: Expedition, region: Region): Expedition {
  if (state.encounter || region.id === (state.region ?? THORNWATCH.id)) return state;
  const { position, turn, collected, defeated, complete } = state;
  const atlas = {
    ...state.atlas,
    [state.region ?? THORNWATCH.id]: { position, turn, collected, defeated, complete },
  };
  const resumed = atlas[region.id] ?? newExpedition(region);
  delete atlas[region.id];
  return {
    version: 1,
    region: region.id,
    position: resumed.position,
    turn: resumed.turn,
    collected: resumed.collected,
    defeated: resumed.defeated,
    complete: resumed.complete,
    encounter: null,
    atlas,
  };
}
