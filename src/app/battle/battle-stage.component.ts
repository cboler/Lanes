import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { BattleStateService, IMPACT_DELAY_MS } from '../core/services/battle-state.service';
import type { Stage, StageState } from './stage-scene';

/** Must match the attributes stage-scene requests; a canvas keeps its first context. */
const STAGE_CONTEXT: WebGLContextAttributes = { antialias: true };

export type StageRenderer = 'pending' | 'webgl' | 'fallback';

/**
 * Hosts the Three.js battle stage. The scene module (and three itself) load
 * lazily; without WebGL the battlefield falls back to plain DOM sprites.
 */
@Component({
  selector: 'app-battle-stage',
  standalone: true,
  template: '<canvas #canvas></canvas>',
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      pointer-events: none;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      visibility: hidden;
    }

    :host([data-renderer='webgl']) canvas {
      visibility: visible;
    }
  `,
  host: { 'aria-hidden': 'true', '[attr.data-renderer]': 'renderer()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattleStageComponent {
  /** The layer of unit buttons that the stage keeps aligned with their sprites. */
  public readonly overlay = input.required<HTMLElement>();
  public readonly renderer = signal<StageRenderer>('pending');

  private readonly battle = inject(BattleStateService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private stage: Stage | null = null;
  private playedSeq = 0;

  constructor() {
    afterNextRender(() => void this.start());
    this.destroyRef.onDestroy(() => this.stop());
    effect(() => {
      const state = this.state();
      this.stage?.sync(state);
    });
    effect(() => {
      const action = this.battle.lastAction();
      if (!action || action.seq <= this.playedSeq) return;
      this.playedSeq = action.seq;
      this.stage?.play(action);
    });
  }

  private async start(): Promise<void> {
    this.playedSeq = this.battle.lastAction()?.seq ?? 0;
    // Probe quietly first: a failed attempt inside three logs console errors, and
    // devices without WebGL2 should not download the scene chunk at all.
    if (
      typeof WebGL2RenderingContext === 'undefined' ||
      typeof ResizeObserver === 'undefined' ||
      !this.canvas().nativeElement.getContext('webgl2', STAGE_CONTEXT)
    ) {
      this.renderer.set('fallback');
      return;
    }
    // A stalled GPU or chunk download must not leave the battlefield blank.
    const timeout = setTimeout(() => this.fallBack(), 8000);
    try {
      const { createStage } = await import('./stage-scene');
      if (this.destroyRef.destroyed || this.renderer() === 'fallback') return;
      const stage = await createStage({
        canvas: this.canvas().nativeElement,
        overlay: this.overlay(),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onLost: () => this.fallBack(),
      });
      if (this.destroyRef.destroyed || this.renderer() === 'fallback') {
        stage.dispose();
        return;
      }
      this.stage = stage;
      stage.sync(this.state());
      this.renderer.set('webgl');
    } catch {
      this.fallBack();
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallBack(): void {
    this.stop();
    this.renderer.set('fallback');
  }

  private stop(): void {
    this.stage?.dispose();
    this.stage = null;
  }

  private state(): StageState {
    const battle = this.battle;
    const units = battle.units();
    const active = battle.activeUnit();
    const ability = battle.selectedAbility();
    const controllable = battle.canPlayerAct() && !!active;
    const targets = controllable && ability ? battle.validTargets() : [];
    const speed = battle.delayMultiplier;
    return {
      units: units.map((unit) => ({
        id: unit.id,
        classId: unit.classDef.id,
        team: unit.team,
        lane: unit.lane,
        x: unit.positionX,
        alive: unit.isAlive,
        guard: unit.guardPoints,
        buffed: unit.hasEffect('defense-up'),
      })),
      activeId: active?.id ?? null,
      moveRange: controllable && !ability ? battle.reachableSpan(active) : null,
      targets: [
        ...targets.map((unit) => ({
          id: unit.id,
          tone: unit.team === active?.team ? ('ally' as const) : ('enemy' as const),
        })),
        ...(controllable ? battle.friendlyFireRisk() : []).map((unit) => ({
          id: unit.id,
          tone: 'risk' as const,
        })),
      ],
      focusedId: ability ? battle.targetedUnitId() : null,
      areaLanes:
        controllable && ability?.target === 'same-lane-enemies'
          ? [active.lane]
          : controllable && ability?.target === 'all-enemies'
            ? [0, 1, 2]
            : [],
      speed,
      impactDelay: (IMPACT_DELAY_MS / 1000) * speed,
    };
  }
}
