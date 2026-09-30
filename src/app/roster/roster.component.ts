import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Mercenary, PRIMARY_STATS, STAT_LABELS } from '../core/models/mercenary.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { RosterService, SQUAD_LIMIT } from '../core/services/roster.service';

@Component({
  selector: 'app-roster',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterComponent {
  protected readonly roster = inject(RosterService);
  private readonly battle = inject(BattleStateService);
  private readonly router = inject(Router);

  protected readonly primaryStats = PRIMARY_STATS;
  protected readonly labels = STAT_LABELS;
  protected readonly squadLimit = SQUAD_LIMIT;

  protected inSquad(merc: Mercenary): boolean {
    return this.roster.squadIds().includes(merc.id);
  }

  protected deploy(): void {
    const squad = this.roster.squad();
    this.battle.initSkirmish(
      squad.map((merc) => this.roster.classOf(merc)),
      undefined,
      undefined,
      squad,
    );
    this.router.navigate(['/']);
  }
}
