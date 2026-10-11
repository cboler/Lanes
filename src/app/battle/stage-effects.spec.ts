import { CylinderGeometry, PerspectiveCamera, RingGeometry, Scene, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CameraDirector } from './stage-camera';
import { createEffects } from './stage-effects';
import type { Particles } from './stage-particles';
import type { StageContext } from './stage-types';

function setup() {
  const scene = new Scene();
  // Effects only read a few shared textures and geometries; empty stand-ins are enough here.
  const assets = {
    glow: null,
    slash: null,
    arrow: null,
    beam: null,
    shock: new RingGeometry(),
    column: new CylinderGeometry(),
    owns: () => false,
  } as unknown as StageContext['assets'];
  const ctx: StageContext = {
    scene,
    camera: new PerspectiveCamera(),
    assets,
    random: () => 0.5,
    reducedMotion: false,
  };
  const particles = { spawn: vi.fn(), burst: vi.fn(), update: vi.fn(), setScale: vi.fn() };
  const director = { addShake: vi.fn(), addPunch: vi.fn() } as unknown as CameraDirector;
  const effects = createEffects(ctx, particles as Particles, director);
  return { effects, scene, particles, director };
}

describe('stage effects clock', () => {
  it('runs delayed callbacks once, in time order, on the stage clock', () => {
    const { effects } = setup();
    const ran: string[] = [];
    effects.later(0.3, () => ran.push('late'));
    effects.later(0.1, () => ran.push('early'));
    effects.later(0.1, () => ran.push('early-second'));

    effects.advance(0.05);
    expect(ran).toEqual([]);
    effects.advance(0.1);
    expect(ran).toEqual(['early', 'early-second']);
    effects.advance(0.1);
    expect(ran).toEqual(['early', 'early-second']);
    effects.advance(0.1);
    expect(ran).toEqual(['early', 'early-second', 'late']);
    effects.advance(1);
    expect(ran).toHaveLength(3);
  });

  it('tweens progress from 0 to exactly 1, then reports done', () => {
    const { effects } = setup();
    const seen: number[] = [];
    const done = vi.fn();
    effects.tween(0.4, (k) => seen.push(k), done);

    effects.advance(0.1);
    effects.advance(0.1);
    expect(done).not.toHaveBeenCalled();
    effects.advance(0.3);
    expect(done).toHaveBeenCalledTimes(1);
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.every((k, i) => i === 0 || k >= seen[i - 1])).toBe(true);
    effects.advance(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('is idle only after everything finished and motion has settled', () => {
    const { effects } = setup();
    expect(effects.idle()).toBe(false); // clock has not moved past the grace period yet
    effects.advance(1);
    expect(effects.idle()).toBe(true);

    effects.later(0.2, () => effects.touch());
    expect(effects.idle()).toBe(false);
    effects.advance(0.25);
    expect(effects.idle()).toBe(false); // touched just now
    effects.advance(1);
    expect(effects.idle()).toBe(true);
  });

  it('removes transient objects when they finish', () => {
    const { effects, scene } = setup();
    const baseline = scene.children.length;
    effects.shockwave(new Vector3(), 0xffffff, 2, 0.3);
    expect(scene.children).toHaveLength(baseline + 1);
    effects.advance(0.2);
    expect(scene.children).toHaveLength(baseline + 1);
    effects.advance(0.2);
    expect(scene.children).toHaveLength(baseline);
  });

  it('explosions shake the camera and spawn particles', () => {
    const { effects, particles, director } = setup();
    effects.explode(new Vector3(), 0xff0000, 2);
    expect(particles.burst).toHaveBeenCalledTimes(2);
    expect(director.addShake).toHaveBeenCalledWith(0.36);
  });
});
