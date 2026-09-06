export type StatusEffectType =
  'poison' | 'stun' | 'attack-up' | 'attack-down' | 'defense-up' | 'defense-down';

export class StatusEffectInstance {
  constructor(
    public readonly type: StatusEffectType,
    public duration: number,
    public readonly potency = 0,
  ) {}

  public get isExpired(): boolean {
    return this.duration <= 0;
  }

  public tick(): void {
    if (this.duration > 0) {
      this.duration--;
    }
  }
}
