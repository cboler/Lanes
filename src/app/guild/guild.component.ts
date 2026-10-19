import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Contract, TIERS } from '../core/models/contract.model';
import { Mercenary } from '../core/models/mercenary.model';
import { getClassDefinition } from '../core/models/unit-class.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { GuildService } from '../core/services/guild.service';
import { RosterService } from '../core/services/roster.service';

/** The guild hall: the squad at a glance and the contract board. */
@Component({
  selector: 'app-guild',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guild.component.html',
  styleUrl: './guild.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuildComponent {
  protected readonly guild = inject(GuildService);
  protected readonly roster = inject(RosterService);
  private readonly battle = inject(BattleStateService);
  private readonly router = inject(Router);

  protected tier(contract: Contract) {
    return TIERS[contract.tier];
  }

  protected portrait(merc: Mercenary): string {
    return getClassDefinition(merc.classId).portraitUrl;
  }

  protected className(merc: Mercenary): string {
    return getClassDefinition(merc.classId).name;
  }

  protected take(contract: Contract): void {
    this.battle.deployContract(contract, this.roster.squad());
    void this.router.navigate(['/']);
  }
}
