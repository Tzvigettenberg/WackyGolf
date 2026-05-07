// FollowCamera — Phase 2
//
// Sits behind the ball at a fixed offset. Lerps toward the desired position
// each frame for a smooth feel. The whole rig can be yawed around the ball
// via rotate(deltaRadians) — used by the on-screen rotate buttons.

import { Vector3 } from 'three';

const BASE_OFFSET = new Vector3(0, 6, 11);     // behind & above when yaw = 0
const BASE_LOOK   = new Vector3(0, 0, -6);     // look point relative to ball when yaw = 0
const LERP = 0.22;                             // 0–1 per frame; bumped for snappy rotation response

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // radians, 0 = facing -Z (cup)

    this._desired   = new Vector3();
    this._lookAt    = new Vector3();
    this._rotated   = new Vector3();
    this._initialized = false;
  }

  /** Add to the current yaw. Positive value rotates the view clockwise (looking from above). */
  rotate(deltaRadians) {
    this.yaw += deltaRadians;
  }

  /** Snap immediately into position (e.g., on hole start). */
  snap(ballPos) {
    this._applyYaw(BASE_OFFSET, this._rotated);
    this._desired.copy(ballPos).add(this._rotated);

    this._applyYaw(BASE_LOOK, this._rotated);
    this._lookAt.copy(ballPos).add(this._rotated);

    this.camera.position.copy(this._desired);
    this.camera.lookAt(this._lookAt);
    this._initialized = true;
  }

  update(ballPos /*, dt */) {
    if (!this._initialized) {
      this.snap(ballPos);
      return;
    }

    this._applyYaw(BASE_OFFSET, this._rotated);
    this._desired.copy(ballPos).add(this._rotated);
    this.camera.position.lerp(this._desired, LERP);

    this._applyYaw(BASE_LOOK, this._rotated);
    this._lookAt.copy(ballPos).add(this._rotated);
    this.camera.lookAt(this._lookAt);
  }

  /** Rotate `src` around world Y by this.yaw, write result into `out`. */
  _applyYaw(src, out) {
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const x = src.x * c - src.z * s;
    const z = src.x * s + src.z * c;
    out.set(x, src.y, z);
  }
}
