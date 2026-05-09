// FollowCamera — Phase 2.6
//
// Sits behind the ball at a fixed offset. Tracks both ball motion AND yaw
// independently:
//   - `targetYaw` is what RotateControls writes to (jumps instantly).
//   - `yaw` is what we actually use to compute camera position; it eases
//     toward targetYaw each frame so rotation traces a smooth circular arc
//     around the ball rather than lerping linearly through space.

import { Vector3 } from 'three';

const BASE_OFFSET = new Vector3(0, 7, 13);     // behind & above when yaw = 0
const BASE_LOOK   = new Vector3(0, 0, -14);    // look point relative to ball — further downrange now that holes are bigger
const POS_LERP    = 0.32;                      // camera position chase rate
const YAW_LERP    = 0.18;                      // yaw catch-up rate (per frame)

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.targetYaw = 0;

    this._desired = new Vector3();
    this._lookAt  = new Vector3();
    this._rotated = new Vector3();
    this._initialized = false;
    // Host sets this true while the player is mid-pull-back. While frozen
    // we skip ALL easing (yaw + position) so the camera holds dead still
    // and the swing aim doesn't drift.
    this.frozen = false;
  }

  /** Set the rotation goal — actual yaw will ease toward it. */
  rotate(deltaRadians) {
    this.targetYaw += deltaRadians;
  }

  /** Snap immediately into position (e.g., on hole start). */
  snap(ballPos) {
    this.yaw = this.targetYaw;
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
    // Frozen: hold whatever camera state we last computed. The yaw/pos
    // lerps stop completely, so a swing pull-back doesn't see the camera
    // drift mid-aim.
    if (this.frozen) return;

    // ease yaw toward target so rotation traces an arc
    const yawErr = this.targetYaw - this.yaw;
    if (Math.abs(yawErr) < 0.0008) {
      this.yaw = this.targetYaw;
    } else {
      this.yaw += yawErr * YAW_LERP;
    }

    this._applyYaw(BASE_OFFSET, this._rotated);
    this._desired.copy(ballPos).add(this._rotated);
    this.camera.position.lerp(this._desired, POS_LERP);

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
