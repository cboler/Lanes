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

export interface FloatingText {
  id: string;
  targetId: string;
  text: string;
  isHealing: boolean;
  isFriendlyFire: boolean;
}

export type BattleStatus = 'active' | 'victory' | 'defeat';

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

  public initSkirmish(
    customPlayerSquad?: UnitClassDefinition[],
    customEnemySquad?: UnitClassDefinition[],
  ): void {
    const playerSquad = customPlayerSquad ?? [FIGHTER_CLASS, ARCHER_CLASS, CLERIC_CLASS];
    const enemySquad = customEnemySquad ?? [LANCER_CLASS, GUNNER_CLASS, WITCH_CLASS];

    const newUnits: UnitInstance[] = [];

    // Assign lanes 0, 1, 2 across the battlefield
    playerSquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const posX = 0.18 + idx * 0.06;
      newUnits.push(new UnitInstance(cls, `Player ${cls.name}`, 'player', lane, posX, 100));
    });

    enemySquad.forEach((cls, idx) => {
      const lane = idx % 3;
      const posX = 0.82 - idx * 0.06;
      newUnits.push(new UnitInstance(cls, `Enemy ${cls.name}`, 'enemy', lane, posX, 100));
    });

    this.units.set(newUnits);
    this.turnManager.setOrder(newUnits);
    this.roundNumber.set(1);
    this.battleStatus.set('active');
    this.combatLogs.set([
      '⚔️ Battle started! 3-lane tactical combat underway.',
      'Control your active unit using movement, lane shifting, and class abilities.',
    ]);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.startTurnForUnit(this.turnManager.current);
  }

  private startTurnForUnit(unit: UnitInstance | null): void {
    if (!unit || !unit.isAlive) {
      this.advanceTurn();
      return;
    }

    this.activeUnitId.set(unit.id);
    this.selectedAbilityId.set(null);
    this.targetedUnitId.set(null);

    this.addLog(
      `⭐ Turn started: ${unit.name} (${unit.team.toUpperCase()}) in Lane ${unit.lane + 1}`,
    );

    // Check if unit is stunned
    if (unit.isStunned) {
      this.addLog(`⚡ ${unit.name} is stunned and skips their turn!`);
      setTimeout(() => this.endCurrentTurn(), 1000);
      return;
    }

    if (unit.team === 'enemy') {
      this.triggerAiTurn();
    }
  }

  public moveActiveUnit(deltaX: number): boolean {
    const unit = this.activeUnit();
    if (!unit || unit.team !== 'player') return false;

    const moveCost = Math.abs(deltaX) * 50; // gauge cost per distance
    if (!unit.actionGauge.trySpend(moveCost)) {
      this.addLog(`⚠️ Insufficient action gauge to move.`);
      return false;
    }

    const minX = 0.05;
    const maxX = 0.95;
    unit.positionX = Math.max(minX, Math.min(maxX, unit.positionX + deltaX));
    this.units.update((list) => [...list]);
    return true;
  }

  public switchActiveUnitLane(targetLane: number): boolean {
    const unit = this.activeUnit();
    if (!unit || unit.team !== 'player') return false;

    const oldLane = unit.lane;
    const success = LaneSwitcher.trySwitchLane(unit, targetLane);
    if (success) {
      this.addLog(`↕️ ${unit.name} shifted from Lane ${oldLane + 1} to Lane ${targetLane + 1}.`);
      this.units.update((list) => [...list]);
      // Recompute valid targets if ability was selected
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
    this.addLog(`💥 ${attacker.name} used [${ability.name}]!`);

    for (const eff of effects) {
      const effectText = eff.isHealing ? `+${eff.amount} HP` : `-${eff.amount} DMG`;

      this.triggerFloatingText(eff.target.id, effectText, eff.isHealing, eff.isFriendlyFire);

      if (eff.isHealing) {
        this.addLog(`  💚 Heals ${eff.target.name} for ${eff.amount} HP.`);
      } else if (eff.isFriendlyFire) {
        this.addLog(
          `  ⚠️ FRIENDLY FIRE! ${eff.target.name} caught in blast for ${eff.amount} damage!`,
        );
      } else {
        this.addLog(`  ⚔️ Deals ${eff.amount} damage to ${eff.target.name}.`);
      }

      if (eff.wasDefeated) {
        this.addLog(`  💀 ${eff.target.name} has been defeated!`);
      }
    }
  }

  public endCurrentTurn(): void {
    const unit = this.activeUnit();
    if (unit) {
      unit.actionGauge.exhaust();
      const poison = unit.tickStatusEffects();
      if (poison > 0) {
        this.addLog(`☠️ ${unit.name} suffered ${poison} poison damage!`);
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
      this.addLog(`🔄 --- ROUND ${this.roundNumber()} ---`);

      // Reset gauges for all living units
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

  private triggerAiTurn(): void {
    this.isAiThinking.set(true);

    setTimeout(() => {
      const enemy = this.activeUnit();
      if (!enemy || enemy.team !== 'enemy' || !enemy.isAlive) {
        this.isAiThinking.set(false);
        return;
      }

      // 1. Tactical AI logic:
      // Try abilities in order of preference
      let executed = false;

      // Check if enemy has a healing ability and wounded ally
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

      // If didn't heal, try attacks
      if (!executed) {
        // Find best offensive ability enemy can afford
        const attackAbilities = enemy.classDef.abilities
          .filter((a) => a.damageType !== 'healing' && enemy.actionGauge.current >= a.actionCost)
          .sort((a, b) => b.actionCost - a.actionCost);

        for (const ability of attackAbilities) {
          this.selectedAbilityId.set(ability.id);
          const targets = this.validTargets();

          if (targets.length > 0) {
            // Pick lowest HP target
            const target = targets.sort((a, b) => a.currentHp - b.currentHp)[0];
            this.executeSelectedAbility(target);
            executed = true;
            break;
          }
        }
      }

      // If no target in current lane, try shifting lane towards nearest player unit
      if (!executed && enemy.actionGauge.current >= 15) {
        const livingPlayer = this.units().filter((u) => u.team === 'player' && u.isAlive);
        if (livingPlayer.length > 0) {
          const targetLane = livingPlayer[0].lane;
          if (targetLane !== enemy.lane) {
            const laneDiff = targetLane > enemy.lane ? enemy.lane + 1 : enemy.lane - 1;
            LaneSwitcher.trySwitchLane(enemy, laneDiff);
            this.addLog(`🤖 ${enemy.name} shifted to Lane ${laneDiff + 1} to track player.`);
            this.units.update((list) => [...list]);

            // Try attacking after lane shift
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

      this.isAiThinking.set(false);

      // Finish enemy turn
      setTimeout(() => {
        this.endCurrentTurn();
      }, 700);
    }, 900);
  }

  private checkBattleStatus(): void {
    const playerLiving = this.units().some((u) => u.team === 'player' && u.isAlive);
    const enemyLiving = this.units().some((u) => u.team === 'enemy' && u.isAlive);

    if (!playerLiving) {
      this.battleStatus.set('defeat');
      this.addLog('💀 DEFEAT! Your squad has fallen in combat.');
    } else if (!enemyLiving) {
      this.battleStatus.set('victory');
      this.addLog('🏆 VICTORY! All enemy forces have been vanquished!');
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
    }, 1800);
  }

  private addLog(message: string): void {
    this.combatLogs.update((logs) => [message, ...logs.slice(0, 49)]);
  }
}
