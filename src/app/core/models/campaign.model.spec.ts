import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from './campaign-story';
import {
  Chapter,
  allMissions,
  findMission,
  isUnlocked,
  missionContract,
  nextMission,
  tellLine,
} from './campaign.model';
import { parseContract } from './contract.model';
import { ALL_CLASSES } from './unit-class.model';

const mission = (id: string) => ({
  id,
  title: id,
  summary: '',
  band: 'Band',
  level: 2,
  route: ['fork', 'ford'],
  enemies: [{ classId: 'fighter', name: 'Brask' }],
  briefing: [],
  debrief: [],
  reward: { gold: 100 },
});
const STORY: Chapter[] = [
  { id: 'one', title: 'One', missions: [mission('a'), mission('b')] },
  { id: 'two', title: 'Two', missions: [mission('c')] },
];

describe('campaign', () => {
  it('opens missions in order across chapters', () => {
    expect(nextMission([], STORY)?.id).toBe('a');
    expect(isUnlocked('a', [], STORY)).toBe(true);
    expect(isUnlocked('b', [], STORY)).toBe(false);
    expect(isUnlocked('c', ['a'], STORY)).toBe(false);
    expect(isUnlocked('c', ['a', 'b'], STORY)).toBe(true);
    expect(nextMission(['a', 'b'], STORY)?.id).toBe('c');
    expect(nextMission(['a', 'b', 'c'], STORY)).toBeNull();
    expect(isUnlocked('missing', [], STORY)).toBe(false);
  });

  it('fields the same named band with the same sheets every time', () => {
    const story = CAMPAIGN[0].missions[1];
    const first = missionContract(story);
    const again = missionContract(story);
    expect(first).toEqual(again);
    expect(first.missionId).toBe(story.id);
    expect(first.enemies.map((e) => e.name)).toEqual(story.enemies.map((e) => e.name));
    expect(first.enemies.map((e) => e.classId)).toEqual(story.enemies.map((e) => e.classId));
    expect(first.enemies.every((e) => e.level === story.level)).toBe(true);
    expect(first.objects).toEqual(story.objects);
  });

  it('fields bosses above the mission level and armed bands in armoury gear, through a reload', () => {
    const finale = findMission('v2-keep')!;
    const band = missionContract(finale);
    const levels = Object.fromEntries(band.enemies.map((e) => [e.name, e.level]));
    expect(levels['Lady Iselde']).toBe(finale.level + 5);
    expect(levels['Ser Aldous']).toBe(finale.level + 3);
    for (const enemy of band.enemies) {
      expect(enemy.equipment?.armor?.base).toMatch(/-3$/);
    }
    // A battle saved mid-fight keeps the band's levels and gear.
    expect(parseContract(band)!.enemies).toEqual(band.enemies);
    // The Saltmere opener's wardens fight a level below the mission, unarmed.
    const docks = missionContract(findMission('s1-docks')!);
    expect(docks.enemies.every((e) => e.level === 4 && !e.equipment?.armor)).toBe(true);
  });

  it('fills in the squad leader', () => {
    expect(tellLine({ speaker: '{leader}', text: 'I am {leader}.' }, 'Dara')).toEqual({
      speaker: 'Dara',
      text: 'I am Dara.',
    });
  });

  it('tells a story whose every mission is a valid battle', () => {
    const missions = allMissions();
    expect(new Set(missions.map((m) => m.id)).size).toBe(missions.length);
    const classes = ALL_CLASSES.map((cls) => cls.id);
    for (const story of missions) {
      expect(story.enemies.length).toBeGreaterThanOrEqual(1);
      expect(story.enemies.length).toBeLessThanOrEqual(4);
      expect(new Set(story.enemies.map((e) => e.name)).size).toBe(story.enemies.length);
      for (const line of [...story.briefing, ...story.debrief]) {
        if (line.portrait && line.portrait !== 'leader') expect(classes).toContain(line.portrait);
      }
      // A mission's battle passes the same checks a saved contract does.
      expect(parseContract(missionContract(story))).not.toBeNull();
    }
  });
});
