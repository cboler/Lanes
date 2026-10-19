import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import {
  Mercenary,
  PrimaryStat,
  Random,
  generateStarterRoster,
  parseMercenary,
  seededRandom,
} from '../models/mercenary.model';
import {
  BattleReport,
  BattleRewards,
  REFRESH_COST,
  ROSTER_LIMIT,
  STARTING_GOLD,
  battleExp,
  battleGold,
  gainExp,
  generateRecruits,
  hireCost,
  investPoint,
} from '../models/progression.model';
import { getClassDefinition } from '../models/unit-class.model';

// The key predates version 2 saves; the data carries its own version.
const STORAGE_KEY = 'lanes.roster.v1';
export const SQUAD_LIMIT = 4;

interface SavedRoster {
  version: 2;
  mercenaries: Mercenary[];
  squadIds: string[];
  gold: number;
  recruits: Mercenary[];
}

@Injectable({ providedIn: 'root' })
export class RosterService {
  private readonly document = inject(DOCUMENT);
  /** Rolls new mercenaries; replaceable so tests can make recruits predictable. */
  public random: Random = seededRandom(Date.now() ^ (Math.random() * 2 ** 32));
  public readonly warning = signal('');
  public readonly mercenaries = signal<Mercenary[]>([]);
  public readonly squadIds = signal<string[]>([]);
  public readonly gold = signal(0);
  public readonly recruits = signal<Mercenary[]>([]);
  /** Rewards already paid this session, by battle report id, so a battle pays once. */
  private readonly paid = new Map<string, BattleRewards>();

  /** Squad members in selection order. */
  public readonly squad = computed(() =>
    this.squadIds()
      .map((id) => this.mercenaries().find((merc) => merc.id === id))
      .filter((merc): merc is Mercenary => !!merc),
  );

  constructor() {
    const saved = this.load() ?? this.createStarter();
    this.mercenaries.set(saved.mercenaries);
    this.squadIds.set(saved.squadIds);
    this.gold.set(saved.gold);
    this.recruits.set(saved.recruits);
    if (!this.warning()) this.persist();
  }

  public toggleSquad(id: string): void {
    const current = this.squadIds();
    if (current.includes(id)) {
      // A squad never drops below one member, matching the squad builder.
      if (current.length > 1) this.squadIds.set(current.filter((other) => other !== id));
    } else if (current.length < SQUAD_LIMIT && this.mercenaries().some((m) => m.id === id)) {
      this.squadIds.set([...current, id]);
    }
    this.persist();
  }

  public classOf(merc: Mercenary) {
    return getClassDefinition(merc.classId);
  }

  public cost(merc: Mercenary): number {
    return hireCost(merc);
  }

  public canHire(merc: Mercenary): boolean {
    return this.mercenaries().length < ROSTER_LIMIT && this.gold() >= hireCost(merc);
  }

  /** Moves a recruit into the roster for its price. Its board slot stays empty until a refresh. */
  public hire(id: string): boolean {
    const recruit = this.recruits().find((r) => r.id === id);
    if (!recruit || !this.canHire(recruit)) return false;
    this.gold.update((gold) => gold - hireCost(recruit));
    this.mercenaries.update((list) => [...list, recruit]);
    this.recruits.update((list) => list.filter((r) => r.id !== id));
    this.persist();
    return true;
  }

  /** A new board of recruits for a small fee. */
  public refreshRecruits(): boolean {
    if (this.gold() < REFRESH_COST) return false;
    this.gold.update((gold) => gold - REFRESH_COST);
    this.recruits.set(this.rollRecruits(this.mercenaries()));
    this.persist();
    return true;
  }

  /** Lets a mercenary go. The roster keeps at least one, and the squad at least one. */
  public dismiss(id: string): boolean {
    const roster = this.mercenaries();
    if (roster.length <= 1 || !roster.some((m) => m.id === id)) return false;
    const remaining = roster.filter((m) => m.id !== id);
    const squad = this.squadIds().filter((other) => other !== id);
    this.mercenaries.set(remaining);
    this.squadIds.set(squad.length ? squad : [remaining[0].id]);
    this.persist();
    return true;
  }

