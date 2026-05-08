// Ball trail — Phase 4l (line version)
//
// A single THREE.Line with N vertices that follows the ball when it's
// moving. Per-vertex RGBA colors give the head full opacity and fade the
// tail to transparent. One draw call, no draw-call-per-orb cost.
//
// Caveat: WebGL fixed-function `gl.LINE_WIDTH` is clamped to 1 on most
// platforms, so the line renders thin (1 device pixel). At our scale this
// reads as a clean "wake" rather than the dotty look of the sphere pool.
//
// API matches the previous sphere-pool Trail so main.js doesn't change:
//   trail.push(x, y, z)
//   trail.reset()
//   trail.setColor(hex)

import {
  Line, BufferGeometry, BufferAttribute,
  LineBasicMaterial, Color,
} from 'three';

const TRAIL_LENGTH = 36;          // vertex count — controls trail duration
const HEAD_OPACITY = 0.95;        // alpha at the newest vertex

export class Trail {
  constructor(scene) {
    this.scene = scene;

    this.positions = new Float32Array(TRAIL_LENGTH * 3);
    // RGBA per vertex — three.js LineBasicMaterial honors 4-component vertex
    // colors when material.transparent === true.
    this.colors = new Float32Array(TRAIL_LENGTH * 4);

    this.geom = new BufferGeometry();
    this.geom.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geom.setAttribute('color', new BufferAttribute(this.colors, 4));
    this.geom.setDrawRange(0, 0);

    this.mat = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      // linewidth is mostly ignored on WebGL but we set it anyway —
      // costs nothing and one day a context might honor it.
      linewidth: 3,
    });

    this.line = new Line(this.geom, this.mat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.line.renderOrder = 997;          // behind aim orbs (998), landing (999)
    scene.add(this.line);

    this.tintR = 1; this.tintG = 1; this.tintB = 1;
    // History as a flat ring buffer of {x,y,z} positions. Index 0 = newest.
    this.history = [];
  }

  /** Wipe the trail — call when the ball launches OR comes to rest. */
  reset() {
    this.history.length = 0;
    this.geom.setDrawRange(0, 0);
    this.line.visible = false;
  }

  /** Append the current ball position and rebuild the visible line. */
  push(x, y, z) {
    this.history.unshift({ x, y, z });
    if (this.history.length > TRAIL_LENGTH) this.history.length = TRAIL_LENGTH;

    const N = this.history.length;
    if (N < 2) {
      this.line.visible = false;
      return;
    }

    for (let i = 0; i < N; i++) {
      const pos = this.history[i];
      this.positions[i * 3 + 0] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;

      // 0 = head (full opacity), 1 = tail (transparent).
      const t = i / Math.max(1, TRAIL_LENGTH - 1);
      const alpha = HEAD_OPACITY * (1 - t);
      this.colors[i * 4 + 0] = this.tintR;
      this.colors[i * 4 + 1] = this.tintG;
      this.colors[i * 4 + 2] = this.tintB;
      this.colors[i * 4 + 3] = alpha;
    }

    this.geom.setDrawRange(0, N);
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.color.needsUpdate = true;
    this.line.visible = true;
  }

  /** Tint the entire trail. Host calls this when ball items change. */
  setColor(hex) {
    const c = new Color(hex);
    this.tintR = c.r;
    this.tintG = c.g;
    this.tintB = c.b;
  }
}
