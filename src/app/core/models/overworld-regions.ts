import type { MapNode, MapPatrol } from './overworld.model';

/*
 * The overworld's regions. Each is a board: painted art, waypoints in the art's 0-100
 * space, the roads between them, and the enemy patrols that walk fixed circuits. A region
 * opens once the chapter named in `unlockedBy` is won; the story's missions for a region
 * walk their circuits on its board (campaign-story.ts gives each chapter its region).
 *
 * Saltmere and Vellmark reuse the Thornwatch painting, regraded and turned, until they
 * have art of their own; public/assets/overworld/README.md has the prompts to paint them.
 */

export interface Region {
  readonly id: string;
  /** The board's title, e.g. "The Thornwatch March". */
  readonly name: string;
  /** The line above the title. */
  readonly area: string;
  /** Short name for battle titles. */
  readonly short: string;
  readonly art: string;
  /** CSS filter and transform for the art, so one painting can stand in for another. */
  readonly artFilter?: string;
  readonly artTransform?: string;
  readonly nodes: readonly MapNode[];
  readonly edges: readonly (readonly [string, string])[];
  readonly patrols: readonly MapPatrol[];
  /** Where the company arrives, and the waypoint that completes the region. */
  readonly start: string;
  readonly goal: string;
  readonly goalReward: number;
  /** The chapter whose missions must all be won before the company can travel here. */
  readonly unlockedBy?: string;
}

export const THORNWATCH: Region = {
  id: 'thornwatch',
  name: 'The Thornwatch March',
  area: "THE BORDERLANDS / A MERCENARY'S TALE",
  short: 'Thornwatch',
  art: 'assets/overworld/thornwatch.webp',
  start: 'camp',
  goal: 'keep',
  goalReward: 250,
  nodes: [
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
  ],
  edges: [
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
  ],
  patrols: [
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
  ],
};

/** Chapter 1: a smugglers' coast where House Corvane's crates come ashore. */
export const SALTMERE: Region = {
  id: 'saltmere',
  name: 'The Saltmere Coast',
  area: 'THE GREY SHORE / CHAPTER ONE',
  short: 'Saltmere',
  art: 'assets/overworld/thornwatch.webp',
  artFilter: 'saturate(0.45) hue-rotate(28deg) brightness(1.04) contrast(1.06)',
  artTransform: 'scaleX(-1)',
  start: 's-camp',
  goal: 's-fort',
  goalReward: 400,
  unlockedBy: 'prologue',
  nodes: [
    { id: 's-camp', name: 'Driftwood Camp', x: 90, y: 58, kind: 'camp' },
    { id: 's-dunes', name: 'Salt Dunes', x: 80, y: 52 },
    { id: 's-cross', name: 'Fisher’s Cross', x: 70, y: 50 },
    { id: 's-net', name: 'Net-menders’ Row', x: 58, y: 44 },
    { id: 's-market', name: 'Old Fish Market', x: 48, y: 48 },
    { id: 's-docks', name: 'Smugglers’ Docks', x: 38, y: 56 },
    { id: 's-warehouse', name: 'Corvane Warehouse', x: 30, y: 46, kind: 'chest', item: 'charm' },
    { id: 's-watch', name: 'Watch Cairn', x: 18, y: 52 },
    { id: 's-fort', name: 'Saltmere Fort', x: 12, y: 38, kind: 'goal' },
    { id: 's-cliff', name: 'Gull Cliffs', x: 78, y: 30 },
    { id: 's-light', name: 'Lighthouse Point', x: 66, y: 22 },
    { id: 's-chapel', name: 'Drowned Chapel', x: 54, y: 27, kind: 'chest', item: 'tactics' },
    { id: 's-ridge', name: 'Windward Ridge', x: 42, y: 30 },
    { id: 's-gate', name: 'Sea Gate', x: 26, y: 28 },
    { id: 's-cove', name: 'Wreckers’ Cove', x: 84, y: 76, kind: 'gold', gold: 140 },
    { id: 's-marsh', name: 'Brine Marsh', x: 70, y: 78 },
    { id: 's-saltpans', name: 'Salt Pans', x: 63, y: 63 },
    { id: 's-pier', name: 'Broken Pier', x: 52, y: 74, kind: 'gold', gold: 110 },
    { id: 's-causeway', name: 'Tidal Causeway', x: 40, y: 70 },
    { id: 's-tidepool', name: 'Tide Pools', x: 26, y: 66 },
  ],
  edges: [
    ['s-camp', 's-dunes'],
    ['s-dunes', 's-cross'],
    ['s-cross', 's-net'],
    ['s-net', 's-market'],
    ['s-market', 's-docks'],
    ['s-docks', 's-warehouse'],
    ['s-warehouse', 's-watch'],
    ['s-watch', 's-fort'],
    ['s-dunes', 's-cliff'],
    ['s-cliff', 's-light'],
    ['s-light', 's-chapel'],
    ['s-chapel', 's-ridge'],
    ['s-ridge', 's-gate'],
    ['s-gate', 's-fort'],
    ['s-ridge', 's-market'],
    ['s-net', 's-chapel'],
    ['s-warehouse', 's-gate'],
    ['s-camp', 's-cove'],
    ['s-cove', 's-marsh'],
    ['s-marsh', 's-saltpans'],
    ['s-saltpans', 's-cross'],
    ['s-marsh', 's-pier'],
    ['s-pier', 's-causeway'],
    ['s-causeway', 's-docks'],
    ['s-causeway', 's-tidepool'],
    ['s-tidepool', 's-watch'],
  ],
  patrols: [
    {
      id: 'salt-wreckers',
      name: 'Wrecker Gang',
      tier: 'normal',
      path: ['s-cove', 's-marsh', 's-pier', 's-marsh'],
    },
    {
      id: 'salt-wardens',
      name: 'Corvane Wardens',
      tier: 'normal',
      path: ['s-market', 's-docks', 's-warehouse', 's-docks'],
    },
    {
      id: 'salt-lamplighters',
      name: 'Lamplighter Crew',
      tier: 'normal',
      path: ['s-light', 's-chapel', 's-ridge', 's-chapel'],
    },
    {
      id: 'salt-tidewatch',
      name: 'Tidewatch Patrol',
      tier: 'hard',
      path: ['s-watch', 's-tidepool', 's-causeway', 's-docks', 's-warehouse'],
    },
  ],
};

