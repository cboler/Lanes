/**
 * Tracks a bounded resource budget used for movement or actions.
 */
export class ActionGauge {
  public readonly max: number;
  private _current: number;

  constructor(max: number) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error('Gauge maximum must be finite and positive.');
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
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error('Cost must be finite and non-negative.');
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

  public recover(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Recovery must be finite and non-negative.');
    }
    const previous = this._current;
    this._current = Math.min(this.max, this._current + amount);
    return this._current - previous;
  }

  /**
   * Refills the gauge for a new battle. Turns use partial recovery instead.
   */
  public reset(): void {
    this._current = this.max;
  }
}
