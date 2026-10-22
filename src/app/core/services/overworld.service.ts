import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import {
  advanceExpedition,
  newExpedition,
  nodeAt,
  parseExpedition,
  PATROLS,
  storyPatrol,
} from '../models/overworld.model';
import { findMission, missionContract } from '../models/campaign.model';
import { Contract, TIERS, generateContract, parseContract } from '../models/contract.model';
import { seededRandom } from '../models/mercenary.model';
import { RosterService } from './roster.service';
import { GuildService } from './guild.service';
import { CampaignService } from './campaign.service';

const STORAGE_KEY = 'lanes.overworld.v1';

@Injectable({ providedIn: 'root' })
export class OverworldService {
  private readonly document = inject(DOCUMENT);
  private readonly roster = inject(RosterService);
  private readonly guild = inject(GuildService);
  public readonly campaign = inject(CampaignService);
  public readonly state = signal(newExpedition());
  /** Compositions are rolled once per journey, independent of the fixed map circuits. */
  private readonly squads = new Map<string, Contract>();
  public readonly warning = signal('');
  public readonly message = signal('The road is yours. Choose a connected waypoint to set out.');
  public readonly story = computed(() =>
    this.campaign.next() ? storyPatrol(this.campaign.next()!) : undefined,
  );
  public readonly encounter = computed(() => {
    const id = this.state().encounter;
    const mission = id?.startsWith('story:') ? findMission(id.slice(6)) : null;
    return mission ? storyPatrol(mission) : PATROLS.find((p) => p.id === id);
  });

  constructor() {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const raw = JSON.parse(stored);
        const state = parseExpedition(raw);
        if (state) {
          this.state.set(state);
          for (const patrol of PATROLS) {
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
    const random = seededRandom(Date.now() ^ (Math.random() * 2 ** 32));
    for (const patrol of PATROLS) {
      if (!this.squads.has(patrol.id)) {
        this.squads.set(patrol.id, {
          ...generateContract(patrol.tier, this.guild.partyLevel(), random),
          id: `overworld:${patrol.id}`,
          band: patrol.name,
        });
      }
    }
    // Optional squad snapshots extend the v1 save without discarding an older journey.
    this.persist();
  }

  public step(destination: string): boolean {
    const next = advanceExpedition(this.state(), destination, this.story());
    if (next === this.state()) return false;
    this.state.set(next);
    this.message.set(
      next.encounter
        ? `${this.encounter()!.name} intercept your company!`
        : `Arrived at ${nodeAt(destination).name}. The patrols advance with you.`,
    );
    this.settle();
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
      this.state.update((s) => ({ ...s, complete: true }));
      this.roster.grant(250, []);
      this.message.set(
        'Watchtower reached! Expedition complete. The guild awards you 250 gold. You can still explore the other roads.',
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
    const patrol = PATROLS.find((p) => p.id === patrolId);
    const contract = patrol && this.squads.get(patrol.id);
    if (!patrol || !contract) return null;
    return {
      ...contract,
      id: `overworld:${patrol.id}`,
      band: patrol.name,
      title: `Thornwatch • ${nodeAt(this.state().position).name}`,
    };
  }

  public resolve(contractId: string, victory: boolean): void {
    if (
      contractId.startsWith('mission_') &&
      this.state().encounter === `story:${contractId.slice(8)}`
    ) {
      this.state.update((s) => ({
        ...s,
        encounter: null,
        position: victory ? s.position : 'camp',
      }));
      this.message.set(
        victory
          ? 'The contract is won. Your company has a new lead to follow.'
          : 'Your company regroups at Wayfarer Camp. The contract remains unfinished.',
      );
      this.settle();
      return;
    }
    const id = PATROLS.find((p) => contractId === `overworld:${p.id}`)?.id;
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
      position: victory ? s.position : 'camp',
      defeated: victory ? [...s.defeated, id] : s.defeated,
    }));
    this.message.set(
      victory
        ? 'The patrol is defeated. Your company can continue.'
        : 'Your company regroups at Wayfarer Camp. The patrol remains on the road.',
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
