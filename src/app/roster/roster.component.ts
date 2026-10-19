import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Mercenary, PRIMARY_STATS, PrimaryStat, STAT_LABELS } from '../core/models/mercenary.model';
import {
  APTITUDE_RATIO,
  LEVEL_CAP,
  REFRESH_COST,
  ROSTER_LIMIT,
  expToNext,
} from '../core/models/progression.model';
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
  protected readonly rosterLimit = ROSTER_LIMIT;
  protected readonly refreshCost = REFRESH_COST;
  /** The mercenary whose Dismiss button is waiting for a second press. */
  protected readonly confirmingDismiss = signal<string | null>(null);

  protected inSquad(merc: Mercenary): boolean {
    return this.roster.squadIds().includes(merc.id);
  }

  protected expPercent(merc: Mercenary): number {
    return merc.level >= LEVEL_CAP ? 100 : (merc.exp / expToNext(merc.level)) * 100;
  }

  protected expLabel(merc: Mercenary): string {
    return merc.level >= LEVEL_CAP ? 'Max level' : `${merc.exp} / ${expToNext(merc.level)} EXP`;
  }

  protected investHint(merc: Mercenary, stat: PrimaryStat): string {
    const ratio = APTITUDE_RATIO[merc.aptitudes[stat]];
    return `Raise ${STAT_LABELS[stat]} for ${merc.name}. Aptitude ${merc.aptitudes[stat]}: +1 bonus every ${ratio} points.`;
  }

  protected invest(merc: Mercenary, stat: PrimaryStat): void {
    this.roster.invest(merc.id, stat);
  }

  protected dismiss(merc: Mercenary): void {
    if (this.confirmingDismiss() !== merc.id) {
      this.confirmingDismiss.set(merc.id);
      return;
    }
    this.confirmingDismiss.set(null);
    this.roster.dismiss(merc.id);
  }

  protected deploy(): void {
    this.battle.deployMercenaries(this.roster.squad());
    this.router.navigate(['/']);
  }
}
