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

    this.isAtRest = true;
    this.isHoled = false;

    // callbacks the host wires up
    this.onHoled = null;
    this.onCameToRest = null;
  }

  reset() {
    this.position.copy(this.tee);
    this.position.y = BALL_RADIUS;
    this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isAtRest = true;
    this.isHoled = false;
  }

  /** Launch the ball with a given velocity vector. */
  launch(velocity) {
    // sync prev → current so interpolation doesn't ghost back to an old position
    this.previousPosition.copy(this.position);
    this.velocity.copy(velocity);
    this.isAtRest = false;
    this.isHoled = false;
  }

  step(dt) {
    // remember where we were before this step so the renderer can interpolate
    this.previousPosition.copy(this.position);

    if (this.isAtRest || this.isHoled) return;

    // gravity (vertical only)
    this.velocity.y += GRAVITY * dt;

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

      if (this.velocity.y < BOUNCE_VY_THRESHOLD) {
        // bounce
        this.velocity.y = -this.velocity.y * BOUNCE;
        this.velocity.x *= BOUNCE_FRICTION;
        this.velocity.z *= BOUNCE_FRICTION;
      } else {
        // rolling
        this.velocity.y = 0;

        // roll friction on the XZ plane
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 0) {
          const newSpeed = Math.max(0, horizSpeed - ROLL_DECEL * dt);
          const ratio = newSpeed / horizSpeed;
          this.velocity.x *= ratio;
          this.velocity.z *= ratio;
        }

        // come to rest below threshold
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
      distToCupXZ < CUP_RADIUS &&
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
function _step(p, v) {
  v.y += GRAVITY * PREDICT_DT;

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
    if (v.y < BOUNCE_VY_THRESHOLD) {
      v.y = -v.y * BOUNCE;
      v.x *= BOUNCE_FRICTION;
      v.z *= BOUNCE_FRICTION;
    } else {
      v.y = 0;
      const horiz = Math.hypot(v.x, v.z);
      if (horiz > 0) {
        const newSpeed = Math.max(0, horiz - ROLL_DECEL * PREDICT_DT);
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
export function predictRest(startPos, startVel) {
  const p = { x: startPos.x, y: startPos.y, z: startPos.z };
  const v = { x: startVel.x, y: startVel.y, z: startVel.z };
  for (let i = 0; i < PREDICT_MAX_STEPS; i++) {
    if (_step(p, v)) return { x: p.x, y: p.y, z: p.z };
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
export function predictTrajectory(startPos, startVel) {
  const p = { x: startPos.x, y: startPos.y, z: startPos.z };
  const v = { x: startVel.x, y: startVel.y, z: startVel.z };
  const samples = [];

  let firstContactIdx = -1;
  let wasAirborne = p.y > BALL_RADIUS + 0.05;

  for (let i = 0; i < PREDICT_MAX_STEPS; i++) {
    if (i % SAMPLE_INTERVAL === 0 && samples.length < MAX_SAMPLES) {
      samples.push({ x: p.x, y: p.y, z: p.z });
    }

    const atRest = _step(p, v);

    if (firstContactIdx < 0 && wasAirborne && p.y <= BALL_RADIUS + 0.05) {
      firstContactIdx = Math.max(0, samples.length - 1);
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
      };
    }
  }

  const rest = { x: p.x, y: p.y, z: p.z };
  return {
    samples,
    rest,
    firstContactIdx: firstContactIdx < 0 ? samples.length - 1 : firstContactIdx,
  };
}
