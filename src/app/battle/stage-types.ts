import type { PerspectiveCamera, Scene } from 'three';
import type { StageAssets } from './stage-assets';

export interface StageUnit {
  readonly id: string;
  readonly classId: string;
  readonly team: 'player' | 'enemy';
  readonly lane: number;
  readonly x: number;
  readonly alive: boolean;
  readonly guard: number;
  readonly buffed: boolean;
}

export interface StageState {
  readonly units: readonly StageUnit[];
  readonly activeId: string | null;
  /** Reachable positionX span for the controllable active unit. */
  readonly moveRange: { readonly from: number; readonly to: number } | null;
  readonly targets: readonly { readonly id: string; readonly tone: 'enemy' | 'ally' | 'risk' }[];
  readonly focusedId: string | null;
  /** Lanes covered by the selected area skill. */
  readonly areaLanes: readonly number[];
  /** Animation time scale: 1 at normal speed, smaller when faster. */
  readonly speed: number;
  /** Seconds after an action starts that its hits land (matches the DOM numbers). */
  readonly impactDelay: number;
}

export interface StageAction {
  readonly attackerId: string;
  readonly abilityId: string;
  readonly effects: readonly {
    readonly targetId: string;
    readonly isHealing: boolean;
    readonly guardAbsorbed: number;
    readonly wasDefeated: boolean;
    /** The shot landed beside the target: it kicks up dirt and nobody flinches. */
    readonly missed?: boolean;
  }[];
}

export interface Stage {
  sync(state: StageState): void;
  play(action: StageAction): void;
  dispose(): void;
}

export interface StageOptions {
  readonly canvas: HTMLCanvasElement;
  /** Holds one element per unit, marked with data-unit-id, laid over its sprite. */
  readonly overlay: HTMLElement;
  readonly reducedMotion: boolean;
  readonly onLost: () => void;
}

/** What every stage module needs: the scene to draw into and the shared assets. */
export interface StageContext {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly assets: StageAssets;
  /** One seeded generator for the whole stage, so scenery and effects replay the same. */
  readonly random: () => number;
  readonly reducedMotion: boolean;
}
