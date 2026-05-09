// Wind — Phase 4s
//
// Per-hole wind state. Stored as an angle (radians, 0 = world +X axis) plus
// a scalar speed. Speed is the magnitude of the constant XZ acceleration
// applied to an airborne ball (yards/sec², game units).
//
// Wind is rolled fresh on each loadCurrentHole. Speed scales mildly with
// hole number so later holes are gustier — early holes feel calm, late
// holes get pushy.
//
// Items can soften or override the result:
//   Heavy Ball (ball)    — wind ×0.5
//   Wind Charm (trinket) — wind ×0
//   Tailwind Talisman    — direction overridden to point tee→cup

import { Vector3 } from 'three';

export class Wind {
  constructor() {
    this.angle = 0;
    this.speed = 0;
    this.direction = new Vector3();
  }

  /** Roll a fresh random wind for the given hole. */
  rollForHole(holeNumber = 1) {
    this.angle = Math.random() * Math.PI * 2;
    this.direction.set(Math.cos(this.angle), 0, Math.sin(this.angle));
    // Magnitude in yd/s² of horizontal acceleration on the ball. Tuned
    // gentle: a 2-second air shot drifts roughly speed×2 yards by the time
    // it lands. Hole 1 lands ~0.8–2.4 base, hole 9 ~1.4–4.3.
    const base = 0.8 + Math.random() * 1.6;
    const tier = 1 + Math.max(0, holeNumber - 1) * 0.10;
    this.speed = base * tier;
  }

  /** Override the angle (keeps speed). Used by Tailwind Talisman to point
   *  the wind from tee to cup so the player gets a useful tailwind. */
  setAngle(angle) {
    this.angle = angle;
    this.direction.set(Math.cos(angle), 0, Math.sin(angle));
  }

  /** Effective acceleration applied to the airborne ball, given a 0..1
   *  multiplier (mitigation items push toward 0). Returned as plain
   *  {x,z} to match BallPhysics' windForce shape. */
  effectiveForce(multiplier = 1) {
    const m = Math.max(0, multiplier);
    return {
      x: this.direction.x * this.speed * m,
      z: this.direction.z * this.speed * m,
    };
  }
}
