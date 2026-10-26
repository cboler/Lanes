import { vi } from 'vitest';
import { BattleStateService } from '../src/app/core/services/battle-state.service';
import { executionKind } from '../src/app/core/engine/execution';
import type { Contract } from '../src/app/core/models/contract.model';
import type { Mercenary, Random } from '../src/app/core/models/mercenary.model';
import type { UnitClassDefinition } from '../src/app/core/models/unit-class.model';
import { PROFILES, ProfileId, draw } from './profiles';

/*
 * One battle, played out headless by the game's own rules and AI, with the AI also
 * playing the player's side (auto-battle) and a skill profile standing in for the
 * player's timing. Timers are faked, so a battle takes milliseconds.
 */

export type Setup =
  | {
      readonly kind: 'classes';
      readonly player: readonly UnitClassDefinition[];
      readonly enemy: readonly UnitClassDefinition[];
    }
  | {
      readonly kind: 'contract';
      readonly squad: readonly Mercenary[];
      readonly contract: Contract;
    };

/** Everything the reports need from one battle. */
export interface BattleRecord {
  readonly outcome: 'victory' | 'defeat' | 'stalled';
  readonly timedOut: boolean;
  readonly rounds: number;
  /** Who took the first turn. */
  readonly first: 'player' | 'enemy';
  readonly strengthLeft: { readonly player: number; readonly enemy: number };
  readonly playerUnits: number;
  readonly playerFallen: number;
  readonly enemyUnits: number;
  readonly enemyFallen: number;
  readonly playerClasses: readonly string[];
  readonly enemyClasses: readonly string[];
  /** Damage dealt, keyed "player:archer" / "enemy:fighter". */
  readonly damageByClass: Readonly<Record<string, number>>;
  /** Skill uses, damage and kills, keyed by skill id. */
  readonly skills: Readonly<Record<string, { uses: number; damage: number; kills: number }>>;
  /** Shield blocks and covers on the player's side and the enemy's. */
  readonly shields: Readonly<
    Record<'player' | 'enemy', { blocks: number; blocked: number; covers: number; covered: number }>
  >;
  readonly guardAbsorbed: number;
  readonly healing: number;
  readonly grades: Readonly<Record<string, number>>;
  readonly statuses: Readonly<Record<string, number>>;
  readonly biggestHit: number;
  /** The most enemies one player unit felled. */
  readonly topKills: number;
  readonly assists: number;
}

const MAX_STEPS = 2000;

export function runBattle(setup: Setup, profileId: ProfileId, random: Random): BattleRecord {
  const service = new BattleStateService();
  if (setup.kind === 'classes') service.initSkirmish([...setup.player], [...setup.enemy]);
  else service.deployContract(setup.contract, setup.squad);

  const profile = PROFILES[profileId];
  const first = service.activeUnit()?.team ?? 'player';
  const damageByClass: Record<string, number> = {};
  const skills: Record<string, { uses: number; damage: number; kills: number }> = {};
  const shields = {
    player: { blocks: 0, blocked: 0, covers: 0, covered: 0 },
    enemy: { blocks: 0, blocked: 0, covers: 0, covered: 0 },
  };
  const grades: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const kills = new Map<string, number>();
  let guardAbsorbed = 0;
  let healing = 0;
  let biggestHit = 0;

  // A melee follow-up in the same turn is a combo press; the first strike has no grade.
  let turnKey = '';
  let actionsThisTurn = 0;
  service.simulation = {
    autoGrade: (unit, ability) => {
      const key = `${service.roundNumber()}:${unit.id}`;
      if (key !== turnKey) {
        turnKey = key;
        actionsThisTurn = 0;
      }
      const kind = executionKind(unit, ability);
      const followUp = actionsThisTurn++ > 0;
      if (kind === 'aim' && profile.aim) return draw(random, profile.aim);
      if (kind === 'combo' && profile.combo && followUp) return draw(random, profile.combo);
      return undefined;
    },
    onResolve: (attacker, ability, effects, grade) => {
      if (grade) grades[grade] = (grades[grade] ?? 0) + 1;
      const skill = (skills[ability.id] ??= { uses: 0, damage: 0, kills: 0 });
      skill.uses++;
      for (const effect of effects) {
        if (effect.statusApplied) {
          statuses[effect.statusApplied] = (statuses[effect.statusApplied] ?? 0) + 1;
        }
        if (effect.isHealing) {
          healing += effect.amount;
          continue;
        }
        if (effect.missed || effect.isFriendlyFire) continue;
        const key = `${attacker.team}:${attacker.classDef.id}`;
        damageByClass[key] = (damageByClass[key] ?? 0) + effect.amount;
        skill.damage += effect.amount;
        biggestHit = Math.max(biggestHit, effect.amount + effect.guardAbsorbed);
        guardAbsorbed += effect.guardAbsorbed;
        const side = shields[effect.target.team];
        if (effect.blocked) {
          side.blocks++;
          side.blocked += effect.blocked;
        }
        if (effect.covered) {
          side.covers++;
          side.covered += effect.covered;
        }
        if (effect.wasDefeated && !effect.target.isObject) {
          skill.kills++;
          if (attacker.team === 'player') kills.set(attacker.id, (kills.get(attacker.id) ?? 0) + 1);
        }
      }
    },
  };

  service.toggleAutoBattle();
  for (let step = 0; step < MAX_STEPS && service.battleStatus() === 'active'; step++) {
    vi.advanceTimersByTime(5000);
  }
  const status = service.battleStatus();
  const report = service.battleReport();
  const fighters = service.units().filter((u) => !u.isObject);
  const side = (team: 'player' | 'enemy') => fighters.filter((u) => u.team === team);
  const record: BattleRecord = {
    outcome: status === 'active' ? 'stalled' : status,
    timedOut: !!report?.timedOut,
    rounds: service.roundNumber(),
    first,
    strengthLeft: { player: service.strengthLeft('player'), enemy: service.strengthLeft('enemy') },
    playerUnits: side('player').length,
    playerFallen: side('player').filter((u) => !u.isAlive).length,
    enemyUnits: side('enemy').length,
    enemyFallen: side('enemy').filter((u) => !u.isAlive).length,
    playerClasses: side('player').map((u) => u.classDef.id),
    enemyClasses: side('enemy').map((u) => u.classDef.id),
    damageByClass,
    skills,
    shields,
    guardAbsorbed,
    healing,
    grades,
    statuses,
    biggestHit,
    topKills: Math.max(0, ...kills.values()),
    assists: report?.assists?.length ?? 0,
  };
  service.suspend();
  vi.clearAllTimers();
  return record;
}
