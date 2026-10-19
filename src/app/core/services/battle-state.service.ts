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

export const COLLISION_BUFFER = 0.08;
const FIELD_MIN_X = 0.05;
const FIELD_MAX_X = 0.95;
/** Move Gauge spent per full battlefield width travelled. */
const MOVE_COST_PER_FIELD = 50;
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

function readTimingPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(TIMING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export type BattleStatus = 'active' | 'victory' | 'defeat';
export type BattleSpeed = '1x' | '2x';

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

  // Auto-battle and combat animations
  public readonly isAutoBattle = signal<boolean>(false);
  public readonly autoBattleSpeed = signal<BattleSpeed>('1x');
  public readonly attackingUnitId = signal<string | null>(null);
  public readonly hitUnitId = signal<string | null>(null);
  public readonly lastAction = signal<BattleAction | null>(null);

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
    return unit.classDef.abilities.find((a) => a.id === abilityId) ?? null;
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
    return this.units().filter((u) => u.team === 'enemy');
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
    const activePlan =
      defensePlan ?? (!customPlayerSquad && !customEnemySquad ? this.practicePlan() : null);
    this.practicePlan.set(activePlan);
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
      newUnits.push(
        new UnitInstance(
          cls,
          merc ? merc.name : `Player ${cls.name}`,
          'player',
          lane,
          posX,
          100,
          undefined,
          merc ? deriveCombatStats(cls, merc) : undefined,
        ),
      );
    });

    enemySquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      let posX = isFront ? 0.68 : 0.86;
      if (newUnits.some((u) => u.team === 'enemy' && u.lane === lane && u.positionX === posX)) {
        posX = isFront ? 0.86 : 0.68;
      }
      // Defenders are the plan's mercenaries. Practice may pit a mercenary against itself.
      const merc = activePlan?.members[idx]?.mercenary;
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
      );
      newUnits.push(unit);
      if (activePlan) this.defenseOrders.set(unit.id, activePlan.members[idx].orders);
    });

    this.units.set(newUnits);
    this.turnManager.setOrder(newUnits);
    this.roundNumber.set(1);
    this.battleStatus.set('active');
    this.combatLogs.set([
      activePlan
        ? '⚔️ Local defense practice commenced. First four defender turns use saved orders.'
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

    unit.positionX = targetX;
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
    const sweepMs = aimSweepMs(ability);
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
    const ability = attacker.classDef.abilities.find((a) => a.id === abilityId);
    if (!ability || executionKind(attacker, ability) !== 'combo') return false;
    const grade = chainGrade(performance.now() - combo.openedAt, combo.speed);
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
    const canChain = attacker.classDef.abilities.some(
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

    const result = CombatExecutor.execute(attacker, ability, targets, this.units(), grade);
    if (!result.success) {
      this.addLog(`⚠️ ${result.failureReason}`);
      return false;
    }

    // Trigger attack sprite animation
    this.attackingUnitId.set(attacker.id);
    const version = this.battleVersion;
    setTimeout(() => {
      if (version === this.battleVersion) this.attackingUnitId.set(null);
    }, 350 * this.delayMultiplier);

    this.processCombatEffects(attacker, ability, result.effects, grade);
    this.lastAction.set({
      seq: ++this.actionSeq,
      attackerId: attacker.id,
      abilityId: ability.id,
      grade,
      effects: result.effects.map((effect) => ({
        targetId: effect.target.id,
        isHealing: effect.isHealing,
        guardAbsorbed: effect.guardAbsorbed,
        wasDefeated: effect.wasDefeated,
        isFriendlyFire: effect.isFriendlyFire,
        missed: effect.missed,
      })),
    });
    this.units.update((list) => [...list]);

    // Check end condition
    this.checkBattleStatus();

    // Reset selection
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    return true;
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
      const amountText = eff.statusApplied
        ? 'DEF +25'
        : eff.isHealing
          ? `+${eff.amount} HP`
          : eff.guardAbsorbed > 0
            ? `-${eff.amount} HP · ${eff.guardAbsorbed} blocked`
            : `-${eff.amount} HP`;
      const effectText =
        grade === 'critical'
          ? `CRIT ${amountText}`
          : grade === 'graze'
            ? `GRAZE ${amountText}`
            : amountText;

      // Trigger hit flash animation on damaged target
      if (!eff.isHealing) {
        this.hitUnitId.set(eff.target.id);
        const version = this.battleVersion;
        setTimeout(() => {
          if (version === this.battleVersion) this.hitUnitId.set(null);
        }, 350 * this.delayMultiplier);
      }

      this.triggerFloatingText(
        eff.target.id,
        effectText,
        eff.isHealing,
        eff.isFriendlyFire,
        grade === 'critical',
      );

      if (eff.guardAbsorbed > 0) {
        this.addLog(`  🛡️ ${eff.target.name}'s Guard absorbed ${eff.guardAbsorbed} damage.`);
      }
      if (eff.statusApplied) {
        this.addLog(`  🛡️ ${eff.target.name} raises Bulwark: +25 defense.`);
      } else if (eff.isHealing) {
        this.addLog(`  💚 Restores ${eff.amount} HP to ${eff.target.name}.`);
      } else if (eff.isFriendlyFire) {
        this.addLog(
          `  ⚠️ FRIENDLY FIRE! ${eff.target.name} caught in blast for ${eff.amount} damage!`,
        );
      } else {
        this.addLog(`  ⚔️ Strikes ${eff.target.name} for ${eff.amount} damage.`);
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
      const allies = this.units().filter((u) => u.team === unit.team && u.isAlive);
      const enemies = this.units().filter((u) => u.team !== unit.team && u.isAlive);
      const heal = unit.classDef.abilities.find(
        (a) => a.damageType === 'healing' && a.actionCost <= unit.actionGauge.current,
      );
      const wounded = allies
        .filter((u) => u.currentHp < u.maxHp * 0.75)
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
      let executed = false;
      if (heal && wounded) {
        this.selectedAbilityId.set(heal.id);
        executed = this.executeSelectedAbility(wounded, true);
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
        if (unit.classDef.archetype === 'melee') {
          this.moveActiveUnit(Math.sign(closest.positionX - unit.positionX) * 0.08, true);
        }
        const choices = unit.classDef.abilities
          .filter(
            (a) =>
              a.damageType !== 'healing' &&
              a.actionCost <= unit.actionGauge.current &&
              a.target.includes('enem'),
          )
          .flatMap((ability) => {
            const targets = CombatExecutor.getValidTargets(unit, ability, this.units());
            const target = [...targets].sort(
              (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp,
            )[0];
            if (!target) return [];
            const area = ability.target === 'all-enemies' || ability.target === 'same-lane-enemies';
            let score = (area ? targets : [target]).reduce(
              (sum, t) =>
                sum +
                Math.min(
                  t.currentHp + t.guardPoints,
                  DamageCalculator.calculateWithDefense(unit, t, ability),
                ),
              0,
            );
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
    const ability = unit.classDef.abilities.find((candidate) => candidate.id === order.abilityId);
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
    const playerLiving = this.units().some((u) => u.team === 'player' && u.isAlive);
    const enemyLiving = this.units().some((u) => u.team === 'enemy' && u.isAlive);

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
    }
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
