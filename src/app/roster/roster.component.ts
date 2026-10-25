import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GRADES,
  Mercenary,
  PRIMARY_STATS,
  PrimaryStat,
  STAT_LABELS,
} from '../core/models/mercenary.model';
import { ItemId, SCRIBE_COST, grimoireSkill } from '../core/models/item.model';
import { BOND_RANKS, bondRank, nextBondRank } from '../core/models/bond.model';
import {
  APTITUDE_RATIO,
  LEVEL_CAP,
  REFRESH_COST,
  ROSTER_LIMIT,
  expToNext,
} from '../core/models/progression.model';
import {
  SUPPORT_SKILLS,
  SupportSkill,
  canEquipSupport,
  patternSkill,
  supportCost,
} from '../core/models/skills.model';
import { BattleStateService } from '../core/services/battle-state.service';
import { RosterService, SQUAD_LIMIT } from '../core/services/roster.service';

@Component({
  selector: 'app-roster',
  standalone: true,
  imports: [],
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

  protected readonly supportSkills = SUPPORT_SKILLS;
  protected readonly scribeCost = SCRIBE_COST;

  /** This mercenary's bonds with the rest of the roster, strongest first. */
  protected bondsOf(
    merc: Mercenary,
  ): { name: string; title: string; points: number; progress: number; perk: string }[] {
    return this.roster
      .mercenaries()
      .filter((other) => other.id !== merc.id)
      .map((other) => {
        const points = this.roster.bondPoints(merc.id, other.id);
        const rank = bondRank(points);
        const next = nextBondRank(points);
        const from = rank ? BOND_RANKS[rank - 1].points : 0;
        return {
          name: other.name,
          title: rank
            ? BOND_RANKS[rank - 1].title
            : `Acquainted · ${next!.points - points} to Comrades`,
          points,
          progress: next ? ((points - from) / (next.points - from)) * 100 : 100,
          perk: BOND_RANKS.slice(0, rank)
            .map((step) => step.perk)
            .join(' · '),
        };
      })
      .filter((bond) => bond.points > 0)
      .sort((a, b) => b.points - a.points);
  }

  protected nextGrade(merc: Mercenary, stat: PrimaryStat): string | null {
    return GRADES[GRADES.indexOf(merc.aptitudes[stat]) + 1] ?? null;
  }

  protected investedTotal(merc: Mercenary): number {
    return PRIMARY_STATS.reduce((sum, stat) => sum + merc.invested[stat], 0);
  }

  /** Pattern skills this mercenary has learned, which it can scribe into grimoires. */
  protected scribable(merc: Mercenary): { id: string; name: string }[] {
    return merc.pattern
      .filter((step) => step.level <= merc.level)
      .map((step) => ({ id: step.id, name: patternSkill(merc.classId, step).name }));
  }

  /** Grimoires on hand that could teach this mercenary something its pattern lacks. */
  protected grimoiresFor(
    merc: Mercenary,
  ): { item: ItemId; name: string; replace: { id: string; name: string }[] }[] {
    return Object.keys(this.roster.items()).flatMap((item) => {
      const found = grimoireSkill(item);
      if (!found || found.classId !== merc.classId) return [];
      if (merc.pattern.some((step) => step.id === found.skill.id)) return [];
      return [
        {
          item: item as ItemId,
          name: found.skill.name,
          replace: merc.pattern.map((step) => ({
            id: step.id,
            name: patternSkill(merc.classId, step).name,
          })),
        },
      ];
    });
  }

  /** Core skills, then the pattern's skills with the level each is learned at. */
  protected skillList(merc: Mercenary): { name: string; level: number; known: boolean }[] {
    return [
      ...this.roster.classOf(merc).abilities.map((a) => ({ name: a.name, level: 1, known: true })),
      ...merc.pattern.map((step) => ({
        name: patternSkill(merc.classId, step).name,
        level: step.level,
        known: step.level <= merc.level,
      })),
    ];
  }

  protected patternSummary(merc: Mercenary): string {
    return merc.pattern
      .map((step) => `${patternSkill(merc.classId, step).name} (Lv ${step.level})`)
      .join(', ');
  }

  protected spUsed(merc: Mercenary): number {
    return supportCost(merc.supports);
  }

  protected equipped(merc: Mercenary, support: SupportSkill): boolean {
    return merc.supports.includes(support.id);
  }

  protected canEquip(merc: Mercenary, support: SupportSkill): boolean {
    return canEquipSupport(merc, support.id);
  }

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
    this.router.navigate(['/battle']);
  }
}
