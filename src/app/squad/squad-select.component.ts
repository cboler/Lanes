import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ALL_CLASSES, UnitClassDefinition } from '../core/models/unit-class.model';
import { BattleStateService } from '../core/services/battle-state.service';

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

  protected readonly allClasses = ALL_CLASSES;
  protected readonly squadLimit = 4;
  protected readonly selectedClass = signal<UnitClassDefinition>(ALL_CLASSES[0]);

  protected readonly playerSquad = signal<UnitClassDefinition[]>([
    ALL_CLASSES[0], // Fighter
    ALL_CLASSES[2], // Archer
    ALL_CLASSES[1], // Cleric
    ALL_CLASSES[4], // Lancer
  ]);

  protected readonly enemySquad = signal<UnitClassDefinition[]>([
    ALL_CLASSES[4], // Lancer
    ALL_CLASSES[5], // Gunner
    ALL_CLASSES[3], // Witch
    ALL_CLASSES[0], // Fighter
  ]);

  protected inspectClass(cls: UnitClassDefinition): void {
    this.selectedClass.set(cls);
  }

  protected addPlayerUnit(cls: UnitClassDefinition): void {
    if (this.playerSquad().length < this.squadLimit) {
      this.playerSquad.update((s) => [...s, cls]);
    }
  }

  protected removePlayerUnit(index: number): void {
    if (this.playerSquad().length > 1) {
      this.playerSquad.update((s) => s.filter((_, i) => i !== index));
    }
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
    this.battle.initSkirmish(this.playerSquad(), this.enemySquad());
    this.router.navigate(['/']);
  }
}
