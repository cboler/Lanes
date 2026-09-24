import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ALL_CLASSES, getClassDefinition } from '../core/models/unit-class.model';
import {
  DEFENSE_PRIORITIES,
  DefenseMember,
  DefensePlan,
  DefenseTargetPriority,
} from '../core/models/defense-plan.model';
import { DefensePlanService } from '../core/services/defense-plan.service';
import { BattleStateService } from '../core/services/battle-state.service';

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
  private readonly router = inject(Router);

  protected readonly allClasses = ALL_CLASSES;
  protected readonly priorities = DEFENSE_PRIORITIES;
  protected readonly draft = signal<DefensePlan>(structuredClone(this.saved.plan()));
  protected readonly notice = signal(this.saved.warning());
  protected readonly dirty = signal(false);

  protected className(member: DefenseMember): string {
    return getClassDefinition(member.classId).name;
  }

  protected portrait(member: DefenseMember): string {
    return getClassDefinition(member.classId).portraitUrl;
  }

  protected actionName(member: DefenseMember, abilityId: string): string {
    if (abilityId === 'auto') return 'Auto fallback';
    if (abilityId === 'guard') return 'Guard and end';
    return (
      getClassDefinition(member.classId).abilities.find((ability) => ability.id === abilityId)
        ?.name ?? abilityId
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
    return getClassDefinition(member.classId).abilities.some(
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

  protected cycleClass(index: number): void {
    this.update((plan) => {
      const member = plan.members[index];
      const current = ALL_CLASSES.findIndex((cls) => cls.id === member.classId);
      member.classId = ALL_CLASSES[(current + 1) % ALL_CLASSES.length].id;
      // A new class has different skills; never leave invalid actions behind.
      member.orders = this.autoOrders();
    });
  }

  private autoOrders(): DefenseMember['orders'] {
    return Array.from({ length: 4 }, () => ({ abilityId: 'auto', targetPriority: 'closest' }));
  }

  protected addMember(): void {
    if (this.draft().members.length >= 4) return;
    this.update((plan) => plan.members.push({ classId: 'fighter', orders: this.autoOrders() }));
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
        ...getClassDefinition(member.classId).abilities.map((ability) => ability.id),
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
    this.battle.initDefensePractice(this.saved.plan());
    void this.router.navigate(['/']);
  }
}
