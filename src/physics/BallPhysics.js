// Custom golf ball physics — Phase 1
//
// Units: roughly 1 unit = 1 yard. Numbers are tuned for game feel,
// not real-world accuracy. We can rebalance any time.

import { Vector3 } from 'three';

// ---- tunables ----
export const BALL_RADIUS = 0.4;
export const CUP_RADIUS = 0.55;          // slightly larger than ball — easier to hole at MVP
export const CUP_CAPTURE_SPEED = 6.0;    // fast putts can rim out (later); for now generous

export const GRAVITY = -22;              // tuned for snappy arcs at our scale
export const AIR_DRAG = 0.0008;          // drag = AIR_DRAG * speed²
export const BOUNCE = 0.35;              // vertical energy retained on bounce
export const BOUNCE_FRICTION = 0.65;     // horizontal energy retained on bounce
export const ROLL_DECEL = 4.5;           // yd/s² deceleration when ball is rolling on ground
export const REST_SPEED = 0.25;          // below this, ball comes to rest
// Below this incoming Y velocity, we skip the bounce and go straight to rolling.
// Kept at -1.5 so most low-mid power shots roll cleanly without bouncing.
// Visual jumps caused by the bounce/roll boundary are absorbed by the smoothed
// landing-marker lerp in SwingController.
export const BOUNCE_VY_THRESHOLD = -1.5;

// ---------------------------------------------------------------------------
// Surface modifiers — applied when ball is in contact with the ground.
// Each surface tweaks roll friction and bounce energy.
// ---------------------------------------------------------------------------
export const SURFACE_MODIFIERS = {
  fairway: { friction: 1.0, bounce: 1.0,  bounceFriction: 1.0  },
  green:   { friction: 0.55, bounce: 0.55, bounceFriction: 0.85 },
  rough:   { friction: 1.9, bounce: 0.45, bounceFriction: 0.7  },
  // Sand is a death trap — rolling through eats almost all your speed,
  // and bounces deaden hard. If you land in it, you stay in it.
  sand:    { friction: 9.5, bounce: 0.06, bounceFriction: 0.25 },
  // water: not really applied — ball stops on contact and a penalty kicks in,
  // see step() below. Listed here so any code looking up a modifier won't crash.
  water:   { friction: 0,   bounce: 0,    bounceFriction: 0 },
};

/**
 * Surface lookup. Priority follows the visual stacking order — whichever
 * surface is rendered ON TOP at this XZ point wins:
 *   green → sand → fairway → water → rough
 * (An island green inside water still counts as green. A fairway island
 * inside water still counts as fairway — bail-out zones for long carries.)
 *
 * Note: green wins over sand. If a bunker visually sits *under* a green
 * (i.e. the green covers it), the ball is "on the green" — sand doesn't
 * leak through the visible surface.
 */
export function getSurfaceAt(surfaces, x, z) {
  if (!surfaces) return 'fairway';

  const g = surfaces.green;
  if (g) {
    const dx = x - g.cx, dz = z - g.cz;
    if (dx * dx + dz * dz < g.radius * g.radius) return 'green';
  }

  const bs = surfaces.bunkers;
  if (bs) {
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      const dx = x - b.cx, dz = z - b.cz;
      if (dx * dx + dz * dz < b.radius * b.radius) return 'sand';
    }
  }

  const fws = surfaces.fairwayRects;
  if (fws) {
    for (let i = 0; i < fws.length; i++) {
      const r = fws[i];
      if (Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cz) <= r.h / 2) return 'fairway';
    }
  }

  const ws = surfaces.water;
  if (ws) {
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.type === 'circle') {
        const dx = x - w.cx, dz = z - w.cz;
        if (dx * dx + dz * dz < w.radius * w.radius) return 'water';
      } else {
        if (Math.abs(x - w.cx) <= w.w / 2 && Math.abs(z - w.cz) <= w.h / 2) return 'water';
      }
    }
  }

  return 'rough';
}

