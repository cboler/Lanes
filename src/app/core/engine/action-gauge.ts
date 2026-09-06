/**
 * Tracks and spends the action-gauge budget for a single unit's turn.
 */
export class ActionGauge {
  public readonly max: number;
  private _current: number;

  constructor(max: number) {
    if (max <= 0) {
      throw new Error('Action gauge maximum must be positive.');
    }
    this.max = max;
    this._current = max;
  }

  public get current(): number {
    return this._current;
  }

  public get isExhausted(): boolean {
    return this._current <= 0;
  }

  public get fraction(): number {
    return this.max > 0 ? Math.max(0, Math.min(1, this._current / this.max)) : 0;
  }

  /**
   * Attempts to spend cost points from the gauge.
   * Returns true if affordable and deducted, false otherwise.
   */
  public trySpend(cost: number): boolean {
    if (cost < 0) {
      throw new Error('Cost must be non-negative.');
    }
    if (this._current < cost) {
      return false;
    }
    this._current -= cost;
    return true;
  }

  /**
   * Forcibly sets remaining gauge to zero.
   */
  public exhaust(): void {
    this._current = 0;
  }

  /**
   * Resets gauge to its maximum value at the start of a turn.
   */
  public reset(): void {
    this._current = this.max;
  }
}
