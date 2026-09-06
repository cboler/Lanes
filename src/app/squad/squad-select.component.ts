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
  protected readonly selectedClass = signal<UnitClassDefinition>(ALL_CLASSES[0]);

  protected readonly playerSquad = signal<UnitClassDefinition[]>([
    ALL_CLASSES[0], // Fighter
    ALL_CLASSES[2], // Archer
    ALL_CLASSES[1], // Cleric
  ]);

  protected readonly enemySquad = signal<UnitClassDefinition[]>([
    ALL_CLASSES[4], // Lancer
    ALL_CLASSES[5], // Gunner
    ALL_CLASSES[3], // Witch
  ]);

  protected inspectClass(cls: UnitClassDefinition): void {
    this.selectedClass.set(cls);
  }

  protected addPlayerUnit(cls: UnitClassDefinition): void {
    if (this.playerSquad().length < 3) {
      this.playerSquad.update((s) => [...s, cls]);
    }
  }

  protected removePlayerUnit(index: number): void {
    if (this.playerSquad().length > 1) {
      this.playerSquad.update((s) => s.filter((_, i) => i !== index));
    }
  }

  protected addEnemyUnit(cls: UnitClassDefinition): void {
    if (this.enemySquad().length < 3) {
      this.enemySquad.update((s) => [...s, cls]);
    }
  }

  protected removeEnemyUnit(index: number): void {
    if (this.enemySquad().length > 1) {
      this.enemySquad.update((s) => s.filter((_, i) => i !== index));
    }
  }

  protected deployToBattle(): void {
    this.battle.initSkirmish(this.playerSquad(), this.enemySquad());
    this.router.navigate(['/']);
  }
}
