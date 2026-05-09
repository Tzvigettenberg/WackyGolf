// WindFx — Phase 4s
//
// Subtle 3D wisps that drift across the play area in the wind's direction.
// Built from a small pool of low-poly spheres (no instancing — count is
// tiny, so the per-mesh state is fine and lets each wisp carry its own
// life/opacity for the fade.)
//
// Each wisp:
//   • lives for ~2-4 seconds
//   • drifts at SPEED_MULTIPLIER × wind force
//   • respawns on the upwind edge of the hole bounds when its life
//     expires OR it crosses out of the bounds
//   • fades in then out via a sine envelope on its life
//
// When wind speed is ~0 (Wind Charm equipped, or pre-load), wisps are
// fully transparent — they don't even draw. setWind({x:0,z:0}) freezes
// movement so the GPU has nothing to do.

import {
  Mesh, SphereGeometry, MeshBasicMaterial, Group,
} from 'three';

const WISP_COUNT = 10;
const WISP_RADIUS = 0.28;
const WISP_OPACITY = 0.22;
const SPEED_MULTIPLIER = 1.4;   // wisps drift slightly faster than ball-wind for legibility

export class WindFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new Group();
    this.wisps = [];
    const geom = new SphereGeometry(WISP_RADIUS, 6, 4);
    for (let i = 0; i < WISP_COUNT; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = new Mesh(geom, mat);
      m.frustumCulled = false;
      m.renderOrder = 996;       // behind the trail tube + aim orbs
      this.group.add(m);
      this.wisps.push({ mesh: m, x: 0, y: 1, z: 0, life: 0, lifeStart: 1 });
    }
    scene.add(this.group);
    this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    this.windForce = { x: 0, z: 0 };
    this._initialized = false;
  }

  /** Update the play-area bounds when a new hole loads. */
  setBounds(b) {
    if (b) this.bounds = b;
  }

  /** Update the live wind force (matches the value pushed to physics). */
  setWind(force) {
    this.windForce = { x: (force && force.x) || 0, z: (force && force.z) || 0 };
    if (!this._initialized && this._windActive()) {
      // First time wind is non-zero — scatter wisps throughout the bounds
      // so the field starts ALREADY full of motion instead of waiting for
      // the upwind edge to feed.
      for (const w of this.wisps) this._respawn(w, true);
      this._initialized = true;
    }
  }

  update(dt) {
    if (!this._windActive()) {
      for (const w of this.wisps) w.mesh.material.opacity = 0;
      return;
    }
    for (const w of this.wisps) {
      w.x += this.windForce.x * dt * SPEED_MULTIPLIER;
      w.z += this.windForce.z * dt * SPEED_MULTIPLIER;
      w.life -= dt;
      const out = w.x < this.bounds.minX || w.x > this.bounds.maxX ||
                  w.z < this.bounds.minZ || w.z > this.bounds.maxZ;
      if (w.life <= 0 || out) this._respawn(w, false);
      w.mesh.position.set(w.x, w.y, w.z);
      // Sine envelope: 0 → peak at half-life → 0. Keeps the wisp from
      // popping in/out abruptly at the bounds.
      const t = 1 - Math.abs(1 - 2 * (w.life / w.lifeStart));
      w.mesh.material.opacity = WISP_OPACITY * Math.max(0, Math.min(1, t));
    }
  }

  // ---- internals ----

  _windActive() {
    return Math.hypot(this.windForce.x, this.windForce.z) > 0.05;
  }

  _respawn(w, scatter) {
    const minX = this.bounds.minX, maxX = this.bounds.maxX;
    const minZ = this.bounds.minZ, maxZ = this.bounds.maxZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const halfX = (maxX - minX) / 2, halfZ = (maxZ - minZ) / 2;
    const speed = Math.hypot(this.windForce.x, this.windForce.z) || 1;

    if (scatter) {
      // Scatter throughout the field on first activation — covers the area
      // immediately instead of waiting for the upwind edge to feed.
      w.x = minX + Math.random() * (maxX - minX);
      w.z = minZ + Math.random() * (maxZ - minZ);
    } else {
      // Spawn on the upwind edge with perpendicular jitter so they enter
      // the field continuously from the side wind is coming from.
      const dirX = this.windForce.x / speed;
      const dirZ = this.windForce.z / speed;
      w.x = cx - dirX * (halfX + 6);
      w.z = cz - dirZ * (halfZ + 6);
      const perpX = -dirZ, perpZ = dirX;
      const jitter = (Math.random() - 0.5) * Math.max(halfX, halfZ) * 1.6;
      w.x += perpX * jitter;
      w.z += perpZ * jitter;
    }
    w.y = 0.6 + Math.random() * 2.0;
    w.lifeStart = 2.0 + Math.random() * 2.0;
    w.life = w.lifeStart;
  }
}