export class BallPhysics {
  constructor({ teePosition, cupPosition }) {
    this.tee = teePosition.clone();
    this.cup = cupPosition.clone();

    this.position = teePosition.clone();
    this.position.y = BALL_RADIUS;
    // previousPosition tracks where the ball was BEFORE the most recent step.
    // The render loop interpolates between prev and current using the leftover
    // accumulator value, which keeps the ball visually smooth on devices that
    // render faster than the physics step rate (e.g., 120 Hz phones).
    this.previousPosition = this.position.clone();
    this.velocity = new Vector3();
    this.surfaces = null; // assigned via setHole — fairway/green/sand layout for this hole
    // Position the ball was at when the most recent shot launched. If the shot
    // ends in water, host code teleports the ball back here + a penalty stroke.
    this.lastShotStart = this.position.clone();
    this.isInWater = false;

    this.isAtRest = true;
    this.isHoled = false;

    // Cup capture radius. Default = CUP_RADIUS; the host overrides this
    // per-hole to support boss handicaps like Tiny Cup.
    this.cupRadius = CUP_RADIUS;

    // Item hook — items can multiply the vertical bounce energy retained on
    // ground contact. 1.0 = default; Bouncy Ball pushes this up. Host should
    // refresh this before each shot from current run state.
    this.bounceMultiplier = 1.0;

    // Wind — host writes {x,z} acceleration before each hole. Applied
    // ONLY while the ball is airborne; rolling balls aren't affected.
    this.windForce = { x: 0, z: 0 };

    // Surface remap — used by ball items that change how a surface plays.
    // Floaty Ball maps water → fairway (no splash penalty).
    // All-Terrain Ball maps rough → fairway (no friction penalty).
    // Empty by default (vanilla physics).
    this.surfaceMap = {};

    // Mid-air spin — host (SpinController) sets this while the ball is
    // airborne. One spin per shot, cleared on launch.
    //   'back'  → kills horizontal momentum on first ground contact
    //   'top'   → boosts horizontal momentum on first ground contact
    //   'hook'  → applies leftward perpendicular acceleration in flight
    //   'slice' → applies rightward perpendicular acceleration in flight
    this.spin = null;
    this._spinAppliedOnContact = false;

    // callbacks the host wires up
    this.onHoled = null;
    this.onCameToRest = null;
    // Fired on each ground bounce (bounce branch only, not on rolling). Args:
    //   intensity — incoming downward speed normalized to roughly 0..1
    //   surface   — 'fairway' | 'green' | 'rough' | 'sand' | 'water'
    this.onBounce = null;
  }

  reset() {
    this.position.copy(this.tee);
    this.position.y = BALL_RADIUS;
    this.previousPosition.copy(this.position);
    this.lastShotStart.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isAtRest = true;
    this.isHoled = false;
    this.isInWater = false;
  }

  /** Move tee/cup for a new hole, set the surface map, and reset the ball. */
  setHole(teePosition, cupPosition, surfaces) {
    this.tee.copy(teePosition);
    this.cup.copy(cupPosition);
    this.surfaces = surfaces || null;
    this.reset();
  }

  /** Launch the ball with a given velocity vector. */
  launch(velocity) {
    // sync prev → current so interpolation doesn't ghost back to an old position
    this.previousPosition.copy(this.position);
    // remember where the shot started in case it ends in water (penalty replay)
    this.lastShotStart.copy(this.position);
    this.velocity.copy(velocity);
    this.isAtRest = false;
    this.isHoled = false;
    this.isInWater = false;
    // Spin is per-shot — cleared on every launch so applying spin mid-air
    // on shot N never bleeds into shot N+1.
    this.spin = null;
    this._spinAppliedOnContact = false;
  }

  step(dt) {
    // remember where we were before this step so the renderer can interpolate
    this.previousPosition.copy(this.position);

    if (this.isAtRest || this.isHoled) return;

    // gravity (vertical only)
    this.velocity.y += GRAVITY * dt;

    // wind — only nudges the ball while it's airborne; once rolling on
    // the ground, surface friction takes over and wind is irrelevant.
    if (this.position.y > BALL_RADIUS + 0.02) {
      this.velocity.x += this.windForce.x * dt;
      this.velocity.z += this.windForce.z * dt;

      // Sidespin (hook/slice) — accelerate perpendicular to current
      // horizontal direction. Hook = left, slice = right (relative to the
      // ball's forward motion, NOT the camera, so a curving ball stays
      // intuitive even after the player rotates the view post-shot).
      if (this.spin === 'hook' || this.spin === 'slice') {
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 0.5) {
          const sign = this.spin === 'slice' ? 1 : -1;
          // perpendicular vector in XZ (rotated +90° from forward)
          const perpX = -this.velocity.z / horizSpeed * sign;
          const perpZ =  this.velocity.x / horizSpeed * sign;
          const SIDESPIN_ACCEL = 14;
          this.velocity.x += perpX * SIDESPIN_ACCEL * dt;
          this.velocity.z += perpZ * SIDESPIN_ACCEL * dt;
        }
      }
    }

    // air drag — proportional to speed²
    const speed = this.velocity.length();
    if (speed > 0) {
      const drag = AIR_DRAG * speed * speed;
      const scaledLoss = Math.min(1, (drag * dt) / speed);
      this.velocity.multiplyScalar(1 - scaledLoss);
    }

    // integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // ground collision
    if (this.position.y <= BALL_RADIUS) {
      this.position.y = BALL_RADIUS;

      let surface = getSurfaceAt(this.surfaces, this.position.x, this.position.z);
      // Item-driven surface remap (Floaty / All-Terrain balls).
      if (this.surfaceMap[surface]) surface = this.surfaceMap[surface];

      // Water: ball splashes, stops dead. Host detects isInWater on rest and
      // applies a +1 penalty + ball replay.
      if (surface === 'water') {
        this.velocity.set(0, 0, 0);
        this.isInWater = true;
        this.isAtRest = true;
        if (this.onCameToRest) this.onCameToRest();
        return;
      }

      const mod = SURFACE_MODIFIERS[surface];

      if (this.velocity.y < BOUNCE_VY_THRESHOLD) {
        // bounce — surface attenuates both vertical and horizontal energy.
        // bounceMultiplier (Bouncy Ball) scales just the vertical retention.
        const incomingDown = -this.velocity.y;
        this.velocity.y = -this.velocity.y * BOUNCE * mod.bounce * this.bounceMultiplier;
        this.velocity.x *= BOUNCE_FRICTION * mod.bounceFriction;
        this.velocity.z *= BOUNCE_FRICTION * mod.bounceFriction;
        // Backspin / topspin land their effect on the FIRST bounce only —
        // back kills outgoing horizontal speed (ball stops fast on greens),
        // top boosts it (ball runs out further). Marked applied so we don't
        // re-fire on later bounces.
        if (!this._spinAppliedOnContact && (this.spin === 'back' || this.spin === 'top')) {
          const k = this.spin === 'back' ? 0.30 : 1.45;
          this.velocity.x *= k;
          this.velocity.z *= k;
          if (this.spin === 'top') {
            // Topspin also flattens the bounce so the ball stays low and rolls.
            this.velocity.y *= 0.45;
          }
          this._spinAppliedOnContact = true;
        }
        if (this.onBounce) this.onBounce(Math.min(1, incomingDown / 30), surface);
      } else {
        // rolling — friction scaled by surface
        this.velocity.y = 0;
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 0) {
          const newSpeed = Math.max(0, horizSpeed - ROLL_DECEL * mod.friction * dt);
          const ratio = newSpeed / horizSpeed;
          this.velocity.x *= ratio;
          this.velocity.z *= ratio;
        }

        if (Math.hypot(this.velocity.x, this.velocity.z) < REST_SPEED) {
          this.velocity.set(0, 0, 0);
          this.isAtRest = true;
          if (this.onCameToRest) this.onCameToRest();
        }
      }
    }

    // cup detection — ball must be on or near the ground AND not flying past
    const dx = this.position.x - this.cup.x;
    const dz = this.position.z - this.cup.z;
    const distToCupXZ = Math.hypot(dx, dz);
    const speedNow = this.velocity.length();
    if (
      distToCupXZ < this.cupRadius &&
      this.position.y < BALL_RADIUS * 1.5 &&
      speedNow < CUP_CAPTURE_SPEED
    ) {
      this.isHoled = true;
      this.velocity.set(0, 0, 0);
      // drop the ball into the cup visually
      this.position.set(this.cup.x, -0.3, this.cup.z);
      if (this.onHoled) this.onHoled();
    }
  }
}

// ---------------------------------------------------------------------------
// Trajectory predictor — used by SwingController to show where the ball will
// stop. SYNC: keep this in sync with BallPhysics.step. We deliberately don't
// share the implementation because predictRest needs to be a pure function
// (no side effects, no callbacks, no cup detection) for fast repeated calls.
// ---------------------------------------------------------------------------

// Use the SAME timestep as the actual physics loop so prediction and
// simulation stay in lock-step. Both run at 1/60 sec fixed.
export const PREDICT_DT = 1 / 60;
const PREDICT_MAX_STEPS = 1500;       // ~25 sec — plenty for any shot
const SAMPLE_INTERVAL = 3;            // emit a trajectory sample every N steps (~20Hz)
const MAX_SAMPLES = 60;               // hard cap on trajectory points returned