  public invest(id: string, stat: PrimaryStat): boolean {
    const merc = this.mercenaries().find((m) => m.id === id);
    const next = merc && investPoint(merc, stat);
    if (!next) return false;
    this.replace(next);
    this.persist();
    return true;
  }

  /**
   * Pays a finished battle's gold and EXP. Paying the same report again returns the
   * first payout, so revisiting the result screen never pays twice.
   */
  public claimRewards(report: BattleReport): BattleRewards {
    const already = this.paid.get(report.id);
    if (already) return already;
    const mercenaries = report.mercenaries.flatMap(({ id, survived }) => {
      const merc = this.mercenaries().find((m) => m.id === id);
      if (!merc) return [];
      const exp = battleExp(report, merc, survived);
      const next = gainExp(merc, exp);
      this.replace(next);
      return [
        { id, name: merc.name, exp, level: next.level, levelsGained: next.level - merc.level },
      ];
    });
    const rewards: BattleRewards = { gold: battleGold(report), mercenaries };
    this.gold.update((gold) => gold + rewards.gold);
    this.paid.set(report.id, rewards);
    this.persist();
    return rewards;
  }

  private replace(merc: Mercenary): void {
    this.mercenaries.update((list) => list.map((m) => (m.id === merc.id ? merc : m)));
  }

  private rollRecruits(roster: readonly Mercenary[]): Mercenary[] {
    return generateRecruits(
      this.random,
      roster.map((m) => m.name),
    );
  }

  private createStarter(): SavedRoster {
    const mercenaries = generateStarterRoster(this.random);
    return {
      version: 2,
      mercenaries,
      squadIds: mercenaries.slice(0, SQUAD_LIMIT).map((m) => m.id),
      gold: STARTING_GOLD,
      recruits: this.rollRecruits(mercenaries),
    };
  }

  private load(): SavedRoster | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const raw = JSON.parse(stored) as Partial<Omit<SavedRoster, 'version'>> & {
        version?: number;
      };
      if (
        (raw.version !== 1 && raw.version !== 2) ||
        !Array.isArray(raw.mercenaries) ||
        !Array.isArray(raw.squadIds)
      ) {
        throw new Error('Unrecognized roster format.');
      }
      const mercenaries = this.parseList(raw.mercenaries);
      if (!mercenaries?.length || mercenaries.length > ROSTER_LIMIT) {
        throw new Error('Invalid mercenaries.');
      }
      const squadIds = [
        ...new Set(raw.squadIds.filter((id) => mercenaries.some((merc) => merc.id === id))),
      ].slice(0, SQUAD_LIMIT);
      if (!squadIds.length) squadIds.push(mercenaries[0].id);
      // Version 1 had no economy: start it with the opening purse and a fresh board.
      if (raw.version === 1) {
        return {
          version: 2,
          mercenaries,
          squadIds,
          gold: STARTING_GOLD,
          recruits: this.rollRecruits(mercenaries),
        };
      }
      const gold = raw.gold;
      const recruits = Array.isArray(raw.recruits) ? this.parseList(raw.recruits) : null;
      if (!Number.isInteger(gold) || gold! < 0 || gold! > 9_999_999 || !recruits) {
        throw new Error('Invalid purse or recruits.');
      }
      return { version: 2, mercenaries, squadIds, gold: gold!, recruits };
    } catch {
      this.warning.set('Saved roster could not be loaded; a new roster was created.');
      return null;
    }
  }

  /** Parses saved mercenaries, or null if any is invalid or two share an id. */
  private parseList(values: unknown[]): Mercenary[] | null {
    const list: Mercenary[] = [];
    for (const candidate of values) {
      const merc = parseMercenary(candidate);
      if (!merc || list.some((other) => other.id === merc.id)) return null;
      list.push(merc);
    }
    return list;
  }

  private persist(): void {
    const data: SavedRoster = {
      version: 2,
      mercenaries: this.mercenaries(),
      squadIds: this.squadIds(),
      gold: this.gold(),
      recruits: this.recruits(),
    };
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) throw new Error('Device storage unavailable.');
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      this.warning.set('Roster is kept for this session, but device storage is unavailable.');
    }
  }
}
