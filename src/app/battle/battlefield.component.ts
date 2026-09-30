import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BattleStateService,
  FloatingText,
  IMPACT_DELAY_MS,
} from '../core/services/battle-state.service';
import { Team, UnitInstance } from '../core/models/unit-instance.model';
import { AbilityDefinition } from '../core/models/ability.model';
import { BattleStageComponent } from './battle-stage.component';
import { spriteUrl } from './sprite-art';
import { GamepadService } from '../core/services/gamepad.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DamageCalculator } from '../core/engine/damage-calculator';

/** One tap of a move key or button, in battlefield widths. */
const STEP = 0.04;
/** Holding a move key or button walks continuously, like Grand Kingdom's analog movement. */
const WALK_SPEED = 0.3;
const HOLD_DELAY_MS = 200;
const WALK_KEYS = ['a', 'd', 'arrowleft', 'arrowright'];

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [RouterLink, BattleStageComponent],
  templateUrl: './battlefield.component.html',
  styleUrl: './battlefield.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlefieldComponent implements OnInit, OnDestroy {
  protected readonly battle = inject(BattleStateService);
  protected readonly isLogOpen = signal(false);
  protected readonly lanes = [0, 1, 2];
  private readonly stage = viewChild(BattleStageComponent);
  private readonly sprites = new Map<string, string>();
  private walk: { frame: number; moved: boolean } | null = null;
  private walkedByHold = false;

  protected readonly renderer = computed(() => this.stage()?.renderer() ?? 'pending');
  /** The WebGL stage draws sprites and positions unit buttons; the fallback uses DOM. */
  protected readonly staged = computed(() => this.renderer() !== 'fallback');
  protected readonly impactDelay = computed(
    () => `${Math.round(IMPACT_DELAY_MS * this.battle.delayMultiplier)}ms`,
  );

  /** Upcoming turns with an hourglass where the current round ends. */
  protected readonly timeline = computed(() => {
    const order = this.battle.turnOrder();
    const split = this.battle.turnsLeftInRound();
    return [
      ...order.slice(0, split).map((unit) => ({ key: unit.id, unit })),
      { key: 'round-end', unit: null },
      ...order.slice(split).map((unit) => ({ key: `${unit.id}-next`, unit })),
    ];
  });

  constructor() {
    inject(GamepadService)
      .actions.pipe(takeUntilDestroyed())
      .subscribe((action) => {
        if (!this.battle.canPlayerAct()) return;
        const unit = this.battle.activeUnit()!;
        switch (action) {
          case 'cancel':
            this.cancelSelection();
            break;
          case 'previous-ability':
            this.cycleAbility(-1);
            break;
          case 'next-ability':
            this.cycleAbility(1);
            break;
          case 'move-left':
            this.battle.moveActiveUnit(-STEP);
            break;
          case 'move-right':
            this.battle.moveActiveUnit(STEP);
            break;
          case 'move-up':
            this.battle.switchActiveUnitLane(unit.lane - 1);
            break;
          case 'move-down':
            this.battle.switchActiveUnitLane(unit.lane + 1);
            break;
        }
      });
  }

  public ngOnInit(): void {
    if (this.battle.units().length === 0) {
      this.battle.initSkirmish();
    } else {
      this.battle.resume();
    }
  }

  public ngOnDestroy(): void {
    this.stopWalk();
    this.battle.suspend();
  }

  @HostListener('window:keyup', ['$event'])
  public handleKeyup(event: KeyboardEvent): void {
    if (WALK_KEYS.includes(event.key.toLowerCase())) this.stopWalk();
  }

  @HostListener('window:blur')
  public handleBlur(): void {
    this.stopWalk();
  }

  /** Walk while held; spends MG exactly as taps do, and stops when blocked or out of MG. */
  protected startWalk(direction: number): void {
    this.stopWalk();
    const walk = { frame: 0, moved: false };
    const started = performance.now();
    let last = started;
    let pending = 0;
    const tick = (now: number) => {
      if (this.walk !== walk) return;
      if (now - started >= HOLD_DELAY_MS) {
        pending += direction * WALK_SPEED * Math.min(0.1, (now - last) / 1000);
        // The rules ignore tiny moves, so bank high-refresh-rate frames into one step.
        if (Math.abs(pending) >= 0.005) {
          if (!this.battle.moveActiveUnit(pending)) {
            this.stopWalk();
            return;
          }
          walk.moved = true;
          pending = 0;
        }
      }
      last = now;
      walk.frame = requestAnimationFrame(tick);
    };
    walk.frame = requestAnimationFrame(tick);
    this.walk = walk;
  }

  protected stopWalk(): void {
    if (this.walk) cancelAnimationFrame(this.walk.frame);
    this.walk = null;
  }

  protected releaseWalkButton(): void {
    this.walkedByHold = this.walk?.moved ?? false;
    this.stopWalk();
  }

  protected tapStep(direction: number): void {
    // A long press already walked; its trailing click must not add a step.
    if (this.walkedByHold) {
      this.walkedByHold = false;
      return;
    }
    this.battle.moveActiveUnit(direction * STEP);
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    // Ignore input if in form field or modal
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }

    const active = this.battle.activeUnit();
    if (!active || !this.battle.canPlayerAct()) {
      return;
    }

    // Native controls own Enter/Space; handling them again here would double-cast.
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      event.target instanceof HTMLElement &&
      event.target.closest('button, a, [role="button"]')
    )
      return;

    if (this.battle.selectedAbility() && event.key.startsWith('Arrow')) {
      const targets = this.battle.validTargets();
      const index = targets.findIndex((target) => target.id === this.battle.targetedUnitId());
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const target = targets[(index + step + targets.length) % targets.length];
      if (target) {
        this.battle.targetedUnitId.set(target.id);
        document.getElementById(`unit-${target.id}`)?.focus();
      }
      event.preventDefault();
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        this.battle.moveActiveUnit(-STEP);
        this.startWalk(-1);
        event.preventDefault();
        break;
      case 'd':
      case 'arrowright':
        this.battle.moveActiveUnit(STEP);
        this.startWalk(1);
        event.preventDefault();
        break;
      case 'w':
      case 'arrowup':
        if (active.lane > 0) {
          this.battle.switchActiveUnitLane(active.lane - 1);
          event.preventDefault();
        }
        break;
      case 's':
      case 'arrowdown':
        if (active.lane < 2) {
          this.battle.switchActiveUnitLane(active.lane + 1);
          event.preventDefault();
        }
        break;
      case '1':
        if (active.classDef.abilities[0]) {
          this.onSelectAbility(active.classDef.abilities[0]);
        }
        break;
      case '2':
        if (active.classDef.abilities[1]) {
          this.onSelectAbility(active.classDef.abilities[1]);
        }
        break;
      case '3':
        if (active.classDef.abilities[2]) {
          this.onSelectAbility(active.classDef.abilities[2]);
        }
        break;
      case ' ':
      case 'enter':
        if (this.battle.selectedAbility()) {
          this.battle.executeSelectedAbility();
          event.preventDefault();
        }
        break;
      case 'e':
        this.battle.endCurrentTurn();
        event.preventDefault();
        break;
      case 'escape':
        this.cancelSelection();
        event.preventDefault();
        break;
    }
  }

  protected getUnitsInLane(lane: number): UnitInstance[] {
    return this.battle.units().filter((u) => u.lane === lane && u.isAlive);
  }

  protected getFloatingTextsFor(unitId: string): FloatingText[] {
    return this.battle.floatingTexts().filter((t) => t.targetId === unitId);
  }

  protected onSelectAbility(ability: AbilityDefinition): void {
    if (!this.battle.canPlayerAct()) return;
    if (this.battle.selectedAbilityId() === ability.id) {
      this.battle.selectAbility(null);
    } else {
      this.battle.selectAbility(ability.id);
      const target = this.battle.validTargets()[0];
      if (target) document.getElementById(`unit-${target.id}`)?.focus();
    }
  }

  protected onUnitClick(unit: UnitInstance): void {
    if (!this.battle.canPlayerAct()) return;
    const selectedAbility = this.battle.selectedAbility();
    if (!selectedAbility) return;

    const isValid = this.battle.validTargets().some((t) => t.id === unit.id);
    if (isValid) {
      this.battle.executeSelectedAbility(unit);
    }
  }

  protected isTargetable(unit: UnitInstance): boolean {
    return this.battle.canPlayerAct() && this.battle.validTargets().some((t) => t.id === unit.id);
  }

  protected hasAdvantage(unit: UnitInstance): boolean {
    const active = this.battle.activeUnit();
    return !!active && this.isTargetable(unit) && DamageCalculator.hasAdvantage(active, unit);
  }

  /** Matches the 'leader' defense priority: the first living member of each side. */
  protected isLeader(unit: UnitInstance): boolean {
    return this.battle.units().find((u) => u.team === unit.team && u.isAlive) === unit;
  }

  protected troopPips(team: Team): boolean[] {
    return this.battle
      .units()
      .filter((unit) => unit.team === team)
      .map((unit) => unit.isAlive);
  }

  protected spriteFor(unit: UnitInstance): string {
    const key = `${unit.classDef.id}:${unit.team}`;
    let url = this.sprites.get(key);
    if (!url) {
      url = spriteUrl(unit.classDef.id, unit.team);
      this.sprites.set(key, url);
    }
    return url;
  }

  protected cancelSelection(): void {
    const id = this.battle.selectedAbilityId();
    this.battle.selectAbility(null);
    if (id) document.getElementById(`ability-btn-${id}`)?.focus();
  }

  private cycleAbility(direction: number): void {
    const unit = this.battle.activeUnit()!;
    const choices = unit.classDef.abilities.filter(
      (ability) => ability.actionCost <= unit.actionGauge.current,
    );
    if (!choices.length) return;
    const index = choices.findIndex((ability) => ability.id === this.battle.selectedAbilityId());
    const next =
      index < 0
        ? direction > 0
          ? 0
          : choices.length - 1
        : (index + direction + choices.length) % choices.length;
    this.onSelectAbility(choices[next]);
  }

  protected restartBattle(): void {
    this.battle.initSkirmish();
  }

  protected toggleLog(): void {
    this.isLogOpen.update((v) => !v);
  }
}
