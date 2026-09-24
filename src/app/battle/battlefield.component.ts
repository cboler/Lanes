import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BattleStateService, FloatingText } from '../core/services/battle-state.service';
import { UnitInstance } from '../core/models/unit-instance.model';
import { AbilityDefinition } from '../core/models/ability.model';
import { UnitSpriteComponent } from './unit-sprite.component';
import { ArenaSceneComponent } from './arena-scene.component';
import { GamepadService } from '../core/services/gamepad.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DamageCalculator } from '../core/engine/damage-calculator';

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [CommonModule, RouterLink, UnitSpriteComponent, ArenaSceneComponent],
  templateUrl: './battlefield.component.html',
  styleUrl: './battlefield.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlefieldComponent implements OnInit, OnDestroy {
  protected readonly battle = inject(BattleStateService);
  protected readonly isLogOpen = signal(false);
  protected readonly lanes = [0, 1, 2];

  constructor() {
    inject(GamepadService)
      .actions.pipe(takeUntilDestroyed())
      .subscribe((action) => {
        if (!this.battle.canPlayerAct()) return;
        const unit = this.battle.activeUnit()!;
        switch (action) {
          case 'cancel':
            this.cancelSelection();
            break;
          case 'previous-ability':
            this.cycleAbility(-1);
            break;
          case 'next-ability':
            this.cycleAbility(1);
            break;
          case 'move-left':
            this.battle.moveActiveUnit(-0.04);
            break;
          case 'move-right':
            this.battle.moveActiveUnit(0.04);
            break;
          case 'move-up':
            this.battle.switchActiveUnitLane(unit.lane - 1);
            break;
          case 'move-down':
            this.battle.switchActiveUnitLane(unit.lane + 1);
            break;
        }
      });
  }

  public ngOnInit(): void {
    if (this.battle.units().length === 0) {
      this.battle.initSkirmish();
    } else {
      this.battle.resume();
    }
  }

  public ngOnDestroy(): void {
    this.battle.suspend();
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    // Ignore input if in form field or modal
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    const active = this.battle.activeUnit();
    if (!active || !this.battle.canPlayerAct()) {
      return;
    }

    // Native controls own Enter/Space; handling them again here would double-cast.
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      event.target instanceof HTMLElement &&
      event.target.closest('button, a, [role="button"]')
    )
      return;

    if (this.battle.selectedAbility() && event.key.startsWith('Arrow')) {
      const targets = this.battle.validTargets();
      const index = targets.findIndex((target) => target.id === this.battle.targetedUnitId());
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const target = targets[(index + step + targets.length) % targets.length];
      if (target) {
        this.battle.targetedUnitId.set(target.id);
        document.getElementById(`unit-${target.id}`)?.focus();
      }
      event.preventDefault();
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        this.battle.moveActiveUnit(-0.04);
        event.preventDefault();
        break;
      case 'd':
      case 'arrowright':
        this.battle.moveActiveUnit(0.04);
        event.preventDefault();
        break;
      case 'w':
      case 'arrowup':
        if (active.lane > 0) {
          this.battle.switchActiveUnitLane(active.lane - 1);
          event.preventDefault();
        }
        break;
      case 's':
      case 'arrowdown':
        if (active.lane < 2) {
          this.battle.switchActiveUnitLane(active.lane + 1);
          event.preventDefault();
        }
        break;
      case '1':
        if (active.classDef.abilities[0]) {
          this.onSelectAbility(active.classDef.abilities[0]);
        }
        break;
      case '2':
        if (active.classDef.abilities[1]) {
          this.onSelectAbility(active.classDef.abilities[1]);
        }
        break;
      case '3':
        if (active.classDef.abilities[2]) {
          this.onSelectAbility(active.classDef.abilities[2]);
        }
        break;
      case ' ':
      case 'enter':
        if (this.battle.selectedAbility()) {
          this.battle.executeSelectedAbility();
          event.preventDefault();
        }
        break;
      case 'e':
        this.battle.endCurrentTurn();
        event.preventDefault();
        break;
      case 'escape':
        this.cancelSelection();
        event.preventDefault();
        break;
    }
  }

  protected getUnitsInLane(lane: number): UnitInstance[] {
    return this.battle.units().filter((u) => u.lane === lane && u.isAlive);
  }

  protected getFloatingTextsFor(unitId: string): FloatingText[] {
    return this.battle.floatingTexts().filter((t) => t.targetId === unitId);
  }

  protected onSelectAbility(ability: AbilityDefinition): void {
    if (!this.battle.canPlayerAct()) return;
    if (this.battle.selectedAbilityId() === ability.id) {
      this.battle.selectAbility(null);
    } else {
      this.battle.selectAbility(ability.id);
      const target = this.battle.validTargets()[0];
      if (target) document.getElementById(`unit-${target.id}`)?.focus();
    }
  }

  protected onUnitClick(unit: UnitInstance): void {
    if (!this.battle.canPlayerAct()) return;
    const selectedAbility = this.battle.selectedAbility();
    if (!selectedAbility) return;

    const isValid = this.battle.validTargets().some((t) => t.id === unit.id);
    if (isValid) {
      this.battle.executeSelectedAbility(unit);
    }
  }

  protected isTargetable(unit: UnitInstance): boolean {
    return this.battle.canPlayerAct() && this.battle.validTargets().some((t) => t.id === unit.id);
  }

  protected hasAdvantage(unit: UnitInstance): boolean {
    const active = this.battle.activeUnit();
    return !!active && this.isTargetable(unit) && DamageCalculator.hasAdvantage(active, unit);
  }

  protected friendlyFireTargets(): UnitInstance[] {
    const active = this.battle.activeUnit();
    const ability = this.battle.selectedAbility();
    if (!active || !ability?.friendlyFire) return [];
    return this.battle
      .units()
      .filter(
        (unit) =>
          unit.isAlive &&
          unit.team === active.team &&
          unit.id !== active.id &&
          (ability.target === 'all-enemies' || unit.lane === active.lane),
      );
  }

  protected cancelSelection(): void {
    const id = this.battle.selectedAbilityId();
    this.battle.selectAbility(null);
    if (id) document.getElementById(`ability-btn-${id}`)?.focus();
  }

  private cycleAbility(direction: number): void {
    const unit = this.battle.activeUnit()!;
    const choices = unit.classDef.abilities.filter(
      (ability) => ability.actionCost <= unit.actionGauge.current,
    );
    if (!choices.length) return;
    const index = choices.findIndex((ability) => ability.id === this.battle.selectedAbilityId());
    const next =
      index < 0
        ? direction > 0
          ? 0
          : choices.length - 1
        : (index + direction + choices.length) % choices.length;
    this.onSelectAbility(choices[next]);
  }

  protected restartBattle(): void {
    this.battle.initSkirmish();
  }

  protected toggleLog(): void {
    this.isLogOpen.update((v) => !v);
  }
}
