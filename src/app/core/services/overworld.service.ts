import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import {
  advanceExpedition,
  newExpedition,
  nodeAt,
  parseExpedition,
  regionById,
  storyPatrol,
  travel,
} from '../models/overworld.model';
import { REGIONS, Region } from '../models/overworld-regions';
import { chapterCleared, chapterOf, findMission, missionContract } from '../models/campaign.model';
import { Contract, TIERS, generateContract, parseContract } from '../models/contract.model';
import { seededRandom } from '../models/mercenary.model';
import { marchRecovery } from '../models/facility.model';
import { RosterService } from './roster.service';
import { GuildService } from './guild.service';
import { CampaignService } from './campaign.service';

// A localStorage key name, not a secret.
const STORAGE_KEY = 'lanes.overworld.v1'; // gitleaks:allow

@Injectable({ providedIn: 'root' })
export class OverworldService {
  private readonly document = inject(DOCUMENT);
  private readonly roster = inject(RosterService);
  private readonly guild = inject(GuildService);
  public readonly campaign = inject(CampaignService);
  public readonly state = signal(newExpedition());
  /** Compositions are rolled once per journey, independent of the fixed map circuits. */
  private readonly squads = new Map<string, Contract>();
  private readonly random = seededRandom(Date.now() ^ (Math.random() * 2 ** 32));
  public readonly warning = signal('');
  public readonly message = signal('The road is yours. Choose a connected waypoint to set out.');
  /** The board the company is on. */
  public readonly region = computed(() => regionById(this.state().region));
  /** Regions the story has opened, in order. */
  public readonly regions = computed(() =>
    REGIONS.filter(
      (region) => !region.unlockedBy || chapterCleared(region.unlockedBy, this.campaign.cleared()),
    ),
  );
  /** The region the next story mission waits in. */
  public readonly storyRegion = computed(() => {
    const next = this.campaign.next();
    return next ? regionById(chapterOf(next.id)?.region) : null;
  });
  /** The next story squad, when it walks this board. */
  public readonly story = computed(() => {
    const next = this.campaign.next();
    return next && this.storyRegion()?.id === this.region().id ? storyPatrol(next) : undefined;
  });
  public readonly encounter = computed(() => {
    const id = this.state().encounter;
    const mission = id?.startsWith('story:') ? findMission(id.slice(6)) : null;
    return mission ? storyPatrol(mission) : this.region().patrols.find((p) => p.id === id);
  });

