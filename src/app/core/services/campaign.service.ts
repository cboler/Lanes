import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { Mission, findMission, isUnlocked, nextMission } from '../models/campaign.model';
import { RosterService } from './roster.service';
import { ItemId } from '../models/item.model';

// A localStorage key name, not a secret.
const STORAGE_KEY = 'lanes.campaign.v1'; // gitleaks:allow

interface SavedCampaign {
  version: 1;
  /** Ids of missions won, in the order they were first won. */
  cleared: string[];
  accepted?: string[];
}

/** A mission's first-clear reward, as paid. */
export interface MissionReward {
  readonly missionId: string;
  readonly gold: number;
  readonly items: readonly ItemId[];
}

/** Campaign progress, saved on this device. */
@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly document = inject(DOCUMENT);
  private readonly roster = inject(RosterService);
  public readonly cleared = signal<string[]>([]);
  public readonly accepted = signal<string[]>([]);
  /** The mission the story continues with, or null when every mission is won. */
  public readonly next = computed(() => nextMission(this.cleared()));
  /** First-clear rewards already paid this session, by battle report id. */
  private readonly paid = new Map<string, MissionReward | null>();

  constructor() {
    this.cleared.set(this.load());
  }

  public isCleared(id: string): boolean {
    return this.cleared().includes(id);
  }

  public isUnlocked(id: string): boolean {
    return isUnlocked(id, this.cleared());
  }

  public mission(id: string): Mission | null {
    return findMission(id);
  }

  public accept(id: string): void {
    if (!this.isUnlocked(id) || this.accepted().includes(id)) return;
    this.accepted.update((ids) => [...ids, id]);
    this.persist();
  }

  /**
   * Marks a mission won. The first win pays its reward; later wins, and asking again for
   * the same battle report, pay nothing new (the report's first answer is returned).
   */
  public complete(missionId: string, reportId: string): MissionReward | null {
    if (this.paid.has(reportId)) return this.paid.get(reportId)!;
    const mission = findMission(missionId);
    let reward: MissionReward | null = null;
    if (mission && !this.isCleared(missionId)) {
      this.cleared.update((list) => [...list, missionId]);
      reward = { missionId, gold: mission.reward.gold, items: mission.reward.items ?? [] };
      this.roster.grant(reward.gold, reward.items);
      this.persist();
    }
    this.paid.set(reportId, reward);
    return reward;
  }

  private load(): string[] {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const raw = JSON.parse(stored) as Partial<SavedCampaign>;
      if (raw.version !== 1 || !Array.isArray(raw.cleared)) return [];
      this.accepted.set(
        Array.isArray(raw.accepted)
          ? [
              ...new Set(
                raw.accepted.filter(
                  (id): id is string => typeof id === 'string' && !!findMission(id),
                ),
              ),
            ]
          : [],
      );
      // Unknown ids are kept: a mission may come back after the story is edited.
      return [...new Set(raw.cleared.filter((id): id is string => typeof id === 'string'))];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          cleared: this.cleared(),
          accepted: this.accepted(),
        } satisfies SavedCampaign),
      );
    } catch {
      // Progress still counts for this session.
    }
  }
}
