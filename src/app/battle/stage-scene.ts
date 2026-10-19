import * as THREE from 'three';
import { seededRandom } from '../core/models/mercenary.model';
import { createStageAssets } from './stage-assets';
import { createCameraDirector } from './stage-camera';
import { createChoreography } from './stage-choreography';
import { createEffects } from './stage-effects';
import { createEnvironment } from './stage-environment';
import { FOV, HEAD_HEIGHT, laneZ, worldX } from './stage-layout';
import { createMarkers } from './stage-markers';
import { createParticles } from './stage-particles';
import type { Stage, StageContext, StageOptions, StageState } from './stage-types';
import { createUnits } from './stage-units';

/*
 * The 2.5D battle stage: a side view of three lanes receding into depth, painted
 * backdrop, animated 3D characters and skill choreography. It only renders state;
 * the rules engine has already resolved everything it shows. Loaded lazily with three.
 *
 * This file owns the renderer, sizing, state sync, the frame loop and teardown. The
 * scenery, units, markers, effects, camera and skill choreography each have a stage-* module.
 */

/** Lowest render scale under load; below this the stage turns to mush. */
const MIN_PIXEL_RATIO = 0.5;

export async function createStage(options: StageOptions): Promise<Stage> {
  const { canvas, overlay, reducedMotion } = options;
  const context = canvas.getContext('webgl2', { antialias: true });
  if (!context) throw new Error('WebGL2 is unavailable.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Adaptive resolution: weak GPUs and software rendering drop pixels before frames.
  const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  let pixelRatio = maxPixelRatio;
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2130);
  const fog = new THREE.Fog(0x252b3a, 30, 90);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);

  const assets = createStageAssets();
  const ctx: StageContext = { scene, camera, assets, random: seededRandom(7), reducedMotion };
  const { random } = ctx;

  const particles = createParticles(ctx);
  const environment = createEnvironment(ctx, particles);
  const markers = createMarkers(ctx);
  const director = createCameraDirector(camera, fog, overlay, random, reducedMotion);
  const effects = createEffects(ctx, particles, director);
  const units = await createUnits(ctx, particles, effects);
  const { views, kit } = units;
  let state: StageState | null = null;
  const choreography = createChoreography(ctx, units, particles, effects, director, () => state);

  let width = 1;
  let height = 1;

  const applySize = () => {
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    particles.setScale((height * pixelRatio) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))));
  };
  /** Smoothed time between animation frames, in ms. */
  let frameMs = 16;
  let lastTick = 0;
  let nextScaleAt = 0;
  const adaptResolution = (time: number) => {
    if (lastTick) frameMs += (Math.min(250, time - lastTick) - frameMs) * 0.1;
    lastTick = time;
    if (time < nextScaleAt) return;
    const next =
      frameMs > 40
        ? Math.max(MIN_PIXEL_RATIO, pixelRatio * 0.75)
        : frameMs < 20
          ? Math.min(maxPixelRatio, pixelRatio * 1.15)
          : pixelRatio;
    if (Math.abs(next - pixelRatio) < 0.01) return;
    // Drop quickly when struggling; climb back slowly so it does not oscillate.
    nextScaleAt = time + (next < pixelRatio ? 500 : 2000);
    pixelRatio = next;
    applySize();
    // Let the frame time settle at the new size before judging it again.
    frameMs = 16 + (frameMs - 16) * 0.5;
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    applySize();
    director.resize(width, height);
    director.reframe(state, true);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // State sync -------------------------------------------------------------
  const sync = (next: StageState) => {
    effects.touch();
    const previousActive = state?.activeId;
    state = next;
    const seen = new Set<string>();
    for (const unit of next.units) {
      seen.add(unit.id);
      let view = views.get(unit.id);
      if (!view) {
        view = units.create(unit);
        views.set(unit.id, view);
      }
      const goalX = worldX(unit.x);
      const goalZ = laneZ(unit.lane);
      if (goalZ !== view.goal.z) view.hopFrom = view.group.position.z;
      view.goal.set(goalX, 0, goalZ);
      if (!unit.alive && view.alive && view.dying < 0) {
        const dying = view;
        effects.later(next.impactDelay + 0.3, () => {
          if (dying.dying < 0) dying.dying = 0;
        });
      }
      if (unit.alive && !view.alive) view.dying = -1;
      view.alive = unit.alive;
      if (unit.guard > 0 && view.guard === 0 && unit.alive) {
        particles.burst(units.chest(view), 0x9fd4ff, 14, 1.6, 0.3);
      }
      view.guard = unit.guard;
      const has = (type: string) => unit.alive && unit.statuses.some((s) => s === type);
      view.buff.visible = has('defense-up') || has('attack-up');
      // Gold for Defense, red-gold once Attack is up too.
      (view.buff.material as THREE.MeshBasicMaterial).color.setHex(
        has('attack-up') ? 0xff8a5c : 0xffd36a,
      );
      view.debuff.visible = has('defense-down') || has('attack-down');
      view.stars.visible = has('stun');
      view.poisoned = has('poison');
    }
    for (const [id, view] of views) {
      if (!seen.has(id)) {
        units.remove(view);
        views.delete(id);
      }
    }
    if (next.activeId !== previousActive && next.activeId) {
      const active = views.get(next.activeId);
      if (active) effects.shockwave(active.goal, 0xffcf5a, 1.2, 0.45);
    }
    director.reframe(state);
  };

  // Frame loop -------------------------------------------------------------
  const probe = new THREE.Vector3();
  const written = new WeakMap<HTMLElement, string>();
  /** Lays each unit's DOM button over its projected sprite bounds. */
  const placeOverlay = () => {
    for (const node of overlay.querySelectorAll<HTMLElement>('[data-unit-id]')) {
      const view = views.get(node.dataset['unitId'] ?? '');
      if (!view) continue;
      const base = view.group.position;
      probe.set(base.x, 0, base.z).project(camera);
      const feetX = (probe.x * 0.5 + 0.5) * width;
      const feetY = (-probe.y * 0.5 + 0.5) * height;
      probe.set(base.x, HEAD_HEIGHT, base.z).project(camera);
      const headY = (-probe.y * 0.5 + 0.5) * height;
      const boxHeight = Math.max(24, feetY - headY);
      const boxWidth = Math.max(44, boxHeight * 0.62);
      const style = `${Math.round(feetX - boxWidth / 2)},${Math.round(headY)},${Math.round(boxWidth)},${Math.round(boxHeight)}`;
      if (written.get(node) === style) continue;
      written.set(node, style);
      node.style.transform = `translate3d(${Math.round(feetX - boxWidth / 2)}px, ${Math.round(headY)}px, 0)`;
      node.style.width = `${Math.round(boxWidth)}px`;
      node.style.height = `${Math.round(boxHeight)}px`;
    }
  };

  let frame = 0;
  let last = performance.now();
  let skipFrame = false;
  let lost = false;
  const loop = (time: number) => {
    frame = requestAnimationFrame(loop);
    adaptResolution(time);
    skipFrame = effects.idle() && !skipFrame;
    if (skipFrame) return;
    const dt = Math.min(0.05, Math.max(0, (time - last) / 1000));
    last = time;
    try {
      effects.advance(dt);
      environment.ambience(dt, effects.now);
      units.update(dt);
      markers.update(effects.now, state, views);
      particles.update(dt);
      if (director.update(dt)) effects.touch();
      environment.alignBackdrop(width, height);
      renderer.render(scene, camera);
      placeOverlay();
    } catch {
      fail();
    }
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const dispose = () => {
    if (lost) return;
    lost = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    for (const node of overlay.querySelectorAll<HTMLElement>('[data-unit-id]')) {
      node.style.removeProperty('transform');
      node.style.removeProperty('width');
      node.style.removeProperty('height');
    }
    units.clear();
    // Kept until now: disposing its materials earlier would release the compiled shaders.
    warmUp.dispose();
    kit.dispose();
    assets.dispose();
    renderer.dispose();
    // Browsers cap live WebGL contexts; free this one now rather than at GC.
    renderer.forceContextLoss();
  };
  const fail = () => {
    if (lost) return;
    dispose();
    options.onLost();
  };

  // Compile the character shaders before the stage is shown, so the opening
  // frames of a battle do not stutter. The fighter uses every material variant.
  const warmUp = kit.create('fighter', 'player', 0);
  scene.add(warmUp.root);
  resize();
  await renderer.compileAsync(scene, camera);
  scene.remove(warmUp.root);
  if (lost) throw new Error('The stage was lost while starting.');
  frame = requestAnimationFrame(loop);

  return { sync, play: choreography.play, dispose };
}
