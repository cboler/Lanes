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

export const COLLISION_BUFFER = 0.08;

export interface FloatingText {
  id: string;
  targetId: string;
  text: string;
  isHealing: boolean;
  isFriendlyFire: boolean;
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

  // Auto-battle and combat animations
  public readonly isAutoBattle = signal<boolean>(false);
  public readonly autoBattleSpeed = signal<BattleSpeed>('1x');
  public readonly attackingUnitId = signal<string | null>(null);
  public readonly hitUnitId = signal<string | null>(null);

  private actionTimer: ReturnType<typeof setTimeout> | null = null;
  private turnVersion = 0;
  private battleVersion = 0;
  private suspended = false;
  private playerSquad = [FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS, LANCER_CLASS];
  private enemySquad = [LANCER_CLASS, GUNNER_CLASS, WITCH_CLASS, FIGHTER_CLASS];

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
  ): void {
    const playerSquad = customPlayerSquad ?? this.playerSquad;
    const enemySquad = customEnemySquad ?? this.enemySquad;
    if (![playerSquad, enemySquad].every((squad) => squad.length >= 1 && squad.length <= 4)) {
      throw new Error('Each squad must contain between one and four mercenaries.');
    }
    this.clearScheduledActions();
    this.playerSquad = [...playerSquad];
    this.enemySquad = [...enemySquad];
    this.battleVersion++;
    this.turnVersion++;
    this.suspended = false;
    this.turnManager = new TurnManager();
    this.isAutoBattle.set(false);
    this.isAiThinking.set(false);
    this.floatingTexts.set([]);
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
      newUnits.push(new UnitInstance(cls, `Player ${cls.name}`, 'player', lane, posX, 100));
    });

    enemySquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      let posX = isFront ? 0.68 : 0.86;
      if (newUnits.some((u) => u.team === 'enemy' && u.lane === lane && u.positionX === posX)) {
        posX = isFront ? 0.86 : 0.68;
      }
      newUnits.push(new UnitInstance(cls, `Enemy ${cls.name}`, 'enemy', lane, posX, 100));
    });

    this.units.set(newUnits);
    this.turnManager.setOrder(newUnits);
    this.roundNumber.set(1);
    this.battleStatus.set('active');
    this.combatLogs.set([
      '⚔️ Battle commenced! Frontline warriors hold the vanguard.',
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

  public moveActiveUnit(deltaX: number, automated = false): boolean {
    const unit = this.activeUnit();
    if (!unit || !this.canAct(automated) || !Number.isFinite(deltaX)) return false;

    const minX = 0.05;
    const maxX = 0.95;

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

    const moveCost = Math.round(actualDist * 5000) / 100;
    if (!unit.moveGauge.trySpend(moveCost)) {
      this.addLog(`⚠️ Insufficient Move Gauge to move.`);
      return false;
    }

    unit.positionX = targetX;
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
    this.selectedAbilityId.set(abilityId);
    this.targetedUnitId.set(this.validTargets()[0]?.id ?? null);
  }

  public executeSelectedAbility(targetOverride?: UnitInstance, automated = false): boolean {
    const attacker = this.activeUnit();
    const ability = this.selectedAbility();
    if (!attacker || !ability || !this.canAct(automated)) return false;

    let targets: UnitInstance[];

    if (ability.target === 'all-enemies' || ability.target === 'all-allies') {
      targets = this.validTargets();
    } else if (ability.target === 'same-lane-enemies') {
      targets = this.validTargets();
    } else {
      const target = targetOverride ?? this.units().find((u) => u.id === this.targetedUnitId());
      if (!target || !this.validTargets().some((t) => t.id === target.id)) {
        this.addLog(`⚠️ Select a valid target in range for ${ability.name}.`);
        return false;
      }
      targets = [target];
    }

    const result = CombatExecutor.execute(attacker, ability, targets, this.units());
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

    this.processCombatEffects(attacker, ability, result.effects);
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
  ): void {
    this.addLog(`💥 ${attacker.name} unleashed [${ability.name}]!`);

    for (const eff of effects) {
      const effectText = eff.statusApplied
        ? 'DEF +25'
        : eff.isHealing
          ? `+${eff.amount} HP`
          : eff.guardAbsorbed > 0
            ? `-${eff.amount} HP · ${eff.guardAbsorbed} blocked`
            : `-${eff.amount} HP`;

      // Trigger hit flash animation on damaged target
      if (!eff.isHealing) {
        this.hitUnitId.set(eff.target.id);
        const version = this.battleVersion;
        setTimeout(() => {
          if (version === this.battleVersion) this.hitUnitId.set(null);
        }, 350 * this.delayMultiplier);
      }

      this.triggerFloatingText(eff.target.id, effectText, eff.isHealing, eff.isFriendlyFire);

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

  private canAct(automated: boolean): boolean {
    const unit = this.activeUnit();
    if (!unit || unit.isStunned || this.suspended || this.battleStatus() !== 'active') return false;
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
  ): void {
    const id = `ft_${Date.now()}_${Math.random()}`;
    const newEntry: FloatingText = { id, targetId, text, isHealing, isFriendlyFire };
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
  }
}
