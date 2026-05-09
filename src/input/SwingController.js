// SwingController — Phase 1
//
// Pointer-based drag-back swing. Touch (or click) anywhere, drag back
// from your starting point, release to launch. Ball flies in the OPPOSITE
// direction of your drag, with power proportional to drag distance.

import {
  Vector3,
  RingGeometry, SphereGeometry, MeshBasicMaterial, Mesh,
} from 'three';

import { predictTrajectory } from '../physics/BallPhysics.js';

const STATE_IDLE = 0;
const STATE_AIMING = 1;

const MAX_DRAG_PX = 200;
const MIN_DRAG_PX = 6;

// Cancel zone — once the player has dragged back at least
// CANCEL_ARM_PX, dragging the pointer back toward the start position
// (current dragLen drops below CANCEL_RATIO × maxDragLen seen this gesture)
// puts the swing in CANCEL mode. Releasing in CANCEL mode does NOT fire.
// Small swings (max never reaches CANCEL_ARM_PX) are immune — releasing
// always fires for low-power shots.
const CANCEL_ARM_PX = 30;
const CANCEL_RATIO = 0.25;

// CSS selectors that should NOT trigger a swing when tapped/dragged
const UI_BLOCK_SELECTOR = '#club-selector, #minimap, #hud-top, button';

export class SwingController {
  constructor({ ball, scene, camera, canvas, bag, onShotFired, onAim, getPowerMultiplier, getShowFullTrajectory, getBounceMultiplier }) {
    this.ball = ball;
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.bag = bag;
    this.onShotFired = onShotFired || (() => {});
    this.onAim = onAim || (() => {});
    // Item hook: club's effective max-speed is multiplied by this. Receives the
    // active club so item effects can be club-specific (e.g. Driver Specialist).
    // Defaults to 1 (no boost) if the host doesn't wire it up.
    this.getPowerMultiplier = getPowerMultiplier || (() => 1);
    // Item hook: Eagle Eye reveals the full bounce + roll path on the minimap.
    // Defaults to false → minimap only shows the airborne arc.
    this.getShowFullTrajectory = getShowFullTrajectory || (() => false);
    // Item hook: Bouncy Ball multiplies the bounce energy. Predictor must use
    // the same value as live physics or the landing marker will lie.
    this.getBounceMultiplier = getBounceMultiplier || (() => 1);

    // scratch vectors so we don't allocate per frame
    this._camFwd = new Vector3();
    this._camRight = new Vector3();
    this._worldUp = new Vector3(0, 1, 0);

    this.state = STATE_IDLE;
    this.startX = 0;
    this.startY = 0;
    this.dx = 0;
    this.dy = 0;
    // Largest drag distance seen during the current gesture. Drives the
    // cancel-zone check in _isCancel().
    this._maxDragLen = 0;

    this.orbs = this._makeOrbs(28);
    // Landing-rest ring is intentionally NOT added to the 3D scene anymore —
    // the player gets that feedback on the minimap (red dot) instead, for
    // added challenge in the 3D view.
    this.landingMarker = { visible: false, position: { set: () => {}, copy: () => {} } };

    // Smoothed landing-marker chase. The raw prediction can jump by yards
    // when the bounce/roll transition flips at certain power levels — the
    // lerp absorbs those jumps into gentle eases without hiding the result.
    this._predictedRest = null;
    this._smoothRest = new Vector3();
    this._smoothInit = false;
    this.enabled = true;
    this.surfaces = null; // set via setSurfaces on each new hole — used by the predictor

    this._bind();
  }

  /** Update which hole's surface map the predictor should use. */
  setSurfaces(surfaces) {
    this.surfaces = surfaces || null;
  }

