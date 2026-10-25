import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Contract, TIERS } from '../core/models/contract.model';
import { SCRIBE_COST, SCROLLS, ScrollId } from '../core/models/item.model';
import {
  EQUIPMENT,
  EquipmentDefinition,
  MAX_PLUS,
  TIER_LEVEL,
  describeBonus,
  pieceBonus,
  pieceName,
  reforgeCost,
  sellValue,
  wearers,
} from '../core/models/equipment.model';
import { Mercenary } from '../core/models/mercenary.model';
import { getClassDefinition } from '../core/models/unit-class.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { GuildService } from '../core/services/guild.service';
import { CampaignService } from '../core/services/campaign.service';
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
  protected readonly campaign = inject(CampaignService);
  private readonly battle = inject(BattleStateService);
  private readonly router = inject(Router);

  protected readonly scrolls = Object.entries(SCROLLS).map(([id, scroll]) => ({
    id: id as ScrollId,
    ...scroll,
  }));
  protected readonly scribeCost = SCRIBE_COST;
  /** What the armoury shows: every open tier, and the next one to look forward to. */
  protected readonly armouryItems = computed(() => {
    const open = ([1, 2, 3] as const).filter((t) => TIER_LEVEL[t] <= this.roster.squadLevel());
    const shown = Math.min(3, Math.max(...open) + 1);
    return EQUIPMENT.filter((item) => item.tier <= shown);
  });
  protected readonly tierLevel = TIER_LEVEL;
  protected readonly maxPlus = MAX_PLUS;
  protected readonly slotName = { weapon: 'Weapon', armor: 'Armour', accessory: 'Accessory' };
  protected readonly describeBonus = describeBonus;
  protected readonly wearers = wearers;
  protected readonly pieceName = pieceName;
  protected readonly pieceBonus = pieceBonus;
  protected readonly reforgeCost = reforgeCost;
  protected readonly sellValue = sellValue;

  protected unlocked(item: EquipmentDefinition): boolean {
    return TIER_LEVEL[item.tier] <= this.roster.squadLevel();
  }

  /** A battle left unfinished, which the Battle page picks up where it stopped. */
  protected readonly unfinished = computed(() => {
    if (!this.battle.units().length || this.battle.battleStatus() !== 'active') return null;
    const contract = this.battle.activeContract();
    if (contract) return contract.title;
    return this.battle.practicePlan() ? 'Defense practice' : 'Skirmish';
  });

  protected scrollName(id: ScrollId): string {
    return SCROLLS[id].name;
  }

  protected tier(contract: Contract) {
    return TIERS[contract.tier];
  }

  protected portrait(merc: Mercenary): string {
    return getClassDefinition(merc.classId).portraitUrl;
  }

  protected className(merc: Mercenary): string {
    return getClassDefinition(merc.classId).name;
  }

  /** A practice fight against class troops: it pays like any battle, at the base rate. */
  protected skirmish(): void {
    this.battle.deployMercenaries(this.roster.squad());
    void this.router.navigate(['/battle']);
  }

  protected take(contract: Contract): void {
    this.battle.deployContract(contract, this.roster.squad());
    void this.router.navigate(['/battle']);
  }
}