/** One physics sub-step. Mutates the {p, v} pair. Returns true once at rest. */
function _step(p, v, surfaces, bounceMultiplier = 1.0, windForce = { x: 0, z: 0 }, surfaceMap = {}) {
  v.y += GRAVITY * PREDICT_DT;

  // Wind — same airborne-only gate as the live physics step.
  if (p.y > BALL_RADIUS + 0.02) {
    v.x += windForce.x * PREDICT_DT;
    v.z += windForce.z * PREDICT_DT;
  }

  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (speed > 0) {
    const drag = AIR_DRAG * speed * speed;
    const loss = Math.min(1, (drag * PREDICT_DT) / speed);
    const k = 1 - loss;
    v.x *= k; v.y *= k; v.z *= k;
  }

  p.x += v.x * PREDICT_DT;
  p.y += v.y * PREDICT_DT;
  p.z += v.z * PREDICT_DT;

  if (p.y <= BALL_RADIUS) {
    p.y = BALL_RADIUS;
    let surface = getSurfaceAt(surfaces, p.x, p.z);
    if (surfaceMap[surface]) surface = surfaceMap[surface];

    // Water in the predictor too — ball stops here so the cyan ring lands at the splash spot.
    if (surface === 'water') {
      v.x = 0; v.y = 0; v.z = 0;
      return true;
    }

    const mod = SURFACE_MODIFIERS[surface];

    if (v.y < BOUNCE_VY_THRESHOLD) {
      v.y = -v.y * BOUNCE * mod.bounce * bounceMultiplier;
      v.x *= BOUNCE_FRICTION * mod.bounceFriction;
      v.z *= BOUNCE_FRICTION * mod.bounceFriction;
    } else {
      v.y = 0;
      const horiz = Math.hypot(v.x, v.z);
      if (horiz > 0) {
        const newSpeed = Math.max(0, horiz - ROLL_DECEL * mod.friction * PREDICT_DT);
        const ratio = newSpeed / horiz;
        v.x *= ratio; v.z *= ratio;
      }
      if (Math.hypot(v.x, v.z) < REST_SPEED) return true;
    }
  }
  return false;
}

/**
 * Forward-simulate to final rest. Returns { x, y, z } of resting position.
 * Used by the cyan ground ring + minimap target circle.
 */
export function predictRest(startPos, startVel, surfaces, bounceMultiplier = 1.0, windForce = { x: 0, z: 0 }, surfaceMap = {}) {
  const p = { x: startPos.x, y: startPos.y, z: startPos.z };
  const v = { x: startVel.x, y: startVel.y, z: startVel.z };
  for (let i = 0; i < PREDICT_MAX_STEPS; i++) {
    if (_step(p, v, surfaces, bounceMultiplier, windForce, surfaceMap)) return { x: p.x, y: p.y, z: p.z };
  }
  return { x: p.x, y: p.y, z: p.z };
}

/**
 * Forward-simulate AND return sampled trajectory points + final rest.
 *
 * Returns:
 *   samples — full trajectory dots (used by the minimap)
 *   rest    — final XZ resting position (used by the cyan ground ring)
 *   firstContactIdx — index in `samples` of the first sample at-or-after the
 *                     ball's first ground contact. Used to truncate the
 *                     3D orb display to the airborne arc only — the part
 *                     of the prediction that's most informative to the player.
 */
export function predictTrajectory(startPos, startVel, surfaces, bounceMultiplier = 1.0, windForce = { x: 0, z: 0 }, surfaceMap = {}) {
  const p = { x: startPos.x, y: startPos.y, z: startPos.z };
  const v = { x: startVel.x, y: startVel.y, z: startVel.z };
  const samples = [];

  let firstContactIdx = -1;
  // Exact ball position the moment it first touches the ground — used by the
  // minimap red ring. The nearest sample can be up to SAMPLE_INTERVAL steps
  // (~3 yd at full power) before actual contact, which makes the marker look
  // like it's "lying" about where the ball lands.
  let firstContactPos = null;
  let wasAirborne = p.y > BALL_RADIUS + 0.05;

  for (let i = 0; i < PREDICT_MAX_STEPS; i++) {
    if (i % SAMPLE_INTERVAL === 0 && samples.length < MAX_SAMPLES) {
      samples.push({ x: p.x, y: p.y, z: p.z });
    }

    const atRest = _step(p, v, surfaces, bounceMultiplier, windForce, surfaceMap);

    if (firstContactIdx < 0 && wasAirborne && p.y <= BALL_RADIUS + 0.05) {
      firstContactIdx = Math.max(0, samples.length - 1);
      firstContactPos = { x: p.x, y: p.y, z: p.z };
    }
    wasAirborne = p.y > BALL_RADIUS + 0.05;

    if (atRest) {
      const rest = { x: p.x, y: p.y, z: p.z };
      if (!samples.length || samples[samples.length - 1] !== rest) {
        samples.push(rest);
      }
      return {
        samples,
        rest,
        firstContactIdx: firstContactIdx < 0 ? samples.length - 1 : firstContactIdx,
        firstContactPos: firstContactPos || rest,
      };
    }
  }

  const rest = { x: p.x, y: p.y, z: p.z };
  return {
    samples,
    rest,
    firstContactIdx: firstContactIdx < 0 ? samples.length - 1 : firstContactIdx,
    firstContactPos: firstContactPos || rest,
  };
}