  constructor() {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored);
        const state = parseExpedition(raw);
        if (state) {
          this.state.set(state);
          for (const patrol of REGIONS.flatMap((region) => region.patrols)) {
            const squad = parseContract(raw.squads?.[patrol.id]);
            if (
              squad?.id === `overworld:${patrol.id}` &&
              squad.tier === patrol.tier &&
              squad.enemies.length === TIERS[patrol.tier].size
            )
              this.squads.set(patrol.id, squad);
          }
        }
      }
    } catch {
      this.warning.set('Saved expedition could not be read. A new journey has begun.');
    }
    this.rollSquads(this.region());
    // Optional squad snapshots extend the v1 save without discarding an older journey.
    this.persist();
  }

  /** Each patrol's squad is rolled when the company first reaches its region, at its level then. */
  private rollSquads(region: Region): void {
    for (const patrol of region.patrols) {
      if (!this.squads.has(patrol.id)) {
        this.squads.set(patrol.id, {
          ...generateContract(patrol.tier, this.guild.partyLevel(), this.random),
          id: `overworld:${patrol.id}`,
          band: patrol.name,
        });
      }
    }
  }

  /** Sets out for another opened region; its board resumes where the company left it. */
  public travelTo(regionId: string): boolean {
    const region = this.regions().find((r) => r.id === regionId);
    if (!region || this.state().encounter || region.id === this.region().id) return false;
    this.state.set(travel(this.state(), region));
    this.rollSquads(region);
    this.message.set(`Your company arrives at ${nodeAt(this.state().position).name}.`);
    this.persist();
    return true;
  }

  public step(destination: string): boolean {
    const next = advanceExpedition(this.state(), destination, this.story());
    if (next === this.state()) return false;
    this.state.set(next);
    // The road mends a little of what the last battles cost.
    this.roster.mend(marchRecovery(this.roster.facilities()));
    this.message.set(
      next.encounter
        ? `${this.encounter()!.name} intercept your company!`
        : `Arrived at ${nodeAt(destination).name}. The patrols advance with you.`,
    );
    this.settle();
    return true;
  }

  /** The company is at its region's camp, where it can rest. */
  public readonly atCamp = computed(() => this.state().position === this.region().start);

  /** A night at camp: everyone back to full health for the fee, and one turn passes. */
  public rest(): boolean {
    if (!this.atCamp() || this.state().encounter || !this.roster.rest()) return false;
    this.step(this.state().position);
    if (!this.state().encounter) {
      this.message.set('Your company rests at camp and sets out whole. The patrols moved on.');
    }
    return true;
  }

  /** Landing rewards wait until an intercepting patrol has been beaten. */
  private settle(): void {
    const state = this.state();
    const node = nodeAt(state.position);
    if (!state.encounter && (node.gold || node.item) && !state.collected.includes(node.id)) {
      this.state.update((s) => ({ ...s, collected: [...s.collected, node.id] }));
      this.roster.grant(node.gold ?? 0, node.item ? [node.item] : []);
      this.message.set(
        node.gold
          ? `Found ${node.gold} gold in ${node.name}.`
          : `Recovered a ${node.item === 'tactics' ? 'Tactics' : 'Charm'} Scroll at ${node.name}.`,
      );
    }
    if (!state.encounter && node.kind === 'goal' && !state.complete) {
      const region = this.region();
      this.state.update((s) => ({ ...s, complete: true }));
      this.roster.grant(region.goalReward, []);
      this.message.set(
        `${node.name} reached! The guild awards you ${region.goalReward} gold. You can still explore the other roads.`,
      );
    }
    this.persist();
  }

  /** One piece is one saved enemy squad; inspecting it and meeting it use the same sheet. */
  public contract(patrolId: string | null = this.state().encounter): Contract | null {
    if (patrolId?.startsWith('story:')) {
      const mission = findMission(patrolId.slice(6));
      return mission ? missionContract(mission) : null;
    }
    const patrol = this.region().patrols.find((p) => p.id === patrolId);
    const contract = patrol && this.squads.get(patrol.id);
    if (!patrol || !contract) return null;
    return {
      ...contract,
      id: `overworld:${patrol.id}`,
      band: patrol.name,
      title: `${this.region().short} • ${nodeAt(this.state().position).name}`,
    };
  }

  public resolve(contractId: string, victory: boolean): void {
    const camp = this.region().start;
    const campName = nodeAt(camp).name;
    if (
      contractId.startsWith('mission_') &&
      this.state().encounter === `story:${contractId.slice(8)}`
    ) {
      this.state.update((s) => ({
        ...s,
        encounter: null,
        position: victory ? s.position : camp,
      }));
      this.message.set(
        victory
          ? 'The contract is won. Your company has a new lead to follow.'
          : `Your company regroups at ${campName}. The contract remains unfinished.`,
      );
      this.settle();
      return;
    }
    const id = this.region().patrols.find((p) => contractId === `overworld:${p.id}`)?.id;
    if (!id || this.state().defeated.includes(id)) return;
    if (id !== this.state().encounter) {
      // Retrying from a defeat verdict can still beat that patrol after regrouping at camp.
      if (victory) {
        this.state.update((s) => ({ ...s, defeated: [...s.defeated, id] }));
        this.persist();
      }
      return;
    }
    this.state.update((s) => ({
      ...s,
      encounter: null,
      position: victory ? s.position : camp,
      defeated: victory ? [...s.defeated, id] : s.defeated,
    }));
    this.message.set(
      victory
        ? 'The patrol is defeated. Your company can continue.'
        : `Your company regroups at ${campName}. The patrol remains on the road.`,
    );
    this.settle();
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...this.state(), squads: Object.fromEntries(this.squads) }),
      );
    } catch {
      this.warning.set('Saving is unavailable. Expedition progress lasts for this session.');
    }
  }
}
