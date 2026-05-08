// Ball trail — Phase 4p (tube version)
//
// A real 3D tube swept along the ball's recent path. Each frame we feed a
// fresh CatmullRom curve through the history points, build a TubeGeometry
// from it, and apply RGBA vertex colors so the tail fades to transparent.
// Gives the trail real visual thickness on every device — none of the
// "platforms clamp gl.LINE_WIDTH to 1" drama you get from THREE.Line.
//
// API matches the previous Trail so main.js doesn't change:
//   trail.push(x, y, z)
//   trail.reset()
//   trail.setColor(hex)

import {
  TubeGeometry, MeshBasicMaterial, Mesh,
  CatmullRomCurve3, Vector3, Color, BufferAttribute,
} from 'three';

const MAX_HISTORY = 30;
const RADIUS = 0.18;          // tube radius — half the ball's BALL_RADIUS (0.4)
const RADIAL_SEGMENTS = 6;    // around the tube — 6 reads as round, cheap
const TAIL_ALPHA = 0.0;       // alpha at the oldest vertex
const HEAD_ALPHA = 0.85;      // alpha at the newest vertex

export class Trail {
  constructor(scene) {
    this.scene = scene;
    this.history = [];
    this.tube = null;
    this.tintR = 1; this.tintG = 1; this.tintB = 1;
  }

  /** Wipe the trail — call when the ball launches OR comes to rest. */
  reset() {
    this.history.length = 0;
    this._disposeTube();
  }

  /** Append the current ball position and rebuild the tube. */
  push(x, y, z) {
    this.history.unshift({ x, y, z });
    if (this.history.length > MAX_HISTORY) this.history.length = MAX_HISTORY;
    if (this.history.length < 2) {
      this._disposeTube();
      return;
    }

    // Reverse so curve runs from oldest (tail) to newest (head) — makes the
    // alpha gradient line up cleanly with segment index.
    const points = new Array(this.history.length);
    for (let i = 0; i < this.history.length; i++) {
      const p = this.history[this.history.length - 1 - i];
      points[i] = new Vector3(p.x, p.y, p.z);
    }

    // CatmullRomCurve3 needs >= 2 points; we already gated above.
    const curve = new CatmullRomCurve3(points);
    // Smooth the curve a bit by oversampling the segments.
    const tubularSegments = Math.max(8, points.length * 2);
    const tubeGeom = new TubeGeometry(curve, tubularSegments, RADIUS, RADIAL_SEGMENTS, false);

    // Per-vertex RGBA — segment index drives alpha so older parts fade out.
    const vertexCount = tubeGeom.attributes.position.count;
    const colors = new Float32Array(vertexCount * 4);
    const ringSize = RADIAL_SEGMENTS + 1;
    for (let i = 0; i < vertexCount; i++) {
      const segIdx = Math.floor(i / ringSize);
      const t = segIdx / tubularSegments;        // 0 tail, 1 head
      const alpha = TAIL_ALPHA + (HEAD_ALPHA - TAIL_ALPHA) * t;
      colors[i * 4 + 0] = this.tintR;
      colors[i * 4 + 1] = this.tintG;
      colors[i * 4 + 2] = this.tintB;
      colors[i * 4 + 3] = alpha;
    }
    tubeGeom.setAttribute('color', new BufferAttribute(colors, 4));

    // Rebuild — disposing the previous geometry/material to avoid GPU leak.
    this._disposeTube();

    const mat = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    this.tube = new Mesh(tubeGeom, mat);
    this.tube.frustumCulled = false;
    this.tube.renderOrder = 997;          // behind aim orbs (998), landing (999)
    this.scene.add(this.tube);
  }

  /** Tint the entire trail. Host calls this when ball items change. */
  setColor(hex) {
    const c = new Color(hex);
    this.tintR = c.r;
    this.tintG = c.g;
    this.tintB = c.b;
  }

  // ---- internals ----

  _disposeTube() {
    if (!this.tube) return;
    this.scene.remove(this.tube);
    if (this.tube.geometry) this.tube.geometry.dispose();
    if (this.tube.material) this.tube.material.dispose();
    this.tube = null;
  }
}
