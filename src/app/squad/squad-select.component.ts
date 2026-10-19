import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ALL_CLASSES, UnitClassDefinition } from '../core/models/unit-class.model';
import { Mercenary } from '../core/models/mercenary.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { RosterService, SQUAD_LIMIT } from '../core/services/roster.service';

@Component({
  selector: 'app-squad-select',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './squad-select.component.html',
  styleUrl: './squad-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SquadSelectComponent {
  private readonly router = inject(Router);
  private readonly battle = inject(BattleStateService);
  protected readonly roster = inject(RosterService);

  protected readonly allClasses = ALL_CLASSES;
  protected readonly squadLimit = SQUAD_LIMIT;
  protected readonly selectedClass = signal<UnitClassDefinition>(ALL_CLASSES[0]);

  /** Roster mercenaries not yet in the squad. */
  protected readonly reserves = computed(() =>
    this.roster.mercenaries().filter((merc) => !this.roster.squadIds().includes(merc.id)),
  );

  /** Skirmish opponents are generic class troops; defenses use mercenaries. */
  protected readonly enemySquad = signal<UnitClassDefinition[]>([
    ALL_CLASSES[4], // Lancer
    ALL_CLASSES[5], // Gunner
    ALL_CLASSES[3], // Witch
    ALL_CLASSES[0], // Fighter
  ]);

  protected inspectClass(cls: UnitClassDefinition): void {
    this.selectedClass.set(cls);
  }

  /** Adds or removes a mercenary; the roster keeps the squad between one and four. */
  protected toggleMercenary(merc: Mercenary): void {
    this.roster.toggleSquad(merc.id);
    this.selectedClass.set(this.roster.classOf(merc));
  }

  protected addEnemyUnit(cls: UnitClassDefinition): void {
    if (this.enemySquad().length < this.squadLimit) {
      this.enemySquad.update((s) => [...s, cls]);
    }
  }

  protected removeEnemyUnit(index: number): void {
    if (this.enemySquad().length > 1) {
      this.enemySquad.update((s) => s.filter((_, i) => i !== index));
    }
  }

  protected startingPosition(cls: UnitClassDefinition, index: number): string {
    const rank = cls.role === 'tank' || cls.role === 'melee' ? 'Front' : 'Rear';
    return `${rank} · Lane ${['I', 'II', 'III'][index % 3]}`;
  }

  protected deployToBattle(): void {
    this.battle.deployMercenaries(this.roster.squad(), this.enemySquad());
    this.router.navigate(['/']);
  }
}
