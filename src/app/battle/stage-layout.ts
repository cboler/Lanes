import * as THREE from 'three';
import { CHARACTER_HEIGHT } from './stage-characters';

export const FIELD_WIDTH = 16;
export const LANE_GAP = 3.2;
export const HEAD_HEIGHT = CHARACTER_HEIGHT;
const PITCH = THREE.MathUtils.degToRad(18);
export const FOV = 11;

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

const VIEW_DIRECTION = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
const VIEW_UP = new THREE.Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));

export function placeCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  distance: number,
) {
  camera.position.copy(target).addScaledVector(VIEW_DIRECTION, distance);
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
): Frame {
  const box = new THREE.Box3().setFromPoints([...points]);
  const target = box.getCenter(new THREE.Vector3());
  const limits = { left: -1 + 2 * safe.side, right: 1 - 2 * safe.side };
  const top = 1 - 2 * safe.top;
  const bottom = -1 + 2 * safe.bottom;
  const probe = new THREE.Vector3();
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const measure = (distance: number) => {
    placeCamera(camera, target, distance);
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
    target.addScaledVector(VIEW_UP, ((bounds.minY + bounds.maxY) / 2 - wantedCentre) * halfHeight);
  }
  return { target, distance };
}
