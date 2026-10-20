import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { Contract, generateBoard, generateContract, parseContract } from '../models/contract.model';
import { Random, seededRandom } from '../models/mercenary.model';
import { RosterService } from './roster.service';

const STORAGE_KEY = 'lanes.guild.v1';

interface SavedGuild {
  version: 1;
  contracts: Contract[];
  /** Contracts won, for the hall's record. */
  completed: number;
}

/** The guild hall's contract board, saved on this device. */
@Injectable({ providedIn: 'root' })
export class GuildService {
  private readonly document = inject(DOCUMENT);
  private readonly roster = inject(RosterService);
  /** Rolls contracts; replaceable so tests can make boards predictable. */
  public random: Random = seededRandom(Date.now() ^ (Math.random() * 2 ** 32));
  public readonly contracts = signal<Contract[]>([]);
  public readonly completed = signal(0);

  /** The squad's average level, which new contracts are scaled to. */
  public readonly partyLevel = computed(() => {
    const squad = this.roster.squad();
    if (!squad.length) return 1;
    return Math.max(1, Math.round(squad.reduce((sum, m) => sum + m.level, 0) / squad.length));
  });

  constructor() {
    const saved = this.load();
    this.contracts.set(saved?.contracts ?? generateBoard(this.partyLevel(), this.random));
    this.completed.set(saved?.completed ?? 0);
    this.persist();
  }

  public find(id: string): Contract | undefined {
    return this.contracts().find((contract) => contract.id === id);
  }

  /**
   * A won contract leaves the board; a new one of its tier, at the squad's level, replaces
   * it. Returns the won contract, or undefined if it was not on the board (already won).
   */
  public complete(id: string): Contract | undefined {
    const done = this.find(id);
    if (!done) return undefined;
    const next = generateContract(
      done.tier,
      this.partyLevel(),
      this.random,
      this.contracts().map((c) => c.band),
    );
    this.contracts.update((list) => list.map((c) => (c.id === id ? next : c)));
    this.completed.update((n) => n + 1);
    this.persist();
    return done;
  }

  /** A fresh board at the squad's current level, for when the old one no longer fits. */
  public refresh(): void {
    this.contracts.set(generateBoard(this.partyLevel(), this.random));
    this.persist();
  }

  private load(): SavedGuild | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const raw = JSON.parse(stored) as Partial<SavedGuild>;
      if (raw.version !== 1 || !Array.isArray(raw.contracts)) return null;
      const contracts = raw.contracts.map(parseContract);
      if (!contracts.length || contracts.some((c) => !c)) return null;
      const completed = Number.isInteger(raw.completed) && raw.completed! >= 0 ? raw.completed! : 0;
      return { version: 1, contracts: contracts as Contract[], completed };
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          contracts: this.contracts(),
          completed: this.completed(),
        } satisfies SavedGuild),
      );
    } catch {
      // The board still works for this session.
    }
  }
}
