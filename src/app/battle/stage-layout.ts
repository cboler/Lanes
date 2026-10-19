import * as THREE from 'three';
import { CHARACTER_HEIGHT } from './stage-characters';

export const FIELD_WIDTH = 16;
export const LANE_GAP = 3.2;
export const HEAD_HEIGHT = CHARACTER_HEIGHT;
/** The classic side view, for a wide stage. */
export const WIDE_PITCH = THREE.MathUtils.degToRad(18);
const TALL_PITCH = THREE.MathUtils.degToRad(34);
export const FOV = 11;

/** How the stage is shot for its shape. */
export interface StageView {
  /** Camera tilt below the horizon. */
  readonly pitch: number;
  /** How large the figures (and their rings and shields) are drawn. */
  readonly figureScale: number;
}

/**
 * A wide stage keeps the side view. A tall, narrow one (a phone held upright) must fit
 * the whole field into its width, which leaves the figures small and the sky empty, so
 * it looks down more steeply to spread the lanes into that height and draws the figures
 * larger. Between the two, it blends.
 */
export function stageView(aspect: number): StageView {
  const tall = THREE.MathUtils.clamp((1.3 - aspect) / (1.3 - 0.9), 0, 1);
  return {
    pitch: THREE.MathUtils.lerp(WIDE_PITCH, TALL_PITCH, tall),
    figureScale: 1 + 0.5 * tall,
  };
}

export const worldX = (positionX: number): number => (positionX - 0.5) * FIELD_WIDTH;
export const laneZ = (lane: number): number => (lane - 1) * LANE_GAP;

export interface Frame {
  readonly target: THREE.Vector3;
  readonly distance: number;
}

/** Reserved screen fractions (0..1) that the framed points must stay out of. */
export interface SafeArea {
  readonly top: number;
  readonly bottom: number;
  readonly side: number;
}

const viewDirection = (pitch: number) => new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
const viewUp = (pitch: number) => new THREE.Vector3(0, Math.cos(pitch), -Math.sin(pitch));

export function placeCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  distance: number,
  pitch = WIDE_PITCH,
) {
  camera.position.copy(target).addScaledVector(viewDirection(pitch), distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/**
 * Finds the closest camera, at the fixed side-view pitch, that shows every point
 * inside the safe area, centred in it. Binary search is plenty for a few dozen points.
 */
export function fitFrame(
  camera: THREE.PerspectiveCamera,
  points: readonly THREE.Vector3[],
  safe: SafeArea,
  /** Share of any spare height that goes below the points (0.5 = centred). */
  lowerShare = 0.35,
  pitch = WIDE_PITCH,
): Frame {
  const box = new THREE.Box3().setFromPoints([...points]);
  const target = box.getCenter(new THREE.Vector3());
  const limits = { left: -1 + 2 * safe.side, right: 1 - 2 * safe.side };
  const top = 1 - 2 * safe.top;
  const bottom = -1 + 2 * safe.bottom;
  const probe = new THREE.Vector3();
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const measure = (distance: number) => {
    placeCamera(camera, target, distance, pitch);
    bounds.minX = bounds.minY = Infinity;
    bounds.maxX = bounds.maxY = -Infinity;
    for (const point of points) {
      probe.copy(point).project(camera);
      bounds.minX = Math.min(bounds.minX, probe.x);
      bounds.maxX = Math.max(bounds.maxX, probe.x);
      bounds.minY = Math.min(bounds.minY, probe.y);
      bounds.maxY = Math.max(bounds.maxY, probe.y);
    }
    return (
      bounds.maxX - bounds.minX <= limits.right - limits.left &&
      bounds.maxY - bounds.minY <= top - bottom
    );
  };

  let distance = 60;
  for (let pass = 0; pass < 3; pass++) {
    let near = 4;
    let far = 400;
    for (let step = 0; step < 28; step++) {
      const mid = (near + far) / 2;
      if (measure(mid)) far = mid;
      else near = mid;
    }
    distance = far;
    measure(distance);
    // Re-centre: shift the look-at point by the projected offset from the safe centre.
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfWidth = halfHeight * camera.aspect;
    target.x += ((bounds.minX + bounds.maxX) / 2 - (limits.left + limits.right) / 2) * halfWidth;
    const slack = Math.max(0, top - bottom - (bounds.maxY - bounds.minY));
    const wantedCentre = bottom + (bounds.maxY - bounds.minY) / 2 + slack * lowerShare;
    target.addScaledVector(
      viewUp(pitch),
      ((bounds.minY + bounds.maxY) / 2 - wantedCentre) * halfHeight,
    );
  }
  return { target, distance };
}
