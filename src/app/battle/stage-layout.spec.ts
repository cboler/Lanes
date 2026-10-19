import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  FIELD_WIDTH,
  WIDE_PITCH,
  fitFrame,
  laneZ,
  placeCamera,
  stageView,
  worldX,
} from './stage-layout';

describe('stage layout', () => {
  it('maps the battlefield onto the stage: player left, lane I furthest back', () => {
    expect(worldX(0)).toBe(-FIELD_WIDTH / 2);
    expect(worldX(1)).toBe(FIELD_WIDTH / 2);
    expect(laneZ(0)).toBeLessThan(laneZ(1));
    expect(laneZ(1)).toBe(0);
    expect(laneZ(2)).toBeGreaterThan(laneZ(1));
  });
});

describe('fitFrame', () => {
  const points = [
    new Vector3(worldX(0.05) - 1, 0, laneZ(2)),
    new Vector3(worldX(0.95) + 1, 0, laneZ(2)),
    new Vector3(worldX(0.05) - 1, 2.4, laneZ(0)),
    new Vector3(worldX(0.95) + 1, 2.4, laneZ(0)),
  ];
  const safe = { top: 0.14, bottom: 0.12, side: 0.03 };

  for (const aspect of [0.7, 1.4, 2.6]) {
    it(`frames every point inside the safe area at aspect ${aspect}`, () => {
      const camera = new PerspectiveCamera(11, aspect, 0.5, 400);
      const frame = fitFrame(camera, points, safe);
      placeCamera(camera, frame.target, frame.distance);
      const projected = points.map((point) => point.clone().project(camera));
      const margin = 0.01;
      for (const point of projected) {
        expect(point.x).toBeGreaterThanOrEqual(-1 + 2 * safe.side - margin);
        expect(point.x).toBeLessThanOrEqual(1 - 2 * safe.side + margin);
        expect(point.y).toBeGreaterThanOrEqual(-1 + 2 * safe.bottom - margin);
        expect(point.y).toBeLessThanOrEqual(1 - 2 * safe.top + margin);
      }
      // Tight: the binding dimension is (almost) filled, so units are as large as they can be.
      const width = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x));
      const height =
        Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
      expect(
        Math.max(width / (2 - 4 * safe.side), height / (2 - 2 * (safe.top + safe.bottom))),
      ).toBeGreaterThan(0.97);
    });
  }

  it('keeps the side view on a wide stage, and looks down with larger figures on a tall one', () => {
    expect(stageView(16 / 9)).toEqual({ pitch: WIDE_PITCH, figureScale: 1 });
    const tall = stageView(0.6);
    expect(tall.pitch).toBeGreaterThan(WIDE_PITCH);
    expect(tall.figureScale).toBeCloseTo(1.5);
    const between = stageView(1.1);
    expect(between.figureScale).toBeGreaterThan(1);
    expect(between.figureScale).toBeLessThan(1.5);
  });

  it('frames inside the safe area at a tall stage pitch too', () => {
    const camera = new PerspectiveCamera(11, 0.8, 0.5, 400);
    const { pitch } = stageView(0.8);
    const frame = fitFrame(camera, points, safe, undefined, pitch);
    placeCamera(camera, frame.target, frame.distance, pitch);
    for (const point of points.map((p) => p.clone().project(camera))) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(1 - 2 * safe.side + 0.01);
      expect(point.y).toBeLessThanOrEqual(1 - 2 * safe.top + 0.01);
      expect(point.y).toBeGreaterThanOrEqual(-1 + 2 * safe.bottom - 0.01);
    }
  });
});