/** Chapter 2: a hill town under siege, and the house that besieges it. */
export const VELLMARK: Region = {
  id: 'vellmark',
  name: 'The Vellmark Heights',
  area: 'THE BURNING HILLS / CHAPTER TWO',
  short: 'Vellmark',
  art: 'assets/overworld/thornwatch.webp',
  artFilter: 'sepia(0.45) saturate(1.25) hue-rotate(-22deg) brightness(0.78) contrast(1.12)',
  artTransform: 'scale(-1, -1)',
  start: 'v-camp',
  goal: 'v-keep',
  goalReward: 600,
  unlockedBy: 'saltmere',
  nodes: [
    { id: 'v-camp', name: 'Relief Camp', x: 10, y: 80, kind: 'camp' },
    { id: 'v-mill', name: 'Burnt Mill', x: 20, y: 70 },
    { id: 'v-orchard', name: 'Ash Orchard', x: 30, y: 82 },
    { id: 'v-bridge', name: 'Mossbridge', x: 34, y: 64 },
    { id: 'v-trench', name: 'Siege Trenches', x: 46, y: 58 },
    { id: 'v-batteries', name: 'Corvane Batteries', x: 53, y: 46 },
    { id: 'v-wall', name: 'Vellmark Wall', x: 64, y: 40 },
    { id: 'v-gatehouse', name: 'The Gatehouse', x: 74, y: 30 },
    { id: 'v-keep', name: 'Vellmark Keep', x: 86, y: 18, kind: 'goal' },
    { id: 'v-quarry', name: 'Old Quarry', x: 20, y: 50, kind: 'gold', gold: 160 },
    { id: 'v-shrine', name: 'Saint Ardo’s Shrine', x: 31, y: 38, kind: 'chest', item: 'tactics' },
    { id: 'v-pines', name: 'Black Pines', x: 43, y: 28 },
    { id: 'v-sally', name: 'Sally Port', x: 57, y: 21 },
    { id: 'v-lookout', name: 'Hawk Lookout', x: 70, y: 12 },
    { id: 'v-ford', name: 'Cold Ford', x: 48, y: 78 },
    { id: 'v-corvane', name: 'Corvane Camp', x: 62, y: 70, kind: 'chest', item: 'charm' },
    { id: 'v-supply', name: 'Supply Wagons', x: 75, y: 62, kind: 'gold', gold: 200 },
    { id: 'v-ramp', name: 'Siege Ramp', x: 80, y: 48 },
    { id: 'v-tower', name: 'Tower of Bells', x: 90, y: 34 },
  ],
  edges: [
    ['v-camp', 'v-mill'],
    ['v-mill', 'v-bridge'],
    ['v-bridge', 'v-trench'],
    ['v-trench', 'v-batteries'],
    ['v-batteries', 'v-wall'],
    ['v-wall', 'v-gatehouse'],
    ['v-gatehouse', 'v-keep'],
    ['v-camp', 'v-orchard'],
    ['v-orchard', 'v-ford'],
    ['v-ford', 'v-corvane'],
    ['v-corvane', 'v-supply'],
    ['v-supply', 'v-ramp'],
    ['v-ramp', 'v-wall'],
    ['v-ramp', 'v-tower'],
    ['v-tower', 'v-keep'],
    ['v-orchard', 'v-bridge'],
    ['v-mill', 'v-quarry'],
    ['v-quarry', 'v-shrine'],
    ['v-shrine', 'v-pines'],
    ['v-pines', 'v-sally'],
    ['v-sally', 'v-lookout'],
    ['v-lookout', 'v-keep'],
    ['v-sally', 'v-wall'],
    ['v-trench', 'v-corvane'],
  ],
  patrols: [
    {
      id: 'vell-sappers',
      name: 'Corvane Sappers',
      tier: 'normal',
      path: ['v-trench', 'v-batteries', 'v-trench', 'v-corvane'],
    },
    {
      id: 'vell-outriders',
      name: 'Corvane Outriders',
      tier: 'normal',
      path: ['v-ford', 'v-corvane', 'v-supply', 'v-corvane'],
    },
    {
      id: 'vell-pikes',
      name: 'Iron Pikes',
      tier: 'hard',
      path: ['v-ramp', 'v-tower', 'v-ramp', 'v-supply'],
    },
    {
      id: 'vell-hunters',
      name: 'Black Pine Hunters',
      tier: 'normal',
      path: ['v-pines', 'v-sally', 'v-lookout', 'v-sally'],
    },
    {
      id: 'vell-guard',
      name: 'Gatehouse Guard',
      tier: 'hard',
      path: ['v-gatehouse', 'v-wall', 'v-sally', 'v-wall'],
    },
  ],
};

export const REGIONS: readonly Region[] = [THORNWATCH, SALTMERE, VELLMARK];
