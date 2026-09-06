import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BattleStateService, FloatingText } from '../core/services/battle-state.service';
import { UnitInstance } from '../core/models/unit-instance.model';
import { AbilityDefinition } from '../core/models/ability.model';

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './battlefield.component.html',
  styleUrl: './battlefield.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlefieldComponent implements OnInit {
  protected readonly battle = inject(BattleStateService);
  protected readonly isLogOpen = signal(false);
  protected readonly lanes = [0, 1, 2];

  public ngOnInit(): void {
    if (this.battle.units().length === 0) {
      this.battle.initSkirmish();
    }
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    // Ignore input if in form field or modal
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const active = this.battle.activeUnit();
    if (!active || active.team !== 'player' || this.battle.battleStatus() !== 'active') {
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
    }
  }

  protected getUnitsInLane(lane: number): UnitInstance[] {
    return this.battle.units().filter((u) => u.lane === lane && u.isAlive);
  }

  protected getFloatingTextsFor(unitId: string): FloatingText[] {
    return this.battle.floatingTexts().filter((t) => t.targetId === unitId);
  }

  protected onSelectAbility(ability: AbilityDefinition): void {
    if (this.battle.selectedAbilityId() === ability.id) {
      this.battle.selectAbility(null);
    } else {
      this.battle.selectAbility(ability.id);
      // If target is automatic, auto execute or prompt
      if (ability.target === 'all-enemies' || ability.target === 'all-allies') {
        this.battle.executeSelectedAbility();
      }
    }
  }

  protected onUnitClick(unit: UnitInstance): void {
    const selectedAbility = this.battle.selectedAbility();
    if (!selectedAbility) return;

    const isValid = this.battle.validTargets().some((t) => t.id === unit.id);
    if (isValid) {
      this.battle.executeSelectedAbility(unit);
    }
  }

  protected isTargetable(unit: UnitInstance): boolean {
    return this.battle.validTargets().some((t) => t.id === unit.id);
  }

  protected restartBattle(): void {
    this.battle.initSkirmish();
  }

  protected toggleLog(): void {
    this.isLogOpen.update((v) => !v);
  }
}
