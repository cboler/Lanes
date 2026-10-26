import { UnitInstance } from '../models/unit-instance.model';

/**
 * Determines and advances the turn order for units on the battlefield.
 * Order is resolved by descending Speed, then Agility. Dead units are skipped.
 *
 * Units still level after both alternate between the sides, and the side that leads a
 * tie alternates too, from one tie to the next and from one round to the next. Which side
 * leads the first tie is a coin drawn from the battle's line-up (who, which class, where),
 * so it differs from battle to battle yet the same field always gives the same order.
 * Before, the player's units simply went first on a tie, and since acting first wins most
 * battles, the player won seven mirror matches in ten.
 */
export class TurnManager {
  private readonly _order: UnitInstance[] = [];
  private _currentIndex = 0;
  private _roundNumber = 1;
  /** The side that leads the first tie in odd rounds, fixed when the battle begins. */
  private _firstLead: 'player' | 'enemy' | null = null;

  public setOrder(units: readonly UnitInstance[]): void {
    this._order.length = 0;
    this._firstLead ??= lineUpCoin(units);
    // Objects such as barricades never take a turn.
    const living = units
      .filter((u) => u.isAlive && !u.isObject)
      .sort((a, b) => b.stats.speed - a.stats.speed || b.stats.agility - a.stats.agility);
    const other = this._firstLead === 'player' ? 'enemy' : 'player';
    let lead: 'player' | 'enemy' = this._roundNumber % 2 === 1 ? this._firstLead : other;
    for (let start = 0; start < living.length;) {
      let end = start + 1;
      while (
        end < living.length &&
        living[end].stats.speed === living[start].stats.speed &&
        living[end].stats.agility === living[start].stats.agility
      ) {
        end++;
      }
      const tied = living.slice(start, end);
      const sides = {
        player: tied.filter((u) => u.team === 'player'),
        enemy: tied.filter((u) => u.team !== 'player'),
      };
      if (sides.player.length && sides.enemy.length) {
        const first = sides[lead];
        const second = sides[lead === 'player' ? 'enemy' : 'player'];
        for (let i = 0; i < Math.max(first.length, second.length); i++) {
          if (first[i]) this._order.push(first[i]);
          if (second[i]) this._order.push(second[i]);
        }
        lead = lead === 'player' ? 'enemy' : 'player';
      } else {
        this._order.push(...tied);
      }
      start = end;
    }
    this._currentIndex = 0;
  }

  public get order(): readonly UnitInstance[] {
    return this._order;
  }

  public get currentIndex(): number {
    return this._currentIndex;
  }

  public get roundNumber(): number {
    return this._roundNumber;
  }

  public get current(): UnitInstance | null {
    return this._currentIndex < this._order.length ? this._order[this._currentIndex] : null;
  }

  public advance(): UnitInstance | null {
    this._currentIndex++;
    while (this._currentIndex < this._order.length && !this._order[this._currentIndex].isAlive) {
      this._currentIndex++;
    }

    return this.current;
  }

  public startNewRound(units: readonly UnitInstance[]): void {
    this._roundNumber++;
    this.setOrder(units);
  }

  public get isRoundComplete(): boolean {
    return this._currentIndex >= this._order.length;
  }
}

/** A fair, repeatable coin from who stands where at the start: the same line-up, the same side. */
function lineUpCoin(units: readonly UnitInstance[]): 'player' | 'enemy' {
  const key = units
    .map((u) => `${u.team}:${u.classDef.id}:${u.name}:${u.lane}:${u.positionX.toFixed(3)}`)
    .sort()
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  // Mix every bit in before reading one: FNV's low bit barely changes between line-ups.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 31 === 0 ? 'player' : 'enemy';
}
