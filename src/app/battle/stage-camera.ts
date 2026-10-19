import * as THREE from 'three';
import {
  fitFrame,
  HEAD_HEIGHT,
  laneZ,
  placeCamera,
  worldX,
  stageView,
  type Frame,
  type SafeArea,
  type StageView,
} from './stage-layout';
import type { StageState } from './stage-types';

export interface CameraDirector {
  /** Call when the canvas changes size; follow with reframe(state, true). */
  resize(width: number, height: number): void;
  /** Re-fits the shot when the living units' layout changed (or always, if forced). */
  reframe(state: StageState | null, force?: boolean): void;
  /** Eases toward the framed shot. Returns true while the camera is still moving. */
  update(dt: number): boolean;
  /** Kicks the camera; the biggest recent shake wins. */
  addShake(amount: number): void;
  /** Nudges the camera in for one frame, for impacts. */
  addPunch(amount: number): void;
  /** How large figures are drawn for the current stage shape. */
  figureScale(): number;
}

export function createCameraDirector(
  camera: THREE.PerspectiveCamera,
  fog: THREE.Fog,
  overlay: HTMLElement,
  random: () => number,
  reducedMotion: boolean,
): CameraDirector {
  let width = 1;
  let height = 1;
  let safe: SafeArea = { top: 0.12, bottom: 0.12, side: 0.03 };
  let view: StageView = stageView(16 / 9);
  let desired: Frame = { target: new THREE.Vector3(0, 0.8, 0), distance: 40 };
  const current = { target: new THREE.Vector3(0, 0.8, 0), distance: 40 };
  let snapCamera = true;
  let punch = 0;
  let shake = 0;
  let framedFor = '';

  const readSafeArea = () => {
    const style = getComputedStyle(overlay);
    const px = (name: string, fallback: number) =>
      parseFloat(style.getPropertyValue(name)) || fallback;
    safe = {
      top: Math.min(0.4, px('--stage-safe-top', 56) / height),
      bottom: Math.min(0.4, px('--stage-safe-bottom', 24) / height),
      side: Math.min(0.2, Math.max(16, width * 0.025) / width),
    };
  };

  return {
    resize: (w, h) => {
      width = w;
      height = h;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      view = stageView(camera.aspect);
      readSafeArea();
      snapCamera = true;
    },

    reframe: (state, force = false) => {
      if (!state) return;
      // Re-fit only when the framed layout changes meaningfully, not on every walk step.
      const layout = state.units
        .filter((unit) => unit.alive)
        .map((unit) => `${unit.lane}:${Math.round(unit.x * 50)}`)
        .join();
      if (!force && layout === framedFor) return;
      framedFor = layout;
      const points: THREE.Vector3[] = [];
      const scale = view.figureScale;
      const reach = (x: number, z: number) => {
        points.push(
          new THREE.Vector3(x - 1.05 * scale, 0, z + 0.35),
          new THREE.Vector3(x + 1.05 * scale, 0, z + 0.35),
          // Leave room above heads for the name and HP plates.
          new THREE.Vector3(x, HEAD_HEIGHT * scale + 0.75, z),
        );
      };
      // A minimum field keeps the camera from zooming onto a lone survivor.
      reach(-5.5, laneZ(0));
      reach(5.5, laneZ(2));
      for (const unit of state.units) if (unit.alive) reach(worldX(unit.x), laneZ(unit.lane));
      desired = fitFrame(camera, points, safe, undefined, view.pitch);
    },

    update: (dt) => {
      const moving =
        current.target.distanceToSquared(desired.target) > 1e-4 ||
        Math.abs(current.distance - desired.distance) > 0.01;
      const k = snapCamera ? 1 : 1 - Math.exp(-dt * (reducedMotion ? 30 : 3.2));
      snapCamera = false;
      current.target.lerp(desired.target, k);
      current.distance += (desired.distance - current.distance) * k;
      const target = current.target.clone();
      let distance = current.distance;
      distance *= 1 - punch;
      punch = 0;
      placeCamera(camera, target, distance, view.pitch);
      fog.near = distance + 4;
      fog.far = distance + 60;
      if (shake > 0.001 && !reducedMotion) {
        camera.position.x += (random() - 0.5) * shake;
        camera.position.y += (random() - 0.5) * shake;
        shake *= Math.exp(-dt * 12);
      }
      camera.updateMatrixWorld();
      return moving;
    },

    addShake: (amount) => (shake = Math.max(shake, amount)),
    addPunch: (amount) => (punch = Math.max(punch, amount)),
    figureScale: () => view.figureScale,
  };
}
