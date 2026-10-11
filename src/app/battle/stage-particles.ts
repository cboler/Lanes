import * as THREE from 'three';
import type { StageContext } from './stage-types';

/** One draw call for every spark, ember and puff. */
const MAX_PARTICLES = 700;

export interface Particles {
  spawn(
    at: THREE.Vector3,
    velocity: THREE.Vector3,
    color: number,
    size: number,
    ttl: number,
    gravity?: number,
    alpha?: number,
  ): void;
  burst(at: THREE.Vector3, color: number, count: number, speed: number, size?: number): void;
  update(dt: number): void;
  /** Point sizes are world units; this is the pixels-per-unit scale at distance 1. */
  setScale(pixelsPerUnit: number): void;
}

export function createParticles({ scene, assets, random }: StageContext): Particles {
  const data = {
    position: new Float32Array(MAX_PARTICLES * 3),
    color: new Float32Array(MAX_PARTICLES * 3),
    size: new Float32Array(MAX_PARTICLES),
    alpha: new Float32Array(MAX_PARTICLES),
    velocity: new Float32Array(MAX_PARTICLES * 3),
    life: new Float32Array(MAX_PARTICLES),
    ttl: new Float32Array(MAX_PARTICLES),
    gravity: new Float32Array(MAX_PARTICLES),
    baseSize: new Float32Array(MAX_PARTICLES),
    baseAlpha: new Float32Array(MAX_PARTICLES),
  };
  let count = 0;
  const geometry = assets.keep(new THREE.BufferGeometry());
  const attribute = (array: Float32Array, size: number) =>
    new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute(data.position, 3));
  geometry.setAttribute('color', attribute(data.color, 3));
  geometry.setAttribute('size', attribute(data.size, 1));
  geometry.setAttribute('alpha', attribute(data.alpha, 1));
  const material = assets.keep(
    new THREE.ShaderMaterial({
      uniforms: { map: { value: assets.glow }, scale: { value: 400 } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -view.z;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * texel.rgb, texel.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  const tint = new THREE.Color();
  const scratch = new THREE.Vector3();

  const spawn: Particles['spawn'] = (at, velocity, color, size, ttl, gravity = 0, alpha = 1) => {
    if (count >= MAX_PARTICLES) return;
    const i = count++;
    data.position.set([at.x, at.y, at.z], i * 3);
    data.velocity.set([velocity.x, velocity.y, velocity.z], i * 3);
    tint.set(color);
    data.color.set([tint.r, tint.g, tint.b], i * 3);
    data.life[i] = 0;
    data.ttl[i] = ttl;
    data.gravity[i] = gravity;
    data.baseSize[i] = size;
    data.baseAlpha[i] = alpha;
  };

  const burst: Particles['burst'] = (at, color, amount, speed, size = 0.35) => {
    for (let i = 0; i < amount; i++) {
      scratch.set(random() - 0.5, random() * 0.9 - 0.2, (random() - 0.5) * 0.6).normalize();
      spawn(
        at,
        scratch.multiplyScalar(speed * (0.35 + random())),
        color,
        size * (0.6 + random()),
        0.35 + random() * 0.4,
        -3,
      );
    }
  };

  const update = (dt: number) => {
    const d = data;
    for (let i = 0; i < count; i++) {
      d.life[i] += dt;
      if (d.life[i] >= d.ttl[i]) {
        // Swap-remove keeps the live particles packed at the front.
        const last = --count;
        for (const [array, width] of [
          [d.position, 3],
          [d.velocity, 3],
          [d.color, 3],
        ] as const) {
          array.copyWithin(i * width, last * width, last * width + width);
        }
        for (const array of [d.life, d.ttl, d.gravity, d.baseSize, d.baseAlpha])
          array[i] = array[last];
        i--;
        continue;
      }
      const k = d.life[i] / d.ttl[i];
      d.velocity[i * 3 + 1] += d.gravity[i] * dt;
      d.position[i * 3] += d.velocity[i * 3] * dt;
      d.position[i * 3 + 1] += d.velocity[i * 3 + 1] * dt;
      d.position[i * 3 + 2] += d.velocity[i * 3 + 2] * dt;
      d.size[i] = d.baseSize[i] * (1 - k * 0.5);
      d.alpha[i] = d.baseAlpha[i] * Math.min(1, (1 - k) * 2.2) * Math.min(1, k * 10 + 0.2);
    }
    geometry.setDrawRange(0, count);
    for (const name of ['position', 'color', 'size', 'alpha']) {
      geometry.getAttribute(name).needsUpdate = true;
    }
  };

  return {
    spawn,
    burst,
    update,
    setScale: (pixelsPerUnit) => (material.uniforms['scale'].value = pixelsPerUnit),
  };
}
