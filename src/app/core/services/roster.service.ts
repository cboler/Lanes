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
  autoInvest,
  investPoint,
} from '../models/progression.model';
import { getClassDefinition } from '../models/unit-class.model';
import { canEquipSupport, patternSkill } from '../models/skills.model';
import { Bonds, applyBondGains, bondGains, bondKey, parseBonds } from '../models/bond.model';
import {
  Piece,
  Slot,
  TIER_LEVEL,
  canWear,
  equipment,
  parsePiece,
  reforgeCost,
  sellValue,
} from '../models/equipment.model';
import {
  Inventory,
  ItemId,
  SCRIBE_COST,
  SCROLLS,
  ScrollId,
  addItems,
  applyCharm,
  applyGrimoire,
  applyTactics,
  canScribe,
  parseInventory,
} from '../models/item.model';

// The key predates version 2 saves; the data carries its own version.
const STORAGE_KEY = 'lanes.roster.v1';
export const SQUAD_LIMIT = 4;

interface SavedRoster {
  version: 2;
  mercenaries: Mercenary[];
  squadIds: string[];
  gold: number;
  recruits: Mercenary[];
  /** Scrolls and grimoires; saves from before items have none. */
  items?: Inventory;
  /** Squad bond points by pair; saves from before bonds have none. */
  bonds?: Bonds;
  /** Equipment not worn by anyone; saves from before equipment have none. */
  armory?: Piece[];
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
  public readonly items = signal<Inventory>({});
  public readonly bonds = signal<Bonds>({});
  public readonly armory = signal<Piece[]>([]);
  /** The squad's average level, which opens the armoury's better tiers. */
  public readonly squadLevel = computed(() => {
    const squad = this.squad();
    return squad.length
      ? Math.max(1, Math.round(squad.reduce((sum, m) => sum + m.level, 0) / squad.length))
      : 1;
  });
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
    this.items.set(saved.items ?? {});
    this.bonds.set(saved.bonds ?? {});
    this.armory.set(saved.armory ?? []);
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
    // Their gear stays with the company.
    const gear = Object.values(roster.find((m) => m.id === id)!.equipment ?? {});
    this.armory.update((list) => [...list, ...gear.filter((piece): piece is Piece => !!piece)]);
    this.mercenaries.set(remaining);
    this.squadIds.set(squad.length ? squad : [remaining[0].id]);
    // Bonds end with the mercenary.
    this.bonds.set(
      parseBonds(
        this.bonds(),
        remaining.map((m) => m.id),
      ),
    );
    this.persist();
    return true;
  }

  /** Buys a piece from the guild armoury, if its tier is open and the purse allows. */
  public buyEquipment(id: string): boolean {
    const item = equipment(id);
    if (!item || TIER_LEVEL[item.tier] > this.squadLevel() || this.gold() < item.price) {
      return false;
    }
    this.gold.update((gold) => gold - item.price);
    const uid = `piece_${Math.floor(this.random() * 0xffffffff).toString(36)}${Date.now().toString(36)}`;
    this.armory.update((list) => [...list, { uid, base: id, plus: 0 }]);
    this.persist();
    return true;
  }

  /** Puts a piece from the armoury on a mercenary; whatever it replaces goes back. */
  public equip(mercId: string, uid: string): boolean {
    const merc = this.mercenaries().find((m) => m.id === mercId);
    const piece = this.armory().find((p) => p.uid === uid);
    const item = piece && equipment(piece.base);
    if (!merc || !piece || !item || !canWear(merc.classId, item)) return false;
    const previous = merc.equipment?.[item.slot];
    this.replace({ ...merc, equipment: { ...merc.equipment, [item.slot]: piece } });
    this.armory.update((list) => [
      ...list.filter((p) => p.uid !== uid),
      ...(previous ? [previous] : []),
    ]);
    this.persist();
    return true;
  }

  public unequip(mercId: string, slot: Slot): boolean {
    const merc = this.mercenaries().find((m) => m.id === mercId);
    const piece = merc?.equipment?.[slot];
    if (!merc || !piece) return false;
    const rest = { ...merc.equipment };
    delete rest[slot];
    this.replace({ ...merc, equipment: rest });
    this.armory.update((list) => [...list, piece]);
    this.persist();
    return true;
  }

  /** Every owned piece, with who wears it (if anyone). */
  public readonly pieces = computed(() => [
    ...this.mercenaries().flatMap((merc) =>
      Object.values(merc.equipment ?? {}).map((piece) => ({ piece: piece!, wearer: merc })),
    ),
    ...this.armory().map((piece) => ({ piece, wearer: null as Mercenary | null })),
  ]);

  /** Reforges a piece one step, wherever it is. */
  public reforge(uid: string): boolean {
    const owned = this.pieces().find((entry) => entry.piece.uid === uid);
    const cost = owned && reforgeCost(owned.piece);
    if (!owned || cost === null || cost === undefined || this.gold() < cost) return false;
    const better = { ...owned.piece, plus: owned.piece.plus + 1 };
    this.gold.update((gold) => gold - cost);
    if (owned.wearer) {
      const slot = equipment(better.base)!.slot;
      this.replace({ ...owned.wearer, equipment: { ...owned.wearer.equipment, [slot]: better } });
    } else {
      this.armory.update((list) => list.map((p) => (p.uid === uid ? better : p)));
    }
    this.persist();
    return true;
  }

  /** Sells a piece from the armoury (not one being worn). */
  public sellPiece(uid: string): boolean {
    const piece = this.armory().find((p) => p.uid === uid);
    if (!piece) return false;
    this.gold.update((gold) => gold + sellValue(piece));
    this.armory.update((list) => list.filter((p) => p.uid !== uid));
    this.persist();
    return true;
  }

  /** Bond points between two mercenaries. */
  public bondPoints(a: string, b: string): number {
    return this.bonds()[bondKey(a, b)] ?? 0;
  }

  /** Equips a support skill if level and SP allow, or takes it off. */
  public toggleSupport(id: string, supportId: string): boolean {
    const merc = this.mercenaries().find((m) => m.id === id);
    if (!merc) return false;
    if (merc.supports.includes(supportId)) {
      this.replace({ ...merc, supports: merc.supports.filter((s) => s !== supportId) });
    } else if (canEquipSupport(merc, supportId)) {
      this.replace({ ...merc, supports: [...merc.supports, supportId] });
    } else {
      return false;
    }
    this.persist();
    return true;
  }

  /** Mercenaries with stat points waiting to be spent. */
  public readonly unspent = computed(() =>
    this.mercenaries().filter((merc) => merc.statPoints > 0),
  );

  /** Spends a mercenary's waiting points on its class's focus stats. */
  public autoInvest(id?: string): void {
    this.mercenaries.update((list) =>
      list.map((merc) =>
        (!id || merc.id === id) && merc.statPoints > 0 ? autoInvest(merc) : merc,
      ),
    );
    this.persist();
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
      const learned = merc.pattern
        .filter((step) => step.level > merc.level && step.level <= next.level)
        .map((step) => patternSkill(merc.classId, step).name);
      return [
        {
          id,
          name: merc.name,
          exp,
          level: next.level,
          levelsGained: next.level - merc.level,
          learned,
        },
      ];
    });
    const grown = applyBondGains(this.bonds(), bondGains(report));
    this.bonds.set(grown.bonds);
    const nameOf = (id: string) => this.mercenaries().find((m) => m.id === id)?.name ?? '?';
    const rewards: BattleRewards = {
      gold: battleGold(report),
      mercenaries,
      bonds: grown.rankUps.map((up) => ({
        names: [nameOf(up.ids[0]), nameOf(up.ids[1])] as const,
        title: up.rank.title,
      })),
    };
    this.gold.update((gold) => gold + rewards.gold);
    this.paid.set(report.id, rewards);
    this.persist();
    return rewards;
  }

  /** Pays gold and items from outside battle, such as a story reward or a bounty. */
  public grant(gold: number, items: readonly ItemId[] = []): void {
    this.gold.update((purse) => purse + gold);
    this.items.update((inventory) => addItems(inventory, items));
    this.persist();
  }

  public count(item: ItemId): number {
    return this.items()[item] ?? 0;
  }

  public buy(scroll: ScrollId): boolean {
    const { price } = SCROLLS[scroll];
    if (this.gold() < price) return false;
    this.gold.update((gold) => gold - price);
    this.items.update((inventory) => addItems(inventory, [scroll]));
    this.persist();
    return true;
  }

  /** Spends a Tactics Scroll to raise one of a mercenary's aptitudes. */
  public useTactics(id: string, stat: PrimaryStat): boolean {
    return this.useItem('tactics', id, (merc) => applyTactics(merc, stat));
  }

  /** Spends a Charm Scroll to refund a mercenary's invested points. */
  public useCharm(id: string): boolean {
    return this.useItem('charm', id, applyCharm);
  }

  /** Spends a grimoire to teach its skill in place of one of the mercenary's pattern skills. */
  public useGrimoire(id: string, item: ItemId, replaceId: string): boolean {
    return this.useItem(item, id, (merc) => applyGrimoire(merc, item, replaceId));
  }

  /** Copies a skill a mercenary has learned into a grimoire, for gold. */
  public scribe(id: string, skillId: string): boolean {
    const merc = this.mercenaries().find((m) => m.id === id);
    if (!merc || !canScribe(merc, skillId) || this.gold() < SCRIBE_COST) return false;
    this.gold.update((gold) => gold - SCRIBE_COST);
    this.items.update((inventory) => addItems(inventory, [`grimoire:${skillId}`]));
    this.persist();
    return true;
  }

  private useItem(item: ItemId, id: string, apply: (merc: Mercenary) => Mercenary | null): boolean {
    const merc = this.mercenaries().find((m) => m.id === id);
    const next = merc && this.count(item) > 0 ? apply(merc) : null;
    if (!next) return false;
    this.replace(next);
    this.items.update((inventory) => addItems(inventory, [item], -1));
    this.persist();
    return true;
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
      return {
        version: 2,
        mercenaries,
        squadIds,
        gold: gold!,
        recruits,
        items: parseInventory(raw.items),
        bonds: parseBonds(
          raw.bonds,
          mercenaries.map((m) => m.id),
        ),
        armory: (Array.isArray(raw.armory) ? raw.armory : [])
          .map(parsePiece)
          .filter((piece): piece is Piece => !!piece),
      };
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
      items: this.items(),
      bonds: this.bonds(),
      armory: this.armory(),
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
