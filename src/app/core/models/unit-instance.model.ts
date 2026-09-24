import { ActionGauge } from '../engine/action-gauge';
import { StatusEffectInstance, StatusEffectType } from './status-effect.model';
import { UnitClassDefinition } from './unit-class.model';
import { UnitBaseStats } from './stats.model';

export type Team = 'player' | 'enemy';

export class UnitInstance {
  public readonly id: string;
  public readonly name: string;
  public readonly classDef: UnitClassDefinition;
  public readonly team: Team;
  public lane: number;
  public positionX: number;
  public currentHp: number;
  public readonly actionGauge: ActionGauge;
  public readonly moveGauge = new ActionGauge(100);
  public guardPoints = 0;
  private readonly _statusEffects: StatusEffectInstance[] = [];

  constructor(
    classDef: UnitClassDefinition,
    name: string,
    team: Team = 'player',
    lane = 1,
    positionX = 0.2,
    gaugeMax = 100,
    id?: string,
  ) {
    this.classDef = classDef;
    this.name = name;
    this.team = team;
    this.lane = lane;
    this.positionX = positionX;
    this.currentHp = classDef.baseStats.maxHp;
    this.actionGauge = new ActionGauge(gaugeMax);
    this.id = id || `${team}_${classDef.id}_${Math.random().toString(36).substring(2, 7)}`;
  }

  public get stats(): UnitBaseStats {
    return this.classDef.baseStats;
  }

  public get maxHp(): number {
    return this.classDef.baseStats.maxHp;
  }

  public get isAlive(): boolean {
    return this.currentHp > 0;
  }

  // MVP tuning: recover a base 25 points plus half the governing stat.
  public get moveRecovery(): number {
    return Math.min(this.moveGauge.max, Math.max(0, Math.floor(25 + this.stats.agility / 2)));
  }

  public get actionRecovery(): number {
    return Math.min(this.actionGauge.max, Math.max(0, Math.floor(25 + this.stats.vitality / 2)));
  }

  public get guardPotential(): number {
    return Math.max(0, Math.floor(this.actionGauge.current * (0.5 + this.stats.technique / 100)));
  }

  public startTurn(): void {
    this.guardPoints = 0;
    this.moveGauge.recover(this.moveRecovery);
    this.actionGauge.recover(this.actionRecovery);
  }

  public enterGuard(): number {
    if (!this.isAlive || this.isStunned || this.guardPoints > 0 || this.actionGauge.isExhausted) {
      return 0;
    }
    this.guardPoints = this.guardPotential;
    this.actionGauge.exhaust();
    return this.guardPoints;
  }

  public get statusEffects(): readonly StatusEffectInstance[] {
    return this._statusEffects;
  }

  public hasEffect(type: StatusEffectType): boolean {
    return this._statusEffects.some((e) => e.type === type && !e.isExpired);
  }

  public get isStunned(): boolean {
    return this.hasEffect('stun');
  }

  public getStatModifier(type: StatusEffectType): number {
    const active = this._statusEffects.filter((e) => e.type === type && !e.isExpired);
    const sum = active.reduce((acc, e) => acc + e.potency, 0);
    if (type === 'attack-down' || type === 'defense-down') {
      return -sum;
    }
    return sum;
  }

  public get effectiveAttack(): number {
    return Math.max(
      0,
      this.stats.attack + this.getStatModifier('attack-up') + this.getStatModifier('attack-down'),
    );
  }

  public get effectiveDefense(): number {
    return Math.max(
      0,
      this.stats.defense +
        this.getStatModifier('defense-up') +
        this.getStatModifier('defense-down'),
    );
  }

  public takeDamage(amount: number, bypassGuard = false): number {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Damage must be finite and non-negative.');
    }
    const absorbed = bypassGuard ? 0 : Math.min(this.guardPoints, amount);
    this.guardPoints -= absorbed;
    const previous = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - (amount - absorbed));
    return previous - this.currentHp;
  }

  public heal(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Heal amount must be finite and non-negative.');
    }
    const previous = this.currentHp;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    return this.currentHp - previous;
  }

  public applyStatusEffect(effect: StatusEffectInstance): void {
    this._statusEffects.push(effect);
  }

  public tickStatusEffects(): number {
    let poisonDamage = 0;
    for (const effect of this._statusEffects) {
      if (effect.type === 'poison' && !effect.isExpired) {
        poisonDamage += effect.potency;
      }
      effect.tick();
    }

    if (poisonDamage > 0) {
      this.takeDamage(poisonDamage, true);
    }

    // Remove expired effects
    for (let i = this._statusEffects.length - 1; i >= 0; i--) {
      if (this._statusEffects[i].isExpired) {
        this._statusEffects.splice(i, 1);
      }
    }

    return poisonDamage;
  }

  public clearStatusEffects(): void {
    this._statusEffects.length = 0;
  }

  public resetForBattle(): void {
    this.currentHp = this.maxHp;
    this.actionGauge.reset();
    this.moveGauge.reset();
    this.guardPoints = 0;
    this.clearStatusEffects();
  }
}
