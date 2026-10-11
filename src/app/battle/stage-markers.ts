import * as THREE from 'three';
import { FIELD_WIDTH, LANE_GAP, laneZ, worldX } from './stage-layout';
import type { StageContext, StageState } from './stage-types';
import type { UnitView } from './stage-units';

export interface Markers {
  /** Active-unit ring, move range, area-skill lanes and target rings. */
  update(time: number, state: StageState | null, views: ReadonlyMap<string, UnitView>): void;
}

export function createMarkers({ scene, assets, reducedMotion }: StageContext): Markers {
  const { ring, strip, basic, additive, flatPlane } = assets;
  const activeRing = new THREE.Mesh(flatPlane, additive(ring, 0xffcf5a, 0.9));
  activeRing.renderOrder = 2;
  const moveStrip = new THREE.Mesh(
    flatPlane,
    basic({ map: strip, color: 0xffd36a, opacity: 0.32, blending: THREE.AdditiveBlending }),
  );
  moveStrip.renderOrder = 1;
  const areaStrips = [0, 1, 2].map(() => {
    const mesh = new THREE.Mesh(
      flatPlane,
      basic({ map: strip, color: 0xff3b2f, blending: THREE.AdditiveBlending, fog: false }),
    );
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  scene.add(activeRing, moveStrip);
  const targetRings: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const toneColor = { enemy: 0xff5147, ally: 0x5dffa0, risk: 0xffa53d };

  const update: Markers['update'] = (time, state, views) => {
    const active = state?.activeId ? views.get(state.activeId) : undefined;
    activeRing.visible = !!active && active.alive;
    if (active) {
      activeRing.position.set(active.group.position.x, 0.03, active.group.position.z);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 4) * 0.06;
      activeRing.scale.set(1.9 * pulse, 1, 1.05 * pulse);
    }
    const range = state?.moveRange;
    moveStrip.visible = !!range && !!active;
    if (range && active) {
      const from = worldX(range.from);
      const to = worldX(range.to);
      moveStrip.position.set((from + to) / 2, 0.02, active.goal.z);
      moveStrip.scale.set(Math.max(0.3, to - from + 1.2), 1, LANE_GAP * 0.62);
    }
    areaStrips.forEach((mesh, lane) => {
      mesh.visible = !!state?.areaLanes.includes(lane);
      mesh.position.set(0, 0.025, laneZ(lane));
      mesh.scale.set(FIELD_WIDTH + 0.6, 1, LANE_GAP * 0.8);
      mesh.material.opacity = 0.42 + (reducedMotion ? 0 : Math.sin(time * 5) * 0.12);
    });
    const targets = state?.targets ?? [];
    while (targetRings.length < targets.length) {
      const mesh = new THREE.Mesh(
        flatPlane,
        basic({ map: ring, blending: THREE.AdditiveBlending }),
      );
      mesh.renderOrder = 3;
      scene.add(mesh);
      targetRings.push(mesh);
    }
    targetRings.forEach((mesh, index) => {
      const target = targets[index];
      const view = target && views.get(target.id);
      mesh.visible = !!view && view.alive;
      if (!view || !target) return;
      const focused = target.id === state?.focusedId;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 6 + index) * 0.07;
      mesh.material.color.set(toneColor[target.tone]);
      mesh.material.opacity = focused ? 1 : 0.55;
      mesh.position.set(view.group.position.x, 0.035, view.group.position.z);
      mesh.scale.set((focused ? 2.1 : 1.7) * pulse, 1, (focused ? 1.15 : 0.95) * pulse);
    });
  };

  return { update };
}
