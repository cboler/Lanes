import { Contract } from './contract.model';
import { veteran } from './contract.model';
import { FieldObjectSpec } from './field-object.model';
import { hashSeed, seededRandom } from './mercenary.model';
import { CAMPAIGN } from './campaign-story';
import { ItemId } from './item.model';

/*
 * The single-player campaign: chapters of story missions, played in order. A mission is
 * data (who fights, what the field holds, what is said before and after), and is fought
 * as a contract, so every battle rule and reward applies. The story itself lives in
 * campaign-story.ts.
 */

/** One line of a story scene. `{leader}` in speaker or text becomes the squad leader's name. */
export interface StoryLine {
  readonly speaker: string;
  readonly text: string;
  /** A class id whose portrait shows beside the line, or 'leader' for the squad leader's. */
  readonly portrait?: string;
}

export interface MissionEnemy {
  readonly classId: string;
  readonly name: string;
}

export interface Mission {
  readonly id: string;
  readonly title: string;
  /** One line for the mission list. */
  readonly summary: string;
  /** The enemy band, shown on its troop banner. */
  readonly band: string;
  /** The enemy's level; also the squad level the mission is meant for. */
  readonly level: number;
  /** A repeating circuit on the overworld. One enemy piece carries this mission's squad. */
  readonly route: readonly string[];
  /** One to four enemies; the first is the band's leader. */
  readonly enemies: readonly MissionEnemy[];
  readonly objects?: readonly FieldObjectSpec[];
  readonly briefing: readonly StoryLine[];
  readonly debrief: readonly StoryLine[];
  /** Paid once, the first time the mission is won, on top of the battle's own pay. */
  readonly reward: {
    readonly gold: number;
    readonly items?: readonly ItemId[];
    /** Equipment ids given on the first win. */
    readonly gear?: readonly string[];
  };
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  /** The overworld region whose board the chapter's squads walk; Thornwatch if unset. */
  readonly region?: string;
  readonly missions: readonly Mission[];
}

/** Story missions pay like a Normal contract. */
const MISSION_REWARD = 1.6;

/** Every mission in play order. */
export function allMissions(campaign: readonly Chapter[] = CAMPAIGN): Mission[] {
  return campaign.flatMap((chapter) => chapter.missions);
}

export function findMission(id: string, campaign: readonly Chapter[] = CAMPAIGN): Mission | null {
  return allMissions(campaign).find((mission) => mission.id === id) ?? null;
}

/** The first mission not yet won, or null once the whole campaign is cleared. */
export function nextMission(
  cleared: readonly string[],
  campaign: readonly Chapter[] = CAMPAIGN,
): Mission | null {
  return allMissions(campaign).find((mission) => !cleared.includes(mission.id)) ?? null;
}

/** Missions open in order: a mission is playable once every mission before it is won. */
export function isUnlocked(
  id: string,
  cleared: readonly string[],
  campaign: readonly Chapter[] = CAMPAIGN,
): boolean {
  const missions = allMissions(campaign);
  const index = missions.findIndex((mission) => mission.id === id);
  return index >= 0 && missions.slice(0, index).every((mission) => cleared.includes(mission.id));
}

/**
 * The battle for a mission. Its enemies are veterans rolled from a seed of the mission's
 * id, so a mission always fields the same band with the same sheets.
 */
export function missionContract(mission: Mission): Contract {
  const random = seededRandom(hashSeed(mission.id));
  return {
    id: `mission_${mission.id}`,
    missionId: mission.id,
    band: mission.band,
    title: mission.title,
    tier: 'normal',
    level: mission.level,
    rewardMultiplier: MISSION_REWARD,
    enemies: mission.enemies.map((enemy, index) => ({
      ...veteran(enemy.classId, mission.level, random),
      id: `${mission.id}_${index}`,
      name: enemy.name,
    })),
    objects: [...(mission.objects ?? [])],
  };
}

/** Fills `{leader}` with the squad leader's name. */
export function tellLine(line: StoryLine, leader: string): StoryLine {
  return {
    ...line,
    speaker: line.speaker.replaceAll('{leader}', leader),
    text: line.text.replaceAll('{leader}', leader),
  };
}

/** The chapter a mission belongs to. */
export function chapterOf(
  missionId: string,
  campaign: readonly Chapter[] = CAMPAIGN,
): Chapter | null {
  return campaign.find((chapter) => chapter.missions.some((m) => m.id === missionId)) ?? null;
}

/** Whether every mission of a chapter is won. */
export function chapterCleared(
  chapterId: string,
  cleared: readonly string[],
  campaign: readonly Chapter[] = CAMPAIGN,
): boolean {
  const chapter = campaign.find((c) => c.id === chapterId);
  return !!chapter && chapter.missions.every((m) => cleared.includes(m.id));
}
