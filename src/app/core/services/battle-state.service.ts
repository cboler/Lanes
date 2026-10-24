import { Injectable, computed, signal } from '@angular/core';
import { UnitInstance } from '../models/unit-instance.model';
import {
  ARCHER_CLASS,
  CLERIC_CLASS,
  FIGHTER_CLASS,
  GUNNER_CLASS,
  LANCER_CLASS,
  UnitClassDefinition,
  WITCH_CLASS,
} from '../models/unit-class.model';
import { TurnManager } from '../engine/turn-manager';
import { CombatExecutor, TargetEffect } from '../engine/combat-executor';
import { LaneSwitcher } from '../engine/lane-switcher';
import { AbilityDefinition } from '../models/ability.model';
import { DamageCalculator } from '../engine/damage-calculator';
import { DefenseOrder, DefensePlan, parseDefensePlan } from '../models/defense-plan.model';
import { getClassDefinition } from '../models/unit-class.model';
import { Mercenary, deriveCombatStats } from '../models/mercenary.model';
import { chooseDefenseTarget } from '../engine/defense-policy';
import { chooseBuff, choosePlacement, statusValue } from '../engine/ai-tactics';
import {
  COLLISION_BUFFER,
  FIELD_MAX_X,
  FIELD_MIN_X,
  MOVE_COST_PER_FIELD,
  meleeReach,
  needsReach,
} from '../engine/field';
import {
  ASSIST_COST,
  ASSIST_MAX,
  AssistGauges,
  assistCandidates,
  assistGain,
} from '../engine/assist';
import { BattleReport } from '../models/progression.model';
import { Contract } from '../models/contract.model';
import {
  FieldTrap,
  TRAP_NAMES,
  barricadeStats,
  makeTrap,
  placementSpot,
  springTrap,
  trapsCrossed,
} from '../models/field-object.model';
import { BARRICADE_CLASS } from '../models/unit-class.model';
import { knownAbilities } from '../models/skills.model';
import {
  CHAIN_WINDOW,
  ExecutionGrade,
  aimGrade,
  aimSweepMs,
  aimZoneCenter,
  chainGrade,
  executionKind,
} from '../engine/execution';

const TIMING_KEY = 'lanes.timing.v1';
const SPEED_KEY = 'lanes.speed.v1';

export { COLLISION_BUFFER };
/** Presentation only: when a skill visibly lands, at 1x speed. Rules resolve immediately. */
export const IMPACT_DELAY_MS = 420;

export interface FloatingText {
  id: string;
  targetId: string;
  text: string;
  isHealing: boolean;
  isFriendlyFire: boolean;
  /** A timing result (critical, Just Cancel) rather than a number. */
  isGrade: boolean;
}

/** A resolved skill, published so the stage can replay it; rules have already applied it. */
export interface BattleAction {
  readonly seq: number;
  readonly attackerId: string;
  readonly abilityId: string;
  readonly grade?: ExecutionGrade;
  readonly effects: readonly {
    readonly targetId: string;
    readonly isHealing: boolean;
    readonly guardAbsorbed: number;
    readonly wasDefeated: boolean;
    readonly isFriendlyFire: boolean;
    readonly missed: boolean;
    readonly isBuff: boolean;
    /** Where a knocked-back target stood before the shove, so the stage can hold it there until impact. */
    readonly pushedFrom?: number;
  }[];
}

/** A ranged or magic skill waiting for the player to fire its sweeping cursor. */
export interface AimState {
  readonly abilityId: string;
  readonly targetIds: readonly string[];
  /** Where the target sits on the track, 0 to 1. */
  readonly center: number;
  readonly sweepMs: number;
  readonly startedAt: number;
}

/** A melee skill just landed; another melee skill pressed in the window chains on. */
export interface ComboState {
  readonly attackerId: string;
  readonly abilityId: string;
  readonly targetId: string | null;
  readonly openedAt: number;
  /** Skills in the combo so far. */
  readonly count: number;
  /** The animation time scale when the window opened. */
  readonly speed: number;
}

const GRADE_LOGS: Record<ExecutionGrade, string> = {
  critical: '🎯 Dead centre! Critical hit ×1.3.',
  hit: '🎯 On target.',
  graze: '🎯 Grazed: half damage.',
  miss: '💨 Missed! The shot found only dirt.',
  chain: '🔗 Chained ×1.1.',
  just: '⚡ JUST CANCEL! ×1.3.',
};

/** How a skill's status reads in floating text and the log, e.g. "STUN" or "DEF -15". */
export function statusLabel(ability: AbilityDefinition): string {
  const status = ability.status;
  if (!status) return '';
  switch (status.type) {
    case 'stun':
      return 'STUN';
    case 'poison':
      return `POISON ${status.potency}/turn`;
    case 'attack-up':
      return `ATK +${status.potency}`;
    case 'attack-down':
      return `ATK -${status.potency}`;
    case 'defense-up':
      return `DEF +${status.potency}`;
    case 'defense-down':
      return `DEF -${status.potency}`;
  }
}

function readTimingPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(TIMING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export type BattleStatus = 'active' | 'victory' | 'defeat';
export type BattleSpeed = '1x' | '2x';

function readSpeedPreference(): BattleSpeed {
  try {
    return globalThis.localStorage?.getItem(SPEED_KEY) === '2x' ? '2x' : '1x';
  } catch {
    return '1x';
  }
}

@Injectable({
  providedIn: 'root',
})
export class BattleStateService {
  private turnManager = new TurnManager();

  public readonly units = signal<UnitInstance[]>([]);
  public readonly activeUnitId = signal<string | null>(null);
  public readonly selectedAbilityId = signal<string | null>(null);
  public readonly targetedUnitId = signal<string | null>(null);
  public readonly combatLogs = signal<string[]>([]);
  public readonly battleStatus = signal<BattleStatus>('active');
  public readonly floatingTexts = signal<FloatingText[]>([]);
  public readonly roundNumber = signal<number>(1);
  public readonly isAiThinking = signal<boolean>(false);
  public readonly practicePlan = signal<DefensePlan | null>(null);
  /** The guild contract being fought, if any. Kept through restarts. */
  public readonly activeContract = signal<Contract | null>(null);

  // Auto-battle and combat animations
  public readonly isAutoBattle = signal<boolean>(false);
  /** Animation and AI pacing; remembered on this device. */
  public readonly autoBattleSpeed = signal<BattleSpeed>(readSpeedPreference());
  public readonly attackingUnitId = signal<string | null>(null);
  public readonly hitUnitId = signal<string | null>(null);
  public readonly lastAction = signal<BattleAction | null>(null);
  /** Set once when a battle ends, for the rewards; null while it is being fought. */
  public readonly battleReport = signal<BattleReport | null>(null);
  /** Each side's assist gauge, 0 to ASSIST_MAX; every ASSIST_COST is one orb. */
  public readonly assistGauge = signal<AssistGauges>({ player: 0, enemy: 0 });
  /** Traps on the field; each springs once on an enemy of the side that set it. */
  public readonly traps = signal<FieldTrap[]>([]);

  /** Allies the player could call on now, if an orb is ready. */
  public readonly assistOptions = computed(() => {
    const active = this.activeUnit();
    if (!active || !this.canPlayerAct() || this.aim()) return [];
    if (this.assistGauge()[active.team] < ASSIST_COST) return [];
    return assistCandidates(active, this.units(), this.targetedUnitId());
  });

  /** Player skills use aim and combo timing; off resolves them at normal power, like the AI. */
  public readonly timingEnabled = signal(readTimingPreference());
  public readonly aim = signal<AimState | null>(null);
  public readonly combo = signal<ComboState | null>(null);

  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private executionTimer: ReturnType<typeof setTimeout> | null = null;
  private turnVersion = 0;
  private battleVersion = 0;
  private suspended = false;
  private actionSeq = 0;
  /** Which roster mercenary each player unit is, by unit id. */
  private mercenaryOf = new Map<string, string>();
  /** Each mercenary unit's level, which scales the objects its skills set down. */
  private levelOf = new Map<string, number>();
  private placedCount = 0;
  /** Who set each placed barricade or trap down, by object id. */
  private placedBy = new Map<string, string>();
  private playerSquad = [FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS, LANCER_CLASS];
  private playerMercenaries: readonly (Mercenary | undefined)[] = [];
  private enemySquad = [LANCER_CLASS, GUNNER_CLASS, WITCH_CLASS, FIGHTER_CLASS];
  private defenseOrders = new Map<string, DefenseOrder[]>();
  private defenseTurns = new Map<string, number>();
  private attemptedDefenseTurns = new Map<string, number>();

  /** Practice against a defense plan, with `squad` attacking, or the last squad if none. */
  public initDefensePractice(value: unknown, squad?: readonly Mercenary[]): void {
    const plan = parseDefensePlan(value);
    if (!plan) throw new Error('Defense plan is invalid.');
    this.initSkirmish(
      squad ? squad.map((merc) => getClassDefinition(merc.classId)) : [...this.playerSquad],
      plan.members.map((member) => getClassDefinition(member.mercenary.classId)),
      plan,
      squad ?? this.playerMercenaries,
    );
  }

  /** Brings the squad's sheets up to date (after a level-up) for the next restart. */
  public refreshMercenaries(latest: readonly Mercenary[]): void {
    this.playerMercenaries = this.playerMercenaries.map(
      (merc) => latest.find((m) => m.id === merc?.id) ?? merc,
    );
  }

  /** Fights a guild contract: the squad against the contract's band of mercenaries. */
  public deployContract(contract: Contract, squad: readonly Mercenary[]): void {
    this.initSkirmish(
      squad.map((merc) => getClassDefinition(merc.classId)),
      contract.enemies.map((merc) => getClassDefinition(merc.classId)),
      undefined,
      squad,
      contract,
    );
  }

  /** A skirmish with roster mercenaries as the player's squad. */
  public deployMercenaries(squad: readonly Mercenary[], enemySquad?: UnitClassDefinition[]): void {
    this.initSkirmish(
      squad.map((merc) => getClassDefinition(merc.classId)),
      enemySquad,
      undefined,
      squad,
    );
  }

  public readonly activeUnit = computed(() => {
    const id = this.activeUnitId();
    return this.units().find((u) => u.id === id && u.isAlive) ?? null;
  });

  public readonly turnOrder = computed(() => {
    this.units();
    this.activeUnitId();
    const order = this.turnManager.order;
    const index = this.turnManager.currentIndex;
    return [...order.slice(index), ...order.slice(0, index)].filter((u) => u.isAlive);
  });

  /** How many upcoming entries of turnOrder belong to the current round. */
  public readonly turnsLeftInRound = computed(() => {
    this.units();
    this.activeUnitId();
    return this.turnManager.order.slice(this.turnManager.currentIndex).filter((u) => u.isAlive)
      .length;
  });

  public readonly canPlayerAct = computed(() => {
    const unit = this.activeUnit();
    return (
      !!unit &&
      unit.team === 'player' &&
      !unit.isStunned &&
      this.battleStatus() === 'active' &&
      !this.isAutoBattle()
    );
  });

  public readonly selectedAbility = computed<AbilityDefinition | null>(() => {
    const unit = this.activeUnit();
    const abilityId = this.selectedAbilityId();
    if (!unit || !abilityId) return null;
    return unit.abilities.find((a) => a.id === abilityId) ?? null;
  });

  public readonly validTargets = computed<UnitInstance[]>(() => {
    const unit = this.activeUnit();
    const ability = this.selectedAbility();
    if (!unit || !ability) return [];
    return CombatExecutor.getValidTargets(unit, ability, this.units());
  });

  /** Allies the selected area skill would also hit. */
  public readonly friendlyFireRisk = computed<UnitInstance[]>(() => {
    const active = this.activeUnit();
    const ability = this.selectedAbility();
    if (!active || !ability?.friendlyFire) return [];
    return this.units().filter(
      (unit) =>
        unit.isAlive &&
        unit.team === active.team &&
        unit.id !== active.id &&
        (ability.target === 'all-enemies' || unit.lane === active.lane),
    );
  });

  public readonly playerUnits = computed(() => {
    return this.units().filter((u) => u.team === 'player');
  });

  public readonly enemyUnits = computed(() => {
    // Fighters only: barricades are in units() but are not part of the band.
    return this.units().filter((u) => u.team === 'enemy' && !u.isObject);
  });

  public get delayMultiplier(): number {
    return this.autoBattleSpeed() === '2x' ? 0.45 : 1.0;
  }

  public initSkirmish(
    customPlayerSquad?: UnitClassDefinition[],
    customEnemySquad?: UnitClassDefinition[],
    defensePlan?: DefensePlan,
    /** Roster members for the player side, aligned by index with the squad. */
    playerMercenaries?: readonly (Mercenary | undefined)[],
    /** A guild contract: its band fights in place of class troops. */
    contract?: Contract,
  ): void {
    const playerSquad = customPlayerSquad ?? this.playerSquad;
    const enemySquad = customEnemySquad ?? this.enemySquad;
    if (![playerSquad, enemySquad].every((squad) => squad.length >= 1 && squad.length <= 4)) {
      throw new Error('Each squad must contain between one and four mercenaries.');
    }
    this.clearScheduledActions();
    this.playerSquad = [...playerSquad];
    if (customPlayerSquad || playerMercenaries) this.playerMercenaries = playerMercenaries ?? [];
    this.enemySquad = [...enemySquad];
    // A restart (no arguments) keeps whatever was being fought: practice or a contract.
    const restart = !customPlayerSquad && !customEnemySquad;
    const activeContract = contract ?? (restart && !defensePlan ? this.activeContract() : null);
    const activePlan = activeContract
      ? null
      : (defensePlan ?? (restart ? this.practicePlan() : null));
    this.practicePlan.set(activePlan);
    this.activeContract.set(activeContract);
    this.defenseOrders = new Map();
    this.defenseTurns = new Map();
    this.attemptedDefenseTurns = new Map();
    this.battleVersion++;
    this.turnVersion++;
    this.suspended = false;
    this.turnManager = new TurnManager();
    this.isAutoBattle.set(false);
    this.isAiThinking.set(false);
    this.floatingTexts.set([]);
    this.lastAction.set(null);
    this.battleReport.set(null);
    this.assistGauge.set({ player: 0, enemy: 0 });
    this.traps.set([]);
    this.mercenaryOf = new Map();
    this.levelOf = new Map();
    this.placedBy = new Map();
    this.attackingUnitId.set(null);
    this.hitUnitId.set(null);

    const newUnits: UnitInstance[] = [];

    // Grand Kingdom Vanguard Formations:
    // Frontline fighters (Tank: Fighter, Melee: Lancer) are positioned up front.
    // Backline units (Support: Cleric, Ranged: Archer, Witch, Gunner) are positioned in the rear.
    // Player: Frontline at X=0.32, Rear at X=0.14
    // Enemy: Frontline at X=0.68, Rear at X=0.86
    playerSquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      let posX = isFront ? 0.32 : 0.14;
      if (newUnits.some((u) => u.team === 'player' && u.lane === lane && u.positionX === posX)) {
        posX = isFront ? 0.14 : 0.32;
      }
      const merc = this.playerMercenaries[idx];
      const unit = new UnitInstance(
        cls,
        merc ? merc.name : `Player ${cls.name}`,
        'player',
        lane,
        posX,
        100,
        undefined,
        merc ? deriveCombatStats(cls, merc) : undefined,
        merc ? { abilities: knownAbilities(merc), supports: merc.supports } : undefined,
      );
      if (merc) this.mercenaryOf.set(unit.id, merc.id);
      if (merc) this.levelOf.set(unit.id, merc.level);
      newUnits.push(unit);
    });

    enemySquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      let posX = isFront ? 0.68 : 0.86;
      if (newUnits.some((u) => u.team === 'enemy' && u.lane === lane && u.positionX === posX)) {
        posX = isFront ? 0.86 : 0.68;
      }
      // Defenders are the plan's mercenaries. Practice may pit a mercenary against itself.
      const merc = activePlan?.members[idx]?.mercenary ?? activeContract?.enemies[idx];
      const name = !merc
        ? `Enemy ${cls.name}`
        : newUnits.some((u) => u.name === merc.name)
          ? `${merc.name} (Def)`
          : merc.name;
      const unit = new UnitInstance(
        cls,
        name,
        'enemy',
        lane,
        posX,
        100,
        undefined,
        merc ? deriveCombatStats(cls, merc) : undefined,
        merc ? { abilities: knownAbilities(merc), supports: merc.supports } : undefined,
      );
      newUnits.push(unit);
      if (merc) this.levelOf.set(unit.id, merc.level);
      if (activePlan) this.defenseOrders.set(unit.id, activePlan.members[idx].orders);
    });

    for (const [index, spec] of (activeContract?.objects ?? []).entries()) {
      if (spec.kind === 'barricade') {
        newUnits.push(
          new UnitInstance(
            BARRICADE_CLASS,
            'Barricade',
            'enemy',
            spec.lane,
            spec.x,
            100,
            `enemy_barricade_${index}`,
            barricadeStats(activeContract!.level),
          ),
        );
      } else {
        const trap = makeTrap(spec, 'enemy', activeContract!.level, `trap_${index}`);
        this.traps.update((list) => [...list, trap]);
      }
    }

    this.units.set(newUnits);
    this.turnManager.setOrder(newUnits);
    this.roundNumber.set(1);
    this.battleStatus.set('active');
    this.combatLogs.set([
      activePlan
        ? '⚔️ Local defense practice commenced. First four defender turns use saved orders.'
        : activeContract
          ? `📜 Contract: ${activeContract.title}. The ${activeContract.band} take the field.`
          : '⚔️ Battle commenced! Frontline warriors hold the vanguard.',
      'Control units manually or toggle Auto-Battle to let tactical AI resolve combat.',
      'Move with MG, attack with AP. Guard converts unspent AP into a shield until your next turn.',
    ]);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.startTurnForUnit(this.turnManager.current);
  }

  public toggleAutoBattle(): void {
    if (this.battleStatus() !== 'active' || this.suspended) return;
    const next = !this.isAutoBattle();
    this.isAutoBattle.set(next);
    this.addLog(next ? '⚡ Auto-Battle: ENGAGED' : '⏸️ Auto-Battle: PAUSED');

    const active = this.activeUnit();
    if (active?.team === 'player' && !active.isStunned) {
      this.clearScheduledActions();
      if (next) this.triggerAiTurn();
    }
  }

  public toggleTiming(): void {
    const next = !this.timingEnabled();
    this.timingEnabled.set(next);
    try {
      globalThis.localStorage?.setItem(TIMING_KEY, next ? 'on' : 'off');
    } catch {
      // Storage can be blocked; the choice still holds for this session.
    }
    this.addLog(
      next
        ? '🎯 Timing: ON — aim and chain your attacks.'
        : '🎯 Timing: OFF — attacks land at normal power.',
    );
  }

  public toggleAutoSpeed(): void {
    const next = this.autoBattleSpeed() === '1x' ? '2x' : '1x';
    this.autoBattleSpeed.set(next);
    try {
      globalThis.localStorage?.setItem(SPEED_KEY, next);
    } catch {
      // Storage can be blocked; the choice still holds for this session.
    }
    this.addLog(`⏩ Combat Speed: ${next}`);
  }

  private startTurnForUnit(unit: UnitInstance | null): void {
    if (!unit || !unit.isAlive) {
      this.advanceTurn();
      return;
    }

    this.turnVersion++;
    unit.startTurn();
    if (unit.team === 'enemy' && this.practicePlan()) {
      this.defenseTurns.set(unit.id, (this.defenseTurns.get(unit.id) ?? 0) + 1);
    }
    this.units.update((list) => [...list]);
    this.activeUnitId.set(unit.id);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.addLog(`⭐ Turn: ${unit.name} (${unit.team.toUpperCase()}) [Lane ${unit.lane + 1}]`);

    this.queueActiveTurn();
  }

  private queueActiveTurn(): void {
    const unit = this.activeUnit();
    if (!unit || this.suspended || this.battleStatus() !== 'active') return;
    if (unit.isStunned) {
      this.addLog(`⚡ ${unit.name} is stunned and forfeits their turn!`);
      this.scheduleTurnAction(() => this.endCurrentTurn(true), 800);
      return;
    }

    if (unit.team === 'enemy' || this.isAutoBattle()) this.triggerAiTurn();
  }

  /** The span of positionX this unit could walk to with its remaining Move Gauge. */
  public reachableSpan(unit: UnitInstance): { from: number; to: number } {
    const reach = unit.moveGauge.current / MOVE_COST_PER_FIELD;
    let from = Math.max(FIELD_MIN_X, unit.positionX - reach);
    let to = Math.min(FIELD_MAX_X, unit.positionX + reach);
    for (const other of this.units()) {
      if (other === unit || !other.isAlive || other.lane !== unit.lane) continue;
      if (other.positionX > unit.positionX) to = Math.min(to, other.positionX - COLLISION_BUFFER);
      else from = Math.max(from, other.positionX + COLLISION_BUFFER);
    }
    return { from: Math.min(from, unit.positionX), to: Math.max(to, unit.positionX) };
  }

  public moveActiveUnit(deltaX: number, automated = false): boolean {
    const unit = this.activeUnit();
    if (!unit || !this.canAct(automated) || !Number.isFinite(deltaX)) return false;

    const minX = FIELD_MIN_X;
    const maxX = FIELD_MAX_X;

    // Check lane collision with other living units in the same lane
    const obstaclesInLane = this.units().filter(
      (u) => u.id !== unit.id && u.isAlive && u.lane === unit.lane,
    );

    let targetX = unit.positionX + deltaX;

    if (deltaX > 0) {
      // Moving right: blocked by any unit with positionX > unit.positionX
      const ahead = obstaclesInLane.filter((u) => u.positionX > unit.positionX);
      if (ahead.length > 0) {
        const closestAhead = ahead.reduce(
          (min, u) => (u.positionX < min.positionX ? u : min),
          ahead[0],
        );
        const maxBoundary = closestAhead.positionX - COLLISION_BUFFER;
        if (unit.positionX >= maxBoundary - 0.001) {
          this.addLog(`🛡️ Path blocked! ${unit.name} cannot advance past ${closestAhead.name}.`);
          return false;
        }
        targetX = Math.min(targetX, maxBoundary);
      }
      targetX = Math.min(maxX, targetX);
    } else if (deltaX < 0) {
      // Moving left: blocked by any unit with positionX < unit.positionX
      const behind = obstaclesInLane.filter((u) => u.positionX < unit.positionX);
      if (behind.length > 0) {
        const closestBehind = behind.reduce(
          (max, u) => (u.positionX > max.positionX ? u : max),
          behind[0],
        );
        const minBoundary = closestBehind.positionX + COLLISION_BUFFER;
        if (unit.positionX <= minBoundary + 0.001) {
          this.addLog(`🛡️ Path blocked! ${unit.name} cannot retreat past ${closestBehind.name}.`);
          return false;
        }
        targetX = Math.max(targetX, minBoundary);
      }
      targetX = Math.max(minX, targetX);
    }

    const actualDist = Math.abs(targetX - unit.positionX);
    if (actualDist < 0.002) {
      return false;
    }

    const moveCost = Math.round(actualDist * MOVE_COST_PER_FIELD * 100) / 100;
    if (!unit.moveGauge.trySpend(moveCost)) {
      this.addLog(`⚠️ Insufficient Move Gauge to move.`);
      return false;
    }

    const fromX = unit.positionX;
    unit.positionX = targetX;
    this.springTraps(unit, fromX, targetX);
    // Stepping away ends a combo.
    this.clearExecution();
    this.units.update((list) => [...list]);
    return true;
  }

  public switchActiveUnitLane(targetLane: number, automated = false): boolean {
    const unit = this.activeUnit();
    if (!unit || !this.canAct(automated)) return false;

    // Verify destination coordinate is not occupied by another unit in targetLane
    const blocking = this.units().find(
      (u) =>
        u.id !== unit.id &&
        u.isAlive &&
        u.lane === targetLane &&
        Math.abs(u.positionX - unit.positionX) < COLLISION_BUFFER,
    );

    if (blocking) {
      this.addLog(
        `⚠️ Cannot switch to Lane ${targetLane + 1}: space occupied by ${blocking.name}!`,
      );
      return false;
    }

    const oldLane = unit.lane;
    const success = LaneSwitcher.trySwitchLane(unit, targetLane);
    if (success) {
      this.clearExecution();
      this.addLog(`↕️ ${unit.name} shifted from Lane ${oldLane + 1} to Lane ${targetLane + 1}.`);
      this.springTraps(unit, unit.positionX, unit.positionX);
      this.units.update((list) => [...list]);
      this.targetedUnitId.set(null);
      return true;
    } else {
      this.addLog(
        `⚠️ Cannot switch to Lane ${targetLane + 1} (insufficient gauge or invalid lane).`,
      );
      return false;
    }
  }

  public selectAbility(abilityId: string | null): void {
    if (!this.canAct(false)) return;
    this.clearExecution();
    this.selectedAbilityId.set(abilityId);
    this.targetedUnitId.set(this.validTargets()[0]?.id ?? null);
  }

  /** The player's confirm: starts the aim, or resolves the skill and opens a combo window. */
  public commitSelectedAbility(targetOverride?: UnitInstance): boolean {
    const attacker = this.activeUnit();
    const ability = this.selectedAbility();
    if (!attacker || !ability || !this.canAct(false)) return false;
    const kind = this.timingEnabled() ? executionKind(attacker, ability) : 'none';
    if (kind !== 'aim') {
      if (!this.executeSelectedAbility(targetOverride)) return false;
      if (kind === 'combo') this.openCombo(attacker, ability, 1);
      return true;
    }
    const targets = this.resolveTargets(ability, targetOverride);
    if (!targets) return false;
    if (attacker.actionGauge.current < ability.actionCost) {
      this.addLog('⚠️ Insufficient action gauge.');
      return false;
    }
    const sweepMs = aimSweepMs(ability, attacker.supports);
    this.aim.set({
      abilityId: ability.id,
      targetIds: targets.map((t) => t.id),
      center: aimZoneCenter(attacker, targets),
      sweepMs,
      startedAt: performance.now(),
    });
    // Letting the cursor run off the end of the track is a miss.
    this.executionTimer = setTimeout(() => this.fireAim(), sweepMs);
    return true;
  }

  /** Fires the pending aim where the cursor is now. */
  public fireAim(): boolean {
    const aim = this.aim();
    if (!aim) return false;
    this.clearExecution();
    const cursor = (performance.now() - aim.startedAt) / aim.sweepMs;
    const grade = cursor >= 1 ? 'miss' : aimGrade(cursor, aim.center);
    const target = this.units().find((u) => u.id === aim.targetIds[0]);
    return this.executeSelectedAbility(target, false, grade);
  }

  /**
   * Presses a skill during an open combo window. Returns false when it is not a chain
   * (wrong skill, window closed), so the caller can treat it as an ordinary selection.
   */
  public chainAbility(abilityId: string): boolean {
    const combo = this.combo();
    const attacker = this.activeUnit();
    if (!combo || !attacker || attacker.id !== combo.attackerId || !this.canAct(false))
      return false;
    const ability = attacker.abilities.find((a) => a.id === abilityId);
    if (!ability || executionKind(attacker, ability) !== 'combo') return false;
    const grade = chainGrade(performance.now() - combo.openedAt, combo.speed, attacker.supports);
    // A press before the strike lands is swallowed, so a double tap cannot drop the combo.
    if (grade === 'early') return true;
    this.clearExecution();
    if (!grade || attacker.actionGauge.current < ability.actionCost) return false;
    const targets = CombatExecutor.getValidTargets(attacker, ability, this.units());
    const target = targets.find((t) => t.id === combo.targetId) ?? targets[0];
    if (!target) return false;
    this.selectedAbilityId.set(ability.id);
    if (!this.executeSelectedAbility(target, false, grade)) return false;
    const count = combo.count + 1;
    this.triggerFloatingText(
      attacker.id,
      grade === 'just' ? `JUST CANCEL · ${count} hits` : `${count} hit combo`,
      false,
      false,
      true,
    );
    this.openCombo(attacker, ability, count);
    return true;
  }

  private openCombo(attacker: UnitInstance, ability: AbilityDefinition, count: number): void {
    const canChain = attacker.abilities.some(
      (a) => executionKind(attacker, a) === 'combo' && a.actionCost <= attacker.actionGauge.current,
    );
    if (!canChain || this.battleStatus() !== 'active') return;
    const speed = this.delayMultiplier;
    this.combo.set({
      attackerId: attacker.id,
      abilityId: ability.id,
      targetId: this.lastAction()?.effects[0]?.targetId ?? null,
      openedAt: performance.now(),
      count,
      speed,
    });
    this.executionTimer = setTimeout(() => this.clearExecution(), CHAIN_WINDOW.close * speed);
  }

  /** The units a confirm would hit, or null (with a log line) when there is no legal target. */
  private resolveTargets(
    ability: AbilityDefinition,
    targetOverride?: UnitInstance,
  ): UnitInstance[] | null {
    if (!ability.target.startsWith('single-')) return this.validTargets();
    const target = targetOverride ?? this.units().find((u) => u.id === this.targetedUnitId());
    if (!target || !this.validTargets().some((t) => t.id === target.id)) {
      this.addLog(`⚠️ Select a valid target in range for ${ability.name}.`);
      return null;
    }
    return [target];
  }

  public executeSelectedAbility(
    targetOverride?: UnitInstance,
    automated = false,
    grade?: ExecutionGrade,
  ): boolean {
    const attacker = this.activeUnit();
    const ability = this.selectedAbility();
    if (!attacker || !ability || !this.canAct(automated)) return false;

    const targets = this.resolveTargets(ability, targetOverride);
    if (!targets) return false;

    if (ability.place) {
      if (!this.placeObject(attacker, ability)) return false;
    } else {
      const result = CombatExecutor.execute(attacker, ability, targets, this.units(), grade);
      if (!result.success) {
        this.addLog(`⚠️ ${result.failureReason}`);
        return false;
      }
      this.resolveAction(attacker, ability, result.effects, grade);
    }

    // Reset selection
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    return true;
  }

  /** Where the selected skill would set its object down, or null if there is no room. */
  public readonly placement = computed(() => {
    const unit = this.activeUnit();
    const ability = this.selectedAbility();
    if (!unit || !ability?.place || this.hasPlaced(unit)) return null;
    return placementSpot(unit, ability.place, this.units(), this.traps());
  });

  /** One at a time: a unit's barricade must be broken, or its trap sprung, before it sets another. */
  public hasPlaced(unit: UnitInstance): boolean {
    const standing = [
      ...this.units()
        .filter((u) => u.isObject && u.isAlive)
        .map((u) => u.id),
      ...this.traps().map((trap) => trap.id),
    ];
    return standing.some((id) => this.placedBy.get(id) === unit.id);
  }

  /**
   * Sets a barricade or trap down ahead of `unit`, for the skill's AP. A barricade joins
   * the user's side as an object; a trap springs on the other side.
   */
  private placeObject(unit: UnitInstance, ability: AbilityDefinition): boolean {
    const kind = ability.place!;
    if (this.hasPlaced(unit)) {
      this.addLog(`⚠️ ${unit.name}'s last barricade or trap is still on the field.`);
      return false;
    }
    const x = placementSpot(unit, kind, this.units(), this.traps());
    if (x === null) {
      this.addLog(`⚠️ No room ahead in this lane for ${ability.name}.`);
      return false;
    }
    if (!unit.actionGauge.trySpend(ability.actionCost)) {
      this.addLog('⚠️ Insufficient action gauge.');
      return false;
    }
    const level = this.levelOf.get(unit.id) ?? 1;
    const id = `${unit.team}_placed_${++this.placedCount}`;
    this.placedBy.set(id, unit.id);
    if (kind === 'barricade') {
      const barricade = new UnitInstance(
        BARRICADE_CLASS,
        'Barricade',
        unit.team,
        unit.lane,
        x,
        100,
        id,
        barricadeStats(level),
      );
      this.units.update((list) => [...list, barricade]);
      this.addLog(`🧱 ${unit.name} raises a barricade in Lane ${unit.lane + 1}.`);
    } else {
      const trap = makeTrap({ kind: 'trap', trap: kind, lane: unit.lane, x }, unit.team, level, id);
      this.traps.update((list) => [...list, trap]);
      this.addLog(
        `🪤 ${unit.name} sets a ${TRAP_NAMES[kind].toLowerCase()} in Lane ${unit.lane + 1}.`,
      );
    }
    this.triggerFloatingText(unit.id, kind === 'barricade' ? 'BARRICADE' : 'TRAP SET', true, false);
    this.lastAction.set({
      seq: ++this.actionSeq,
      attackerId: unit.id,
      abilityId: ability.id,
      effects: [
        {
          targetId: unit.id,
          isHealing: false,
          guardAbsorbed: 0,
          wasDefeated: false,
          isFriendlyFire: false,
          missed: false,
          isBuff: true,
        },
      ],
    });
    this.units.update((list) => [...list]);
    return true;
  }

  /**
   * Spends an orb to have `allyId` make its pursuit attack now, outside its turn and free
   * of AP. The pursuit itself does not refill the gauge.
   */
  public callAssist(allyId: string, automated = false): boolean {
    const active = this.activeUnit();
    if (!active || !this.canAct(automated)) return false;
    if (this.assistGauge()[active.team] < ASSIST_COST) return false;
    const plan = assistCandidates(active, this.units(), this.targetedUnitId()).find(
      (candidate) => candidate.ally.id === allyId,
    );
    if (!plan) return false;
    const result = CombatExecutor.execute(
      plan.ally,
      plan.ability,
      plan.targets,
      this.units(),
      undefined,
      false,
    );
    if (!result.success) {
      this.addLog(`⚠️ ${result.failureReason}`);
      return false;
    }
    // A pursuit interrupts a combo.
    this.clearExecution();
    this.assistGauge.update((gauge) => ({
      ...gauge,
      [active.team]: gauge[active.team] - ASSIST_COST,
    }));
    this.addLog(`🤝 Assist! ${plan.ally.name} answers ${active.name}'s call.`);
    this.triggerFloatingText(plan.ally.id, 'ASSIST', false, false, true);
    this.resolveAction(plan.ally, plan.ability, result.effects, undefined, false);
    return true;
  }

  /** Logs, animates and publishes a resolved skill, then checks whether the battle ended. */
  private resolveAction(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    effects: readonly TargetEffect[],
    grade?: ExecutionGrade,
    fillsAssist = true,
  ): void {
    if (fillsAssist) {
      const gain = assistGain(effects);
      if (gain > 0) {
        this.assistGauge.update((gauge) => ({
          ...gauge,
          [attacker.team]: Math.min(ASSIST_MAX, gauge[attacker.team] + gain),
        }));
      }
    }

    // Trigger attack sprite animation
    this.attackingUnitId.set(attacker.id);
    const version = this.battleVersion;
    setTimeout(() => {
      if (version === this.battleVersion) this.attackingUnitId.set(null);
    }, 350 * this.delayMultiplier);

    this.processCombatEffects(attacker, ability, effects, grade);
    this.lastAction.set({
      seq: ++this.actionSeq,
      attackerId: attacker.id,
      abilityId: ability.id,
      grade,
      effects: effects.map((effect) => ({
        targetId: effect.target.id,
        isHealing: effect.isHealing,
        guardAbsorbed: effect.guardAbsorbed,
        wasDefeated: effect.wasDefeated,
        isFriendlyFire: effect.isFriendlyFire,
        missed: effect.missed,
        isBuff: ability.powerMultiplier === 0,
        pushedFrom: effect.pushed
          ? effect.target.positionX -
            Math.sign(effect.target.positionX - attacker.positionX) * effect.pushed
          : undefined,
      })),
    });
    for (const effect of effects) {
      if (effect.pushed && effect.target.isAlive) {
        const dir = Math.sign(effect.target.positionX - attacker.positionX);
        this.springTraps(
          effect.target,
          effect.target.positionX - dir * effect.pushed,
          effect.target.positionX,
        );
      }
    }
    this.units.update((list) => [...list]);

    // Check end condition
    this.checkBattleStatus();
  }

  /**
   * Springs every enemy trap `unit` passed over between `fromX` and `toX`. Each fires
   * once and is gone. A unit felled on its own turn ends that turn.
   */
  private springTraps(unit: UnitInstance, fromX: number, toX: number): void {
    for (const trap of trapsCrossed(this.traps(), unit, fromX, toX)) {
      if (!unit.isAlive) break;
      const sprung = springTrap(trap, unit);
      this.traps.update((list) => list.filter((t) => t.id !== trap.id));
      const label = sprung.status === 'stun' ? 'STUN' : 'POISON';
      this.triggerFloatingText(unit.id, `TRAP -${sprung.damage} · ${label}`, false, false);
      this.addLog(
        `🪤 ${unit.name} springs a ${TRAP_NAMES[trap.kind].toLowerCase()}: ${sprung.damage} damage.`,
      );
      if (sprung.defeated) this.addLog(`  💀 ${unit.name} has fallen!`);
    }
    this.units.update((list) => [...list]);
    this.checkBattleStatus();
    if (!unit.isAlive && unit.id === this.activeUnitId() && this.battleStatus() === 'active') {
      this.scheduleTurnAction(() => this.endCurrentTurn(true), 600);
    }
  }

  private processCombatEffects(
    attacker: UnitInstance,
    ability: AbilityDefinition,
    effects: readonly TargetEffect[],
    grade?: ExecutionGrade,
  ): void {
    this.addLog(`💥 ${attacker.name} unleashed [${ability.name}]!`);
    if (grade) this.addLog(`  ${GRADE_LOGS[grade]}`);

    for (const eff of effects) {
      if (eff.missed) {
        this.triggerFloatingText(eff.target.id, 'MISS', false, false, true);
        this.addLog(`  💨 ${eff.target.name} is untouched.`);
        continue;
      }
      const status = eff.statusApplied && statusLabel(ability);
      const numbers =
        ability.powerMultiplier === 0
          ? ''
          : eff.isHealing
            ? `+${eff.amount} HP`
            : eff.guardAbsorbed > 0
              ? `-${eff.amount} HP · ${eff.guardAbsorbed} blocked`
              : `-${eff.amount} HP`;
      const shove = eff.crash ? `SLAM -${eff.crash}` : eff.pushed ? 'PUSHED' : '';
      const amountText = [numbers, status, shove].filter(Boolean).join(' · ');
      const effectText =
        grade === 'critical'
          ? `CRIT ${amountText}`
          : grade === 'graze'
            ? `GRAZE ${amountText}`
            : amountText;

      // Trigger hit flash animation on damaged target
      if (!eff.isHealing && ability.powerMultiplier !== 0) {
        this.hitUnitId.set(eff.target.id);
        const version = this.battleVersion;
        setTimeout(() => {
          if (version === this.battleVersion) this.hitUnitId.set(null);
        }, 350 * this.delayMultiplier);
      }

      this.triggerFloatingText(
        eff.target.id,
        effectText,
        eff.isHealing || ability.powerMultiplier === 0,
        eff.isFriendlyFire,
        grade === 'critical',
      );

      if (eff.guardAbsorbed > 0) {
        this.addLog(`  🛡️ ${eff.target.name}'s Guard absorbed ${eff.guardAbsorbed} damage.`);
      }
      if (ability.powerMultiplier === 0) {
        this.addLog(`  ✨ ${eff.target.name}: ${status}.`);
      } else if (eff.isHealing) {
        this.addLog(`  💚 Restores ${eff.amount} HP to ${eff.target.name}.`);
      } else if (eff.isFriendlyFire) {
        this.addLog(
          `  ⚠️ FRIENDLY FIRE! ${eff.target.name} caught in blast for ${eff.amount} damage!`,
        );
      } else {
        this.addLog(`  ⚔️ Strikes ${eff.target.name} for ${eff.amount} damage.`);
      }

      if (status && ability.powerMultiplier !== 0) {
        this.addLog(`  ✨ ${eff.target.name}: ${status}.`);
      }

      if (eff.crash) {
        this.addLog(`  💥 ${eff.target.name} is slammed back for ${eff.crash} more damage.`);
      } else if (eff.pushed) {
        this.addLog(`  ↩️ ${eff.target.name} is knocked back.`);
      }

      if (eff.wasDefeated) {
        this.addLog(`  💀 ${eff.target.name} has fallen!`);
      }
    }
  }

  public endCurrentTurn(automated = false): void {
    if (this.suspended || this.battleStatus() !== 'active') return;
    if (!automated && !this.canAct(false)) return;
    this.clearScheduledActions();
    const unit = this.activeUnit();
    if (unit) {
      const guard = unit.enterGuard();
      if (guard > 0) this.addLog(`🛡️ ${unit.name} converts remaining AP into ${guard} Guard.`);
      unit.actionGauge.exhaust();
      const poison = unit.tickStatusEffects();
      if (poison > 0) {
        this.addLog(`☠️ ${unit.name} took ${poison} poison damage!`);
        this.triggerFloatingText(unit.id, `-${poison} POISON`, false, false);
      }
      this.addLog(`🛑 ${unit.name} finished their turn.`);
    }
    this.units.update((list) => [...list]);

    this.checkBattleStatus();
    if (this.battleStatus() !== 'active') return;

    this.advanceTurn();
  }

  private advanceTurn(): void {
    const next = this.turnManager.advance();
    if (this.turnManager.isRoundComplete || !next) {
      // Start new round
      this.roundNumber.update((r) => r + 1);
      this.addLog(`🔄 === ROUND ${this.roundNumber()} ===`);

      this.turnManager.startNewRound(this.units());
      this.startTurnForUnit(this.turnManager.current);
    } else {
      this.startTurnForUnit(next);
    }
  }

  // Both teams use the same rules; keep decisions deterministic for future defense scripts.
  private triggerAiTurn(): void {
    this.isAiThinking.set(this.activeUnit()?.team === 'enemy');
    this.scheduleTurnAction(() => {
      const unit = this.activeUnit();
      if (!unit || !this.canAct(true)) return;
      if (unit.team === 'enemy' && this.tryDefenseOrder(unit)) return;
      if (this.tryLethalAssist(unit)) {
        this.isAiThinking.set(false);
        if (this.battleStatus() === 'active') this.triggerAiTurn();
        return;
      }
      const allies = this.units().filter((u) => u.team === unit.team && u.isAlive && !u.isObject);
      const enemies = this.units().filter((u) => u.team !== unit.team && u.isAlive && !u.isObject);
      const heal = unit.abilities.find(
        (a) =>
          a.damageType === 'healing' &&
          a.powerMultiplier > 0 &&
          a.actionCost <= unit.actionGauge.current,
      );
      const wounded = allies
        .filter((u) => u.currentHp < u.maxHp * 0.75)
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
      let executed = false;
      if (heal && wounded) {
        this.selectedAbilityId.set(heal.id);
        executed = this.executeSelectedAbility(wounded, true);
      }
      // A barricade or trap where it will matter; the next pass fights on.
      const place = executed
        ? null
        : choosePlacement(unit, this.units(), this.traps(), this.hasPlaced(unit));
      if (place) {
        this.selectedAbilityId.set(place.id);
        executed = this.executeSelectedAbility(undefined, true);
      }
      // A buff first when it helps enough and still leaves AP to attack; the next pass attacks.
      const buff = !executed && enemies.length ? chooseBuff(unit, this.units()) : null;
      if (buff) {
        this.selectedAbilityId.set(buff.id);
        executed = this.executeSelectedAbility(undefined, true);
      }
      if (!executed && enemies.length) {
        const closest = [...enemies].sort(
          (a, b) =>
            Math.abs(a.lane - unit.lane) - Math.abs(b.lane - unit.lane) ||
            Math.abs(a.positionX - unit.positionX) - Math.abs(b.positionX - unit.positionX),
        )[0];
        if (!enemies.some((u) => u.lane === unit.lane)) {
          this.switchActiveUnitLane(unit.lane + Math.sign(closest.lane - unit.lane), true);
        }
        if (unit.classDef.archetype === 'melee') this.closeIn(unit);
        const choices = unit.abilities
          .filter(
            (a) =>
              a.damageType !== 'healing' &&
              a.actionCost <= unit.actionGauge.current &&
              a.target.includes('enem'),
          )
          .flatMap((ability) => {
            const targets = CombatExecutor.getValidTargets(unit, ability, this.units());
            const target = [...targets].sort(
              (a, b) =>
                Number(a.isObject) - Number(b.isObject) ||
                a.currentHp / a.maxHp - b.currentHp / b.maxHp,
            )[0];
            if (!target) return [];
            const area = ability.target === 'all-enemies' || ability.target === 'same-lane-enemies';
            let score = (area ? targets : [target]).reduce((sum, t) => {
              const damage = DamageCalculator.calculateWithDefense(unit, t, ability);
              // Breaking a barricade is worth less than hurting a fighter.
              if (t.isObject) return sum + Math.min(t.currentHp, damage) * 0.4;
              // What the skill leaves behind (a stun, poison, a debuff) counts as well.
              return (
                sum +
                Math.min(t.currentHp + t.guardPoints, damage) +
                statusValue(ability, t, damage)
              );
            }, 0);
            if (ability.friendlyFire) {
              score -= allies
                .filter(
                  (a) =>
                    a.id !== unit.id && (ability.target === 'all-enemies' || a.lane === unit.lane),
                )
                .reduce(
                  (sum, a) =>
                    sum +
                    Math.min(
                      a.currentHp + a.guardPoints,
                      DamageCalculator.calculateWithDefense(unit, a, ability),
                    ),
                  0,
                );
            }
            return [{ ability, target, score }];
          })
          .sort((a, b) => b.score - a.score || a.ability.actionCost - b.ability.actionCost);
        const choice = choices.find((c) => c.score > 0);
        if (choice) {
          this.selectedAbilityId.set(choice.ability.id);
          executed = this.executeSelectedAbility(choice.target, true);
        }
      }
      this.isAiThinking.set(false);
      // Every successful skill spends AP. Continue the combo to break Guard instead of
      // preserving a fresh shield forever in low-damage mirror matches.
      if (executed && this.battleStatus() === 'active') this.triggerAiTurn();
      else this.scheduleTurnAction(() => this.endCurrentTurn(true), 600);
    }, 600);
  }

  /**
   * Walks a melee unit along its lane until the nearest enemy there is within reach,
   * as far as its Move Gauge allows. Lane-mates in the way stop it short.
   */
  private closeIn(unit: UnitInstance): void {
    const foes = this.units().filter(
      (u) => u.isAlive && !u.isObject && u.team !== unit.team && u.lane === unit.lane,
    );
    if (!foes.length) return;
    const nearest = foes.reduce((a, b) =>
      Math.abs(b.positionX - unit.positionX) < Math.abs(a.positionX - unit.positionX) ? b : a,
    );
    const gap = Math.abs(nearest.positionX - unit.positionX) - meleeReach(unit) + 0.01;
    if (gap <= 0) return;
    // Spend at most what is left, a hair under, since the gauge must cover the whole step.
    const affordable = unit.moveGauge.current / MOVE_COST_PER_FIELD - 0.001;
    // Stop short of an enemy trap rather than walk onto it.
    const dir = Math.sign(nearest.positionX - unit.positionX);
    const trapAhead = this.traps()
      .filter((t) => t.team !== unit.team && t.lane === unit.lane)
      .map((t) => (t.x - unit.positionX) * dir)
      .filter((ahead) => ahead > 0)
      .sort((a, b) => a - b)[0];
    const safe = trapAhead === undefined ? Infinity : trapAhead - 0.04;
    const step = Math.min(gap, affordable, safe);
    if (step > 0.002) {
      this.moveActiveUnit(Math.sign(nearest.positionX - unit.positionX) * step, true);
    }
  }

  /** The AI spends an orb only when an ally's pursuit would defeat its target outright. */
  private tryLethalAssist(unit: UnitInstance): boolean {
    if (this.assistGauge()[unit.team] < ASSIST_COST) return false;
    const lethal = assistCandidates(unit, this.units()).find(
      ({ ally, ability, targets }) =>
        ability.target.startsWith('single-') &&
        DamageCalculator.calculateWithDefense(ally, targets[0], ability) >=
          targets[0].currentHp + targets[0].guardPoints,
    );
    return !!lethal && this.callAssist(lethal.ally.id, true);
  }

  private tryDefenseOrder(unit: UnitInstance): boolean {
    const turn = this.defenseTurns.get(unit.id) ?? 0;
    if (this.attemptedDefenseTurns.get(unit.id) === turn) return false;
    this.attemptedDefenseTurns.set(unit.id, turn);
    const order = this.defenseOrders.get(unit.id)?.[turn - 1];
    if (!order) return false;
    if (order.abilityId === 'auto') return false;
    if (order.abilityId === 'guard') {
      this.addLog(`📜 ${unit.name} follows turn ${turn} order: Guard.`);
      this.scheduleTurnAction(() => this.endCurrentTurn(true), 400);
      return true;
    }
    const ability = unit.abilities.find((candidate) => candidate.id === order.abilityId);
    // A scripted melee order walks into reach first, as a player would.
    if (ability && needsReach(unit, ability)) this.closeIn(unit);
    const target =
      ability && chooseDefenseTarget(unit, ability, this.units(), order.targetPriority);
    if (ability && target && unit.actionGauge.current >= ability.actionCost) {
      this.selectedAbilityId.set(ability.id);
      if (this.executeSelectedAbility(target, true)) {
        this.addLog(
          `📜 ${unit.name} follows turn ${turn} order: ${ability.name} (${order.targetPriority}).`,
        );
        if (this.battleStatus() === 'active')
          this.scheduleTurnAction(() => this.endCurrentTurn(true), 600);
        return true;
      }
    }
    this.addLog(`📜 ${unit.name}'s turn ${turn} order is unavailable; using role tactics.`);
    return false;
  }

  private canAct(automated: boolean): boolean {
    const unit = this.activeUnit();
    if (!unit || unit.isStunned || this.suspended || this.battleStatus() !== 'active') return false;
    // While the cursor sweeps, the only thing the player can do is fire.
    if (!automated && this.aim()) return false;
    return automated ? unit.team === 'enemy' || this.isAutoBattle() : this.canPlayerAct();
  }

  private scheduleTurnAction(action: () => void, delay: number): void {
    this.clearScheduledActions();
    if (this.suspended || this.battleStatus() !== 'active') return;
    const version = this.turnVersion;
    const activeId = this.activeUnitId();
    this.actionTimer = setTimeout(() => {
      this.actionTimer = null;
      if (
        this.suspended ||
        this.battleStatus() !== 'active' ||
        version !== this.turnVersion ||
        activeId !== this.activeUnitId()
      )
        return;
      action();
    }, delay * this.delayMultiplier);
  }

  public suspend(): void {
    this.suspended = true;
    this.clearScheduledActions();
    this.isAiThinking.set(false);
  }

  public resume(): void {
    this.suspended = false;
    this.queueActiveTurn();
  }

  private checkBattleStatus(): void {
    if (this.battleStatus() !== 'active') return;
    const fighting = this.units().filter((u) => u.isAlive && !u.isObject);
    const playerLiving = fighting.some((u) => u.team === 'player');
    const enemyLiving = fighting.some((u) => u.team === 'enemy');

    if (!playerLiving) {
      this.battleStatus.set('defeat');
      this.addLog('💀 DEFEAT! Your vanguard has fallen.');
      this.clearScheduledActions();
      this.isAiThinking.set(false);
    } else if (!enemyLiving) {
      this.battleStatus.set('victory');
      this.addLog('🏆 VICTORY! All enemy battalions have been broken!');
      this.clearScheduledActions();
      this.isAiThinking.set(false);
    } else {
      return;
    }
    this.battleReport.set({
      id: `${Date.now().toString(36)}-${this.battleVersion}`,
      outcome: playerLiving ? 'victory' : 'defeat',
      rewardMultiplier: this.activeContract()?.rewardMultiplier ?? 1,
      ...(this.activeContract()?.missionId
        ? { missionId: this.activeContract()!.missionId }
        : { contractId: this.activeContract()?.id }),
      enemiesDefeated: this.units().filter((u) => u.team === 'enemy' && !u.isAlive && !u.isObject)
        .length,
      mercenaries: this.units().flatMap((unit) => {
        const id = this.mercenaryOf.get(unit.id);
        return id ? [{ id, survived: unit.isAlive }] : [];
      }),
    });
  }

  private triggerFloatingText(
    targetId: string,
    text: string,
    isHealing: boolean,
    isFriendlyFire: boolean,
    isGrade = false,
  ): void {
    const id = `ft_${Date.now()}_${Math.random()}`;
    const newEntry: FloatingText = { id, targetId, text, isHealing, isFriendlyFire, isGrade };
    this.floatingTexts.update((list) => [...list, newEntry]);

    setTimeout(() => {
      this.floatingTexts.update((list) => list.filter((item) => item.id !== id));
    }, 1800 * this.delayMultiplier);
  }

  private addLog(message: string): void {
    this.combatLogs.update((logs) => [message, ...logs.slice(0, 49)]);
  }

  private clearScheduledActions(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
    this.clearExecution();
  }

  /** Drops a pending aim (no AP spent) or an open combo window. */
  private clearExecution(): void {
    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = null;
    }
    this.aim.set(null);
    this.combo.set(null);
  }
}
