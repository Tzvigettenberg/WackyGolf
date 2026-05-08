// Ball trail — Phase 4l
//
// A short tail of small fading spheres that follows the ball whenever it's
// moving. Each frame we push the current ball position to a ring buffer;
// each sphere sits at one buffer slot and fades / shrinks toward the tail.
//
// Performance: ~24 small spheres = ~24 draw calls of trivial cost. At our
// scale this is well below any meaningful budget — picked over a single
// THREE.Line because per-vertex alpha in LineBasicMaterial requires a
// custom shader, and the sphere-pool approach mirrors the aim-orb pattern
// already in the codebase.

import { SphereGeometry, MeshBasicMaterial, Mesh } from 'three';

const TRAIL_LENGTH = 24;     // number of orbs in the tail
const TRAIL_RADIUS = 0.18;
const HEAD_OPACITY = 0.7;
const TAIL_OPACITY_FALLOFF = 1.0;  // 1.0 means tail fades all the way to 0
const HEAD_SCALE = 1.0;
const TAIL_SHRINK = 0.55;

export class Trail {
  constructor(scene) {
    this.scene = scene;
    // Shared geometry (cheap), per-sphere material (so each can have its
    // own opacity).
    const geom = new SphereGeometry(TRAIL_RADIUS, 6, 4);
    this.spheres = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new Mesh(geom, mat);
      mesh.renderOrder = 997;       // behind aim orbs (998) + landing ring (999)
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.spheres.push(mesh);
    }
    // Newest position at index 0.
    this.history = [];
  }

  /** Wipe the trail — call when the ball launches or comes to rest. */
  reset() {
    this.history.length = 0;
    for (const s of this.spheres) {
      s.visible = false;
      s.material.opacity = 0;
    }
  }

  /** Push the current ball position and refresh the visible trail. */
  push(x, y, z) {
    this.history.unshift({ x, y, z });
    if (this.history.length > TRAIL_LENGTH) this.history.length = TRAIL_LENGTH;

    for (let i = 0; i < this.spheres.length; i++) {
      const sphere = this.spheres[i];
      const pos = this.history[i];
      if (!pos) {
        sphere.visible = false;
        continue;
      }
      sphere.visible = true;
      sphere.position.set(pos.x, pos.y, pos.z);
      // 0 = newest, 1 = oldest. Fade + shrink toward the tail.
      const t = i / Math.max(1, this.spheres.length - 1);
      sphere.material.opacity = HEAD_OPACITY * (1 - t * TAIL_OPACITY_FALLOFF);
      sphere.scale.setScalar(HEAD_SCALE - t * TAIL_SHRINK);
    }
  }

  /** Tint every trail sphere — host calls this on item changes (e.g., the
   *  Bouncy Ball gives the ball + trail an orange glow). */
  setColor(hex) {
    for (const s of this.spheres) s.material.color.setHex(hex);
  }
}