  /** Lock or unlock swing input — used during score banners and run-over. */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.state === STATE_AIMING) {
      this.state = STATE_IDLE;
      this._hideOrbs();
      this.landingMarker.visible = false;
      this._predictedRest = null;
      this._smoothInit = false;
      this.onAim(null);
    }
  }

  _makeOrbs(count) {
    const geom = new SphereGeometry(0.15, 7, 5);
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false,
    });
    const orbs = [];
    for (let i = 0; i < count; i++) {
      // each orb gets its own material clone so we can fade per index
      const m = mat.clone();
      const orb = new Mesh(geom, m);
      orb.renderOrder = 998;
      orb.frustumCulled = false;
      orb.visible = false;
      this.scene.add(orb);
      orbs.push(orb);
    }
    return orbs;
  }

  _makeLandingMarker() {
    const geom = new RingGeometry(0.7, 1.1, 32);
    const mat = new MeshBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 999;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** True while the player is mid-drag setting up a swing. */
  get isAiming() {
    return this.state === STATE_AIMING;
  }

  _bind() {
    // pointerdown only on the canvas — taps on UI buttons never reach us
    this.canvas.addEventListener('pointerdown', this._onDown, { passive: false });
    // move/up listen on window so swings continue working if your finger
    // strays off the canvas mid-drag
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
  }

  _onDown = (e) => {
    if (!this.enabled) return;
    if (!this.ball.isAtRest || this.ball.isHoled) return;
    if (e.isPrimary === false) return;
    if (e.target && e.target.closest && e.target.closest(UI_BLOCK_SELECTOR)) return;
    this.state = STATE_AIMING;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.dx = 0;
    this.dy = 0;
    this._maxDragLen = 0;
    this._hideOrbs();
    this.landingMarker.visible = false;
    // reset smoothing so the next aim's first frame snaps cleanly to its target
    this._predictedRest = null;
    this._smoothInit = false;
    this.onAim(null);
    e.preventDefault();
  };

  _onMove = (e) => {
    if (this.state !== STATE_AIMING) return;
    if (e.isPrimary === false) return;
    this.dx = e.clientX - this.startX;
    this.dy = e.clientY - this.startY;
    const len = Math.hypot(this.dx, this.dy);
    if (len > this._maxDragLen) this._maxDragLen = len;
    this._updateAim();
    e.preventDefault();
  };

  _onUp = (e) => {
    if (this.state !== STATE_AIMING) return;
    if (e.isPrimary === false) return;
    this.state = STATE_IDLE;
    this._hideOrbs();
    this.landingMarker.visible = false;
    this._predictedRest = null;
    this._smoothInit = false;
    this.onAim(null);
    // Cancel zone: pulled back substantially then dragged the pointer
    // back near the start before releasing → swallow the shot.
    if (!this._isCancel()) this._fire();
    e.preventDefault();
  };

  /** True when current drag is in the cancel zone — see CANCEL_* constants. */
  _isCancel() {
    const dragLen = Math.hypot(this.dx, this.dy);
    return this._maxDragLen >= CANCEL_ARM_PX && dragLen < this._maxDragLen * CANCEL_RATIO;
  }

  _computeLaunch() {
    const dragLen = Math.hypot(this.dx, this.dy);
    if (dragLen < MIN_DRAG_PX) return null;
    const club = this.bag.active;
    const power = Math.min(dragLen / MAX_DRAG_PX, 1);
    // items can scale the club's effective max speed (Heavy Driver, Lucky Tee,
    // Driver Specialist, etc.) — host computes from current run state.
    const speed = power * club.maxSpeed * this.getPowerMultiplier(club);

    // camera-relative basis: ball fires in the camera's "forward" direction
    // when the player drags DOWN on screen, regardless of camera yaw.
    this.camera.getWorldDirection(this._camFwd);
    this._camFwd.y = 0; this._camFwd.normalize();
    this._camRight.crossVectors(this._camFwd, this._worldUp).normalize();

    // drag-down (dy positive) → fire forward
    // drag-right (dx positive) → fire LEFT (slingshot — opposite of drag)
    const fwdAmt = this.dy / dragLen;
    const rightAmt = -this.dx / dragLen;

    const dirX = this._camFwd.x * fwdAmt + this._camRight.x * rightAmt;
    const dirZ = this._camFwd.z * fwdAmt + this._camRight.z * rightAmt;

    const horiz = Math.cos(club.launchAngle);
    const vert = Math.sin(club.launchAngle);
    return {
      dragLen, power, speed, dirX, dirZ, club,
      velocity: new Vector3(
        dirX * speed * horiz,
        speed * vert,
        dirZ * speed * horiz,
      ),
    };
  }

  _updateAim() {
    const launch = this._computeLaunch();
    if (!launch) {
      this._hideOrbs();
      this.landingMarker.visible = false;
      return;
    }

    // In cancel zone: hide the trajectory entirely and tell the host to
    // flip the power meter into CANCEL state. Skipping the predictor is
    // also a small perf win on every cancel-zone frame.
    if (this._isCancel()) {
      this._hideOrbs();
      this.landingMarker.visible = false;
      this._predictedRest = null;
      this._smoothInit = false;
      this.onAim({ cancel: true, power: launch.power });
      return;
    }

    const bounceMult = this.getBounceMultiplier();
    // Pull live wind straight off the physics object so the predicted
    // trajectory matches the actual flight exactly.
    const windForce = this.ball.windForce || { x: 0, z: 0 };
    const traj = predictTrajectory(this.ball.position, launch.velocity, this.surfaces, bounceMult, windForce);
    this._placeOrbs(traj.samples, launch.power, traj.firstContactIdx);

    // Always show the FIRST ground-contact position in the red marker —
    // honest about where the ball will physically touch down regardless
    // of items, multipliers, or bounce profile. Eagle Eye still earns its
    // keep by extending the dotted minimap line through bounces + roll.
    const eagleEye = this.getShowFullTrajectory();
    const target = traj.firstContactPos || traj.rest;

    this._predictedRest = target;
    this.landingMarker.visible = true;

    // Minimap dotted line: airborne arc only by default, full path with
    // Eagle Eye (so the player can read where the ball will roll out to).
    const samples = eagleEye
      ? traj.samples
      : traj.samples.slice(0, traj.firstContactIdx + 1);

    this.onAim({
      x: target.x,
      z: target.z,
      power: launch.power,
      club: launch.club,
      samples,
    });
  }

  _placeOrbs(samples, power, firstContactIdx) {
    const n = this.orbs.length;
    // Show only the airborne arc. After first ground contact, bounces+rolls
    // are chaotic; the minimap dotted line still shows the full path.
    const limit = Math.min(samples.length, firstContactIdx + 1, 12);
    // Match the power-meter HSL gradient exactly: green (0%) → red (100%).
    const hue = (120 - power * 120) / 360;
    for (let i = 0; i < n; i++) {
      const orb = this.orbs[i];
      if (i < limit) {
        const s = samples[i];
        orb.position.set(s.x, s.y, s.z);
        orb.visible = true;
        orb.material.color.setHSL(hue, 0.85, 0.55);
        const t = i / Math.max(1, limit - 1);
        orb.scale.setScalar(1 - t * 0.4);
        orb.material.opacity = 0.95 - t * 0.45;
      } else {
        orb.visible = false;
      }
    }
  }

  _hideOrbs() {
    for (const o of this.orbs) o.visible = false;
  }

  /** Called from the main loop every frame — eases the visible landing marker
   *  toward the latest predicted rest position. */
  tick() {
    if (!this._predictedRest) return;
    const target = this._predictedRest;
    if (!this._smoothInit) {
      this._smoothRest.set(target.x, 0.06, target.z);
      this._smoothInit = true;
    } else {
      // ~22% per frame at 60Hz → converges visibly in ~5 frames
      const k = 0.22;
      this._smoothRest.x += (target.x - this._smoothRest.x) * k;
      this._smoothRest.z += (target.z - this._smoothRest.z) * k;
      this._smoothRest.y = 0.06;
    }
    this.landingMarker.position.copy(this._smoothRest);
  }

  _fire() {
    const launch = this._computeLaunch();
    if (!launch) return;
    this.ball.launch(launch.velocity);
    this.onShotFired(launch.power, launch.club);
  }
}
