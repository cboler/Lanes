import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import {
  BattleStateService,
  FloatingText,
  IMPACT_DELAY_MS,
} from '../core/services/battle-state.service';
import { AIM_ZONES, CHAIN_WINDOW, executionKind, justWindow } from '../core/engine/execution';
import { ASSIST_COST } from '../core/engine/assist';
import { needsReach } from '../core/engine/field';
import { Team, UnitInstance } from '../core/models/unit-instance.model';
import { AbilityDefinition } from '../core/models/ability.model';
import { BattleStageComponent } from './battle-stage.component';
import { spriteUrl } from './sprite-art';
import { GamepadService } from '../core/services/gamepad.service';
import { RosterService } from '../core/services/roster.service';
import { GuildService } from '../core/services/guild.service';
import { CampaignService, MissionReward } from '../core/services/campaign.service';
import { OverworldService } from '../core/services/overworld.service';
import { Contract, TIERS } from '../core/models/contract.model';
import { ItemId, itemName } from '../core/models/item.model';
import { FieldTrap, TRAP_NAMES } from '../core/models/field-object.model';
import { BattleRewards } from '../core/models/progression.model';
import { StatusEffectType } from '../core/models/status-effect.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DamageCalculator } from '../core/engine/damage-calculator';
import { CombatExecutor } from '../core/engine/combat-executor';

const STATUS_BADGES: Record<StatusEffectType, (potency: number) => string> = {
  stun: () => '💫 STUN',
  poison: () => '☠ POISON',
  'attack-up': (p) => `▲ ATK+${p}`,
  'attack-down': (p) => `▼ ATK-${p}`,
  'defense-up': (p) => `▲ DEF+${p}`,
  'defense-down': (p) => `▼ DEF-${p}`,
};

/** One tap of a move key or button, in battlefield widths. */
const STEP = 0.04;
/** Holding a move key or button walks continuously, like Grand Kingdom's analog movement. */
const WALK_SPEED = 0.3;
const HOLD_DELAY_MS = 200;
const WALK_KEYS = ['a', 'd', 'arrowleft', 'arrowright'];

