import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getClassDefinition } from '../core/models/unit-class.model';
import { knownAbilities } from '../core/models/skills.model';
import {
  DEFENSE_LIMIT,
  DEFENSE_PRIORITIES,
  DefenseMember,
  DefensePlan,
  DefenseTargetPriority,
  autoOrders,
} from '../core/models/defense-plan.model';
import { DefensePlanService } from '../core/services/defense-plan.service';
import { BattleStateService } from '../core/services/battle-state.service';
import { RosterService } from '../core/services/roster.service';

@Component({
  selector: 'app-defense-setup',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './defense-setup.component.html',
  styleUrl: './defense-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefenseSetupComponent {
  private readonly saved = inject(DefensePlanService);
  private readonly battle = inject(BattleStateService);
  private readonly roster = inject(RosterService);
  private readonly router = inject(Router);

  protected readonly limit = DEFENSE_LIMIT;
  protected readonly priorities = DEFENSE_PRIORITIES;
  protected readonly draft = signal<DefensePlan>(structuredClone(this.saved.plan()));
  protected readonly notice = signal(this.saved.warning());
  protected readonly dirty = signal(false);

  /** Roster mercenaries not already defending. */
  private readonly unused = computed(() => {
    const taken = this.draft().members.map((member) => member.mercenary.id);
    return this.roster.mercenaries().filter((merc) => !taken.includes(merc.id));
  });
  protected readonly canAdd = computed(
    () => this.draft().members.length < DEFENSE_LIMIT && this.unused().length > 0,
  );

  protected className(member: DefenseMember): string {
    return getClassDefinition(member.mercenary.classId).name;
  }

  protected portrait(member: DefenseMember): string {
    return getClassDefinition(member.mercenary.classId).portraitUrl;
  }

  protected actionName(member: DefenseMember, abilityId: string): string {
    if (abilityId === 'auto') return 'Auto fallback';
    if (abilityId === 'guard') return 'Guard and end';
    return (
      knownAbilities(member.mercenary).find((ability) => ability.id === abilityId)?.name ??
      abilityId
    );
  }

  protected targetName(priority: DefenseTargetPriority): string {
    return {
      'lowest-hp': 'Lowest HP',
      closest: 'Closest',
      leader: 'Leader',
      'front-lane': 'Front lane',
    }[priority];
  }

  protected hasTargetChoice(member: DefenseMember, abilityId: string): boolean {
    return knownAbilities(member.mercenary).some(
      (ability) => ability.id === abilityId && ability.target.startsWith('single-'),
    );
  }

  private update(mutator: (plan: DefensePlan) => void): void {
    const plan = structuredClone(this.draft());
    mutator(plan);
    this.draft.set(plan);
    this.dirty.set(true);
    this.notice.set('Unsaved defense orders.');
  }

  /** Swaps in the next roster mercenary not already defending, in roster order. */
  protected cycleMercenary(index: number): void {
    const roster = this.roster.mercenaries();
    const unused = this.unused();
    if (!unused.length) return;
    const current = roster.findIndex((m) => m.id === this.draft().members[index].mercenary.id);
    const next = unused.find((m) => roster.indexOf(m) > current) ?? unused[0];
    this.update((plan) => {
      const member = plan.members[index];
      // Another class has different skills; never leave invalid actions behind.
      // The newcomer may not know every skill the orders name; those fall back to auto.
      const known = knownAbilities(next).map((ability) => ability.id);
      member.orders = member.orders.map((order) =>
        ['auto', 'guard', ...known].includes(order.abilityId) ? order : autoOrders()[0],
      );
      member.mercenary = structuredClone(next);
    });
  }

  protected addMember(): void {
    const next = this.unused()[0];
    if (!this.canAdd() || !next) return;
    this.update((plan) =>
      plan.members.push({ mercenary: structuredClone(next), orders: autoOrders() }),
    );
  }

  protected removeMember(index: number): void {
    if (this.draft().members.length <= 1) return;
    this.update((plan) => plan.members.splice(index, 1));
  }

  protected cycleAction(memberIndex: number, turnIndex: number): void {
    this.update((plan) => {
      const member = plan.members[memberIndex];
      const options = [
        'auto',
        'guard',
        ...knownAbilities(member.mercenary).map((ability) => ability.id),
      ];
      const order = member.orders[turnIndex];
      order.abilityId = options[(options.indexOf(order.abilityId) + 1) % options.length];
    });
  }

  protected cyclePriority(memberIndex: number, turnIndex: number): void {
    this.update((plan) => {
      const order = plan.members[memberIndex].orders[turnIndex];
      order.targetPriority =
        DEFENSE_PRIORITIES[
          (DEFENSE_PRIORITIES.indexOf(order.targetPriority) + 1) % DEFENSE_PRIORITIES.length
        ];
    });
  }

  protected save(): void {
    if (this.saved.save(this.draft())) this.dirty.set(false);
    this.notice.set(this.saved.warning());
  }

  protected practice(): void {
    if (!this.saved.save(this.draft())) {
      this.notice.set(this.saved.warning());
      return;
    }
    this.dirty.set(false);
    this.battle.initDefensePractice(this.saved.plan(), this.roster.squad());
    void this.router.navigate(['/battle']);
  }
}
