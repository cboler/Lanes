import { UnitInstance } from '../models/unit-instance.model';

/**
 * Determines and advances the turn order for units on the battlefield.
 * Order is resolved by descending Speed. Dead units are skipped.
 */
export class TurnManager {
  private readonly _order: UnitInstance[] = [];
  private _currentIndex = 0;
  private _roundNumber = 1;

  public setOrder(units: readonly UnitInstance[]): void {
    this._order.length = 0;
    const living = units.filter((u) => u.isAlive).sort((a, b) => b.stats.speed - a.stats.speed);
    this._order.push(...living);
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