/** How the player is playing right now, so hints name the right buttons. */
type InputMode = 'keys' | 'touch' | 'pad';
/** One piece of a controls hint: the keys (or buttons) and what they do. */
interface HintPart {
  readonly keys: readonly string[];
  readonly label: string;
}

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, BattleStageComponent],
  templateUrl: './battlefield.component.html',
  styleUrls: [
    './battlefield.component.scss',
    './battlefield-execution.scss',
    './battlefield-layout.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlefieldComponent implements OnInit, OnDestroy {
  protected readonly battle = inject(BattleStateService);
  private readonly roster = inject(RosterService);
  private readonly document = inject(DOCUMENT);
  protected readonly pad = inject(GamepadService);
  private readonly guild = inject(GuildService);
  private readonly campaign = inject(CampaignService);
  private readonly overworld = inject(OverworldService);
  protected readonly isLogOpen = signal(false);
  protected readonly menuOpen = signal(false);
  private readonly inputMode = signal<InputMode>(
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys',
  );
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

  private readonly aimFire = viewChild<ElementRef<HTMLButtonElement>>('aimFire');

  /*
   * The aim track and combo meter are CSS animations started from the service's clock.
   * Each is computed once per aim or combo, and rendered through a one-item list keyed on
   * its start time, so a new aim or chain restarts the animation instead of shifting it.
   */
  protected readonly aimView = computed(() => {
    const aim = this.battle.aim();
    if (!aim) return [];
    const ability = untracked(this.battle.activeUnit)?.abilities.find(
      (a) => a.id === aim.abilityId,
    );
    return [
      {
        key: aim.startedAt,
        name: ability?.name ?? '',
        style: {
          '--aim-center': aim.center,
          '--aim-critical': AIM_ZONES.critical,
          '--aim-hit': AIM_ZONES.hit,
          '--aim-graze': AIM_ZONES.graze,
          '--sweep-ms': `${aim.sweepMs}ms`,
          '--sweep-delay': `${-(performance.now() - aim.startedAt)}ms`,
        },
      },
    ];
  });

  protected readonly comboView = computed(() => {
    const combo = this.battle.combo();
    if (!combo) return [];
    const close = CHAIN_WINDOW.close;
    const elapsed = performance.now() - combo.openedAt;
    const attacker = untracked(this.battle.units).find((u) => u.id === combo.attackerId);
    const { justFrom, justTo } = justWindow(attacker?.supports);
    return [
      {
        key: combo.openedAt,
        count: combo.count,
        style: {
          '--chain-open': CHAIN_WINDOW.open / close,
          '--just-from': justFrom / close,
          '--just-to': justTo / close,
          '--sweep-ms': `${close * combo.speed}ms`,
          '--sweep-delay': `${-elapsed}ms`,
          '--flash-ms': `${(justTo - justFrom) * combo.speed}ms`,
          '--flash-delay': `${justFrom * combo.speed - elapsed}ms`,
        },
      },
    ];
  });

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

  /** The assist panel: allies who could answer a call, while an orb is ready. */
  protected readonly assistOpen = signal(false);
  protected readonly assistShown = computed(
    () => this.assistOpen() && this.battle.assistOptions().length > 0,
  );

  /** A contextual panel (targeting, aim, combo, assist) is open; it carries its own hint. */
  protected readonly panelShown = computed(
    () =>
      !!this.battle.aim() ||
      !!this.battle.combo() ||
      this.assistShown() ||
      !!this.battle.selectedAbility(),
  );

  /** What the controls do right now, for the corner hint, in the player's own input. */
  protected readonly hint = computed<HintPart[]>(() => {
    if (!this.battle.canPlayerAct()) return [];
    const mode: InputMode = this.pad.connected() ? 'pad' : this.inputMode();
    const pick = (keys: HintPart[], touch: HintPart[], pad: HintPart[]) =>
      mode === 'pad' ? pad : mode === 'touch' ? touch : keys;
    if (this.battle.aim()) {
      return pick(
        [{ keys: ['Click', 'Space'], label: 'fire on the gold' }],
        [{ keys: [], label: 'Tap anywhere to fire on the gold' }],
        [{ keys: ['A'], label: 'fire on the gold' }],
      );
    }
    if (this.battle.combo()) {
      return pick(
        [
          { keys: ['Click', 'Enter'], label: 'strike again on the flash' },
          { keys: ['1–5'], label: 'chain a skill' },
        ],
        [{ keys: [], label: 'Tap again on the flash to chain' }],
        [
          { keys: ['A'], label: 'strike again on the flash' },
          { keys: ['LB', 'RB'], label: 'chain a skill' },
        ],
      );
    }
    if (this.assistShown()) {
      return pick(
        [
          { keys: ['1–4'], label: 'call an ally' },
          { keys: ['Q'], label: 'close' },
        ],
        [{ keys: [], label: 'Tap an ally to call' }],
        [
          { keys: ['A'], label: 'call an ally' },
          { keys: ['B'], label: 'close' },
        ],
      );
    }
    if (this.battle.selectedAbility()) {
      return pick(
        [
          { keys: ['←', '→'], label: 'target' },
          { keys: ['Enter'], label: 'confirm' },
          { keys: ['Esc'], label: 'cancel' },
        ],
        [{ keys: [], label: 'Tap a target, then Confirm' }],
        [
          { keys: ['D-pad'], label: 'target' },
          { keys: ['A'], label: 'confirm' },
          { keys: ['B'], label: 'cancel' },
        ],
      );
    }
    const assist = this.battle.assistOptions().length > 0;
    return pick(
      [
        { keys: ['A', 'D'], label: 'walk' },
        { keys: ['W', 'S'], label: 'lane' },
        { keys: ['1–5'], label: 'skills' },
        { keys: ['Click'], label: 'a foe to target it' },
        ...(assist ? [{ keys: ['Q'], label: 'assist' }] : []),
        { keys: ['E'], label: 'guard & end' },
      ],
      [
        { keys: ['◀', '▶'], label: 'hold to walk' },
        { keys: [], label: 'tap a foe twice to attack' },
      ],
      [
        { keys: ['LT', 'RT'], label: 'walk' },
        { keys: ['R-stick'], label: 'lane' },
        { keys: ['LB', 'RB'], label: 'skills' },
        ...(assist ? [{ keys: ['Y'], label: 'assist' }] : []),
        { keys: ['X'], label: 'guard & end' },
      ],
    );
  });

  /** Gold and EXP paid for the battle that just ended. */
  protected readonly rewards = signal<BattleRewards | null>(null);
  /** A story mission's first-win bonus, when this battle earned it. */
  protected readonly storyReward = signal<MissionReward | null>(null);
  /** A story mission won: the verdict leads on to its aftermath. */
  protected readonly storyWon = computed(
    () => this.battle.battleStatus() === 'victory' && !!this.battle.activeContract()?.missionId,
  );
  /** A map squad (story or patrol) is beaten: the journey goes on, there is nothing to refight. */
  protected readonly mapWon = computed(
    () =>
      this.storyWon() ||
      (this.battle.battleStatus() === 'victory' &&
        !!this.battle.activeContract()?.id?.startsWith('overworld:')),
  );
  protected readonly leveledUp = computed(
    () => !!this.rewards()?.mercenaries.some((merc) => merc.levelsGained > 0),
  );

  constructor() {
    // Enter, Space and a controller's A all press the focused control, so give it the fire button.
    effect(() => this.aimFire()?.nativeElement.focus());
    // The roster pays each report once, so coming back to the result screen shows, not repays.
    effect(() => {
      const report = this.battle.battleReport();
      this.rewards.set(report ? untracked(() => this.roster.claimRewards(report)) : null);
      if (report?.contractId?.startsWith('overworld:') || report?.missionId) {
        untracked(() =>
          this.overworld.resolve(
            report.contractId ?? `mission_${report.missionId}`,
            report.outcome === 'victory',
          ),
        );
      }
      // A won contract leaves the board; a lost one stays up for another try.
      if (report?.contractId && report.outcome === 'victory') {
        untracked(() => {
          const won = this.guild.complete(report.contractId!);
          if (won?.bounty) this.roster.grant(0, [won.bounty]);
        });
      }
      this.storyReward.set(
        report?.missionId && report.outcome === 'victory'
          ? untracked(() => this.campaign.complete(report.missionId!, report.id))
          : null,
      );
    });
    // Controller focus: where a controller player needs to be when something opens or a turn starts.
    effect(() => {
      if (this.battle.battleStatus() === 'active') return;
      const choice = this.storyWon()
        ? '#modal-story-btn'
        : this.mapWon()
          ? '#modal-overworld-btn'
          : '#modal-restart-btn';
      setTimeout(() => this.focusFor(choice));
    });
    effect(() => {
      const active = this.battle.activeUnitId();
      if (!active || !untracked(this.battle.canPlayerAct) || !untracked(this.pad.connected)) return;
      setTimeout(() => this.focusFor('.skill-btn:not(:disabled)'));
    });
    this.pad.actions.pipe(takeUntilDestroyed()).subscribe((action) => {
      // Utility buttons work on any turn.
      if (action === 'toggle-log') return this.toggleLog();
      if (action === 'menu') {
        this.menuOpen.set(true);
        setTimeout(() => this.focusFor('#battle-menu .hud-menu-item'));
        return;
      }
      if (action === 'cancel' && this.menuOpen()) return this.closeMenu();
      if (action === 'walk-stop') return this.stopWalk();
      if (!this.battle.canPlayerAct()) return;
      const unit = this.battle.activeUnit()!;
      switch (action) {
        case 'cancel':
          if (this.assistOpen()) this.assistOpen.set(false);
          else this.cancelSelection();
          break;
        case 'end-turn':
          this.battle.endCurrentTurn();
          break;
        case 'assist':
          this.toggleAssist();
          break;
        case 'walk-left':
        case 'walk-right': {
          // Like holding A or D: a step now, then a steady walk while the trigger is held.
          const direction = action === 'walk-left' ? -1 : 1;
          this.battle.moveActiveUnit(direction * STEP);
          this.startWalk(direction);
          break;
        }
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
    // The game screen fills the window instead of scrolling; see styles.scss.
    this.document.body.classList.add('battle-screen');
    if (this.battle.units().length === 0) {
      // A refresh restarts a saved map encounter against that same squad, not a skirmish.
      const encounter = this.overworld.contract();
      if (encounter) this.battle.deployContract(encounter, this.roster.squad());
      else this.battle.deployMercenaries(this.roster.squad());
    } else {
      this.battle.resume();
    }
  }

  public ngOnDestroy(): void {
    this.document.body.classList.remove('battle-screen');
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

  /**
   * While aiming, a press anywhere fires: the timing is the point, not where the cursor
   * is. During a combo, a press on open ground strikes again, as pressing the target does.
   */
  @HostListener('window:pointerdown', ['$event'])
  public handlePointerdown(event: PointerEvent): void {
    this.inputMode.set(event.pointerType === 'touch' ? 'touch' : 'keys');
    const target = event.target instanceof Element ? event.target : null;
    if (this.menuOpen() && !target?.closest('.hud-system')) this.menuOpen.set(false);
    if (event.button > 0 || !this.battle.canPlayerAct()) return;
    if (target?.closest('.hud-system, .battle-result-overlay, dialog')) return;
    if (this.battle.aim()) {
      this.battle.fireAim();
      return;
    }
    const combo = this.battle.combo();
    if (combo && target?.closest('.arena-viewport') && !target.closest('button')) {
      this.battle.chainAbility(combo.abilityId);
    }
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.focusFor('#battle-menu-btn');
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
    this.inputMode.set('keys');
    if (event.key === 'Escape' && this.menuOpen()) {
      this.closeMenu();
      event.preventDefault();
      return;
    }
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

    // While aiming, Space and Enter fire wherever focus is. Firing twice is harmless.
    if (this.battle.aim()) {
      if (event.key === ' ' || event.key === 'Enter') {
        this.battle.fireAim();
        event.preventDefault();
      }
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

    if (this.assistShown()) {
      const options = this.battle.assistOptions();
      const pick = Number(event.key);
      if (pick >= 1 && pick <= options.length) {
        this.callAssist(options[pick - 1].ally.id);
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'q') {
        this.assistOpen.set(false);
        event.preventDefault();
        return;
      }
    }

    switch (event.key.toLowerCase()) {
      case 'q':
        this.toggleAssist();
        event.preventDefault();
        break;
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
      case '2':
      case '3':
      case '4':
      case '5': {
        const ability = active.abilities[Number(event.key) - 1];
        if (ability) this.onSelectAbility(ability);
        break;
      }
      case ' ':
      case 'enter':
        if (this.battle.selectedAbility()) {
          this.battle.commitSelectedAbility();
          event.preventDefault();
        } else if (this.battle.combo()) {
          this.battle.chainAbility(this.battle.combo()!.abilityId);
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

  /**
   * The living units in a lane, plus any just felled whose numbers are still floating: the
   * killing blow's damage shows over the falling body instead of vanishing with it.
   */
  protected getUnitsInLane(lane: number): UnitInstance[] {
    const floating = new Set(this.battle.floatingTexts().map((text) => text.targetId));
    return this.battle.units().filter((u) => u.lane === lane && (u.isAlive || floating.has(u.id)));
  }

  protected getFloatingTextsFor(unitId: string): FloatingText[] {
    return this.battle.floatingTexts().filter((t) => t.targetId === unitId);
  }

  protected onSelectAbility(ability: AbilityDefinition): void {
    if (!this.battle.canPlayerAct()) return;
    if (this.battle.combo() && this.battle.chainAbility(ability.id)) return;
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
    if (this.battle.aim()) {
      this.battle.fireAim();
      return;
    }
    const combo = this.battle.combo();
    // Pressing the target again repeats the last melee skill as the next link.
    if (combo && unit.id === combo.targetId) {
      this.battle.chainAbility(combo.abilityId);
      return;
    }
    // A second press on the aimed-at target attacks it.
    if (this.battle.selectedAbility() && this.battle.validTargets().some((t) => t.id === unit.id)) {
      this.battle.commitSelectedAbility(unit);
      return;
    }
    // A press on a foe nothing is aimed at yet takes the first affordable skill that reaches it.
    const active = this.battle.activeUnit()!;
    if (unit.team === active.team || !unit.isAlive) return;
    const ability = active.abilities.find(
      (a) =>
        a.actionCost <= active.actionGauge.current &&
        a.target.includes('enem') &&
        CombatExecutor.getValidTargets(active, a, this.battle.units()).includes(unit),
    );
    if (ability) {
      this.battle.selectAbility(ability.id);
      this.battle.targetedUnitId.set(unit.id);
    }
  }

  /** Short badges for a unit's active statuses, e.g. "STUN" or "DEF-15". */
  protected statusBadges(unit: UnitInstance): { key: string; text: string; harmful: boolean }[] {
    return unit.statusEffects
      .filter((effect) => !effect.isExpired)
      .map((effect) => ({
        key: effect.type,
        text: STATUS_BADGES[effect.type](effect.potency),
        harmful: ['stun', 'poison', 'attack-down', 'defense-down'].includes(effect.type),
      }));
  }

  /** How full each of a side's three assist orbs is, 0 to 1. */
  protected orbs(team: Team): number[] {
    const gauge = this.battle.assistGauge()[team];
    return [0, 1, 2].map((i) => Math.min(1, Math.max(0, gauge / ASSIST_COST - i)));
  }

  protected readyOrbs(): number {
    return Math.floor(this.battle.assistGauge().player / ASSIST_COST);
  }

  protected toggleAssist(): void {
    if (!this.battle.assistOptions().length) return;
    const open = !this.assistOpen();
    if (open) this.battle.selectAbility(null);
    this.assistOpen.set(open);
    // Whoever opened it (Q, Y or a tap) can pick an ally straight away.
    if (open) setTimeout(() => this.focusFor('.assist-options button'));
  }

  /** Focuses the first match, with the controller highlight when a controller is in use. */
  private focusFor(selector: string): void {
    const element = this.document.querySelector<HTMLElement>(selector);
    if (this.pad.connected()) this.pad.focus(element);
    else element?.focus();
  }

  protected callAssist(allyId: string): void {
    this.assistOpen.set(false);
    this.battle.callAssist(allyId);
  }

  protected itemName(item: ItemId): string {
    return itemName(item);
  }

  protected tierLabel(contract: Contract): string {
    return TIERS[contract.tier].label;
  }

  /** A melee skill with nobody in reach: the player has to walk closer first. */
  protected outOfReach(ability: AbilityDefinition): boolean {
    const active = this.battle.activeUnit();
    return !!active && needsReach(active, ability) && this.battle.validTargets().length === 0;
  }

  protected trapsInLane(lane: number): FieldTrap[] {
    return this.battle.traps().filter((trap) => trap.lane === lane);
  }

  protected trapName(trap: FieldTrap): string {
    return TRAP_NAMES[trap.kind];
  }

  protected isAimTarget(unit: UnitInstance): boolean {
    return !!this.battle.aim()?.targetIds.includes(unit.id);
  }

  /** Skills that can be pressed now to extend the open combo. */
  protected canChain(ability: AbilityDefinition): boolean {
    const active = this.battle.activeUnit();
    return (
      !!active &&
      !!this.battle.combo() &&
      executionKind(active, ability) === 'combo' &&
      ability.actionCost <= active.actionGauge.current
    );
  }

  protected isTargetable(unit: UnitInstance): boolean {
    return this.battle.canPlayerAct() && this.battle.validTargets().some((t) => t.id === unit.id);
  }

  /**
   * What the selected skill would do to this target at normal power: the HP it takes
   * (after Guard), "KO" when that fells it, or the HP it heals. Nothing for pure buffs.
   */
  protected preview(unit: UnitInstance): { text: string; heal: boolean; ko: boolean } | null {
    const active = this.battle.activeUnit();
    const ability = this.battle.selectedAbility();
    if (!active || !ability || ability.powerMultiplier === 0 || !this.isTargetable(unit)) {
      return null;
    }
    const amount = DamageCalculator.calculateWithDefense(active, unit, ability);
    if (ability.damageType === 'healing') {
      return { text: `+${Math.min(amount, unit.maxHp - unit.currentHp)}`, heal: true, ko: false };
    }
    const lost = Math.max(0, amount - unit.guardPoints);
    return lost >= unit.currentHp
      ? { text: 'KO', heal: false, ko: true }
      : { text: `−${lost}`, heal: false, ko: false };
  }

  protected hasAdvantage(unit: UnitInstance): boolean {
    const active = this.battle.activeUnit();
    return !!active && this.isTargetable(unit) && DamageCalculator.hasAdvantage(active, unit);
  }

  /** Matches the 'leader' defense priority: the first living member of each side. */
  protected isLeader(unit: UnitInstance): boolean {
    return (
      this.battle.units().find((u) => u.team === unit.team && u.isAlive && !u.isObject) === unit
    );
  }

  protected troopPips(team: Team): boolean[] {
    return this.battle
      .units()
      .filter((unit) => unit.team === team && !unit.isObject)
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
    const choices = unit.abilities.filter(
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
    this.battle.refreshMercenaries(this.roster.mercenaries());
    this.battle.initSkirmish();
  }

  protected toggleLog(): void {
    this.isLogOpen.update((v) => !v);
  }
}
