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
  private readonly turnManager = new TurnManager();

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

  public readonly activeUnit = computed(() => {
    const id = this.activeUnitId();
    return this.units().find((u) => u.id === id && u.isAlive) ?? null;
  });

  public readonly turnOrder = computed(() => {
    return this.turnManager.order.filter((u) => u.isAlive);
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
    this.clearScheduledActions();

    const playerSquad = customPlayerSquad ?? [FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS];
    const enemySquad = customEnemySquad ?? [LANCER_CLASS, GUNNER_CLASS, WITCH_CLASS];

    const newUnits: UnitInstance[] = [];

    // Grand Kingdom Vanguard Formations:
    // Frontline fighters (Tank: Fighter, Melee: Lancer) are positioned up front.
    // Backline units (Support: Cleric, Ranged: Archer, Witch, Gunner) are positioned in the rear.
    // Player: Frontline at X=0.32, Rear at X=0.14
    // Enemy: Frontline at X=0.68, Rear at X=0.86
    playerSquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      const posX = isFront ? 0.32 : 0.14;
      newUnits.push(new UnitInstance(cls, `Player ${cls.name}`, 'player', lane, posX, 100));
    });

    enemySquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const isFront = cls.role === 'tank' || cls.role === 'melee';
      const posX = isFront ? 0.68 : 0.86;
      newUnits.push(new UnitInstance(cls, `Enemy ${cls.name}`, 'enemy', lane, posX, 100));
    });

    this.units.set(newUnits);
    this.turnManager.setOrder(newUnits);
    this.roundNumber.set(1);
    this.battleStatus.set('active');
    this.combatLogs.set([
      '⚔️ Battle commenced! Frontline warriors hold the vanguard.',
      'Control units manually or toggle Auto-Battle to let tactical AI resolve combat.',
    ]);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.startTurnForUnit(this.turnManager.current);
  }

  public toggleAutoBattle(): void {
    const next = !this.isAutoBattle();
    this.isAutoBattle.set(next);
    this.addLog(next ? '⚡ Auto-Battle: ENGAGED' : '⏸️ Auto-Battle: PAUSED');

    const active = this.activeUnit();
    if (next && active && active.team === 'player' && this.battleStatus() === 'active') {
      this.triggerPlayerAiTurn();
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

    this.activeUnitId.set(unit.id);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.addLog(`⭐ Turn: ${unit.name} (${unit.team.toUpperCase()}) [Lane ${unit.lane + 1}]`);

    // Check if unit is stunned
    if (unit.isStunned) {
      this.addLog(`⚡ ${unit.name} is stunned and forfeits their turn!`);
      const delay = 800 * this.delayMultiplier;
      this.actionTimer = setTimeout(() => this.endCurrentTurn(), delay);
      return;
    }

    if (unit.team === 'enemy') {
      this.triggerAiTurn();
    } else if (this.isAutoBattle()) {
      this.triggerPlayerAiTurn();
    }
  }

  public moveActiveUnit(deltaX: number): boolean {
    const unit = this.activeUnit();
    if (!unit) return false;

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

    const moveCost = actualDist * 50;
    if (!unit.actionGauge.trySpend(moveCost)) {
      this.addLog(`⚠️ Insufficient action gauge to move.`);
      return false;
    }

    unit.positionX = targetX;
    this.units.update((list) => [...list]);
    return true;
  }

  public switchActiveUnitLane(targetLane: number): boolean {
    const unit = this.activeUnit();
    if (!unit) return false;

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
    this.selectedAbilityId.set(abilityId);
    this.targetedUnitId.set(null);
  }

  public executeSelectedAbility(targetOverride?: UnitInstance): boolean {
    const attacker = this.activeUnit();
    const ability = this.selectedAbility();
    if (!attacker || !ability) return false;

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
    setTimeout(() => this.attackingUnitId.set(null), 350 * this.delayMultiplier);

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
      const effectText = eff.isHealing ? `+${eff.amount} HP` : `-${eff.amount} DMG`;

      // Trigger hit flash animation on damaged target
      if (!eff.isHealing) {
        this.hitUnitId.set(eff.target.id);
        setTimeout(() => this.hitUnitId.set(null), 350 * this.delayMultiplier);
      }

      this.triggerFloatingText(eff.target.id, effectText, eff.isHealing, eff.isFriendlyFire);

      if (eff.isHealing) {
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

  public endCurrentTurn(): void {
    const unit = this.activeUnit();
    if (unit) {
      unit.actionGauge.exhaust();
      const poison = unit.tickStatusEffects();
      if (poison > 0) {
        this.addLog(`☠️ ${unit.name} took ${poison} poison damage!`);
        this.triggerFloatingText(unit.id, `-${poison} POISON`, false, false);
      }
      this.addLog(`🛑 ${unit.name} finished their turn.`);
    }

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

      // Reset gauges for living units
      for (const u of this.units()) {
        if (u.isAlive) {
          u.actionGauge.reset();
        }
      }

      this.turnManager.startNewRound(this.units());
      this.startTurnForUnit(this.turnManager.current);
    } else {
      this.startTurnForUnit(next);
    }
  }

  private triggerPlayerAiTurn(): void {
    if (!this.isAutoBattle() || this.battleStatus() !== 'active') return;

    const delay = (ms: number) => ms * this.delayMultiplier;

    this.actionTimer = setTimeout(() => {
      const hero = this.activeUnit();
      if (!hero || hero.team !== 'player' || !hero.isAlive || !this.isAutoBattle()) return;

      // 1. Cleric healing priority
      const healAbility = hero.classDef.abilities.find((a) => a.damageType === 'healing');
      if (healAbility && hero.actionGauge.current >= healAbility.actionCost) {
        const woundedAlly = this.units()
          .filter((u) => u.team === 'player' && u.isAlive && u.currentHp < u.maxHp * 0.75)
          .sort((a, b) => a.currentHp - b.currentHp)[0];
        if (woundedAlly) {
          this.selectedAbilityId.set(healAbility.id);
          this.executeSelectedAbility(woundedAlly);
          this.actionTimer = setTimeout(() => this.endCurrentTurn(), delay(600));
          return;
        }
      }

      // 2. Melee vanguard advance
      if (
        (hero.classDef.role === 'tank' || hero.classDef.role === 'melee') &&
        hero.actionGauge.current > 35
      ) {
        const enemiesInLane = this.units().filter(
          (u) => u.team === 'enemy' && u.isAlive && u.lane === hero.lane,
        );
        if (enemiesInLane.length > 0) {
          this.moveActiveUnit(0.08);
        } else {
          // No enemy in current lane, shift towards lane with living enemies
          const livingEnemies = this.units().filter((u) => u.team === 'enemy' && u.isAlive);
          if (livingEnemies.length > 0 && hero.actionGauge.current >= 20) {
            const targetLane = livingEnemies[0].lane;
            const diff = targetLane > hero.lane ? hero.lane + 1 : hero.lane - 1;
            this.switchActiveUnitLane(diff);
          }
        }
      }

      // 3. Attack with best affordable offensive ability
      const attackAbilities = hero.classDef.abilities
        .filter((a) => a.damageType !== 'healing' && hero.actionGauge.current >= a.actionCost)
        .sort((a, b) => b.actionCost - a.actionCost);

      for (const ability of attackAbilities) {
        this.selectedAbilityId.set(ability.id);
        const targets = this.validTargets();
        if (targets.length > 0) {
          const target = targets.sort((a, b) => a.currentHp - b.currentHp)[0];
          this.executeSelectedAbility(target);
          break;
        }
      }

      // 4. Defensive buffs if remaining AP allows
      if (hero.classDef.role === 'tank' && hero.actionGauge.current >= 30) {
        const bulwark = hero.classDef.abilities.find((a) => a.id === 'bulwark');
        if (bulwark) {
          this.selectedAbilityId.set(bulwark.id);
          this.executeSelectedAbility(hero);
        }
      }

      // Complete turn
      this.actionTimer = setTimeout(() => {
        if (this.isAutoBattle()) {
          this.endCurrentTurn();
        }
      }, delay(600));
    }, delay(600));
  }

  private triggerAiTurn(): void {
    this.isAiThinking.set(true);
    const delay = (ms: number) => ms * this.delayMultiplier;

    this.actionTimer = setTimeout(() => {
      const enemy = this.activeUnit();
      if (!enemy || enemy.team !== 'enemy' || !enemy.isAlive) {
        this.isAiThinking.set(false);
        return;
      }

      let executed = false;

      // Check if enemy has healing and wounded ally
      const healAbility = enemy.classDef.abilities.find((a) => a.damageType === 'healing');
      if (healAbility && enemy.actionGauge.current >= healAbility.actionCost) {
        const woundedAlly = this.units()
          .filter((u) => u.team === 'enemy' && u.isAlive && u.currentHp < u.maxHp * 0.7)
          .sort((a, b) => a.currentHp - b.currentHp)[0];

        if (woundedAlly) {
          this.selectedAbilityId.set(healAbility.id);
          this.executeSelectedAbility(woundedAlly);
          executed = true;
        }
      }

      // Melee frontline closing distance
      if (
        !executed &&
        (enemy.classDef.role === 'melee' || enemy.classDef.role === 'tank') &&
        enemy.actionGauge.current > 35
      ) {
        const playersInLane = this.units().filter(
          (u) => u.team === 'player' && u.isAlive && u.lane === enemy.lane,
        );
        if (playersInLane.length > 0) {
          this.moveActiveUnit(-0.08);
        }
      }

      // Offensive ability
      if (!executed) {
        const attackAbilities = enemy.classDef.abilities
          .filter((a) => a.damageType !== 'healing' && enemy.actionGauge.current >= a.actionCost)
          .sort((a, b) => b.actionCost - a.actionCost);

        for (const ability of attackAbilities) {
          this.selectedAbilityId.set(ability.id);
          const targets = this.validTargets();

          if (targets.length > 0) {
            const target = targets.sort((a, b) => a.currentHp - b.currentHp)[0];
            this.executeSelectedAbility(target);
            executed = true;
            break;
          }
        }
      }

      // Lane shift towards living player if needed
      if (!executed && enemy.actionGauge.current >= 15) {
        const livingPlayer = this.units().filter((u) => u.team === 'player' && u.isAlive);
        if (livingPlayer.length > 0) {
          const targetLane = livingPlayer[0].lane;
          if (targetLane !== enemy.lane) {
            const laneDiff = targetLane > enemy.lane ? enemy.lane + 1 : enemy.lane - 1;
            const shifted = this.switchActiveUnitLane(laneDiff);
            if (shifted) {
              const affordable = enemy.classDef.abilities.find(
                (a) => a.damageType !== 'healing' && enemy.actionGauge.current >= a.actionCost,
              );
              if (affordable) {
                this.selectedAbilityId.set(affordable.id);
                const targets = this.validTargets();
                if (targets.length > 0) {
                  this.executeSelectedAbility(targets[0]);
                }
              }
            }
          }
        }
      }

      this.isAiThinking.set(false);

      this.actionTimer = setTimeout(() => {
        this.endCurrentTurn();
      }, delay(600));
    }, delay(600));
  }

  private checkBattleStatus(): void {
    const playerLiving = this.units().some((u) => u.team === 'player' && u.isAlive);
    const enemyLiving = this.units().some((u) => u.team === 'enemy' && u.isAlive);

    if (!playerLiving) {
      this.battleStatus.set('defeat');
      this.addLog('💀 DEFEAT! Your vanguard has fallen.');
      this.clearScheduledActions();
    } else if (!enemyLiving) {
      this.battleStatus.set('victory');
      this.addLog('🏆 VICTORY! All enemy battalions have been broken!');
      this.clearScheduledActions();
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
