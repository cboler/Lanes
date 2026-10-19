import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import {
  DefensePlan,
  createDefaultDefensePlan,
  parseDefensePlan,
} from '../models/defense-plan.model';
import { RosterService } from './roster.service';

// The key predates version 2 plans; the data carries its own version.
const STORAGE_KEY = 'lanes.defense-plan.v1';

@Injectable({ providedIn: 'root' })
export class DefensePlanService {
  private readonly document = inject(DOCUMENT);
  private readonly roster = inject(RosterService);
  public readonly warning = signal('');
  public readonly plan = signal<DefensePlan>(this.load());

  private load(): DefensePlan {
    const roster = this.roster.mercenaries();
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!stored) return createDefaultDefensePlan(roster);
      const plan = parseDefensePlan(JSON.parse(stored), roster);
      if (plan) return plan;
      this.warning.set('Saved defense orders were invalid; defaults are shown.');
    } catch {
      this.warning.set('Saved defense orders could not be loaded; defaults are shown.');
    }
    return createDefaultDefensePlan(roster);
  }

  public save(value: unknown): boolean {
    const plan = parseDefensePlan(value, this.roster.mercenaries());
    if (!plan) {
      this.warning.set('Invalid defense orders were not saved.');
      return false;
    }
    this.plan.set(plan);
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Device storage unavailable.');
      storage.setItem(STORAGE_KEY, JSON.stringify(plan));
      this.warning.set('Defense orders saved on this device.');
    } catch {
      this.warning.set(
        'Defense orders remain available for this session, but device storage is unavailable.',
      );
    }
    return true;
  }
}
