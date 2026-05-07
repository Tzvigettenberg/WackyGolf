// RotateControls — Phase 2.3
//
// Two semi-transparent rotate buttons on left/right edges of the screen.
// Press for an instant step rotation, hold for continuous rotation.

const STEP_DEGREES = 22.5;
const STEP_RAD = (STEP_DEGREES * Math.PI) / 180;
const HOLD_DELAY_MS = 220;             // wait this long before continuous rotation kicks in
const CONT_RATE_RAD_S = Math.PI;       // 180°/sec while holding — feels snappy

export class RotateControls {
  constructor(followCamera) {
    this.followCamera = followCamera;

    this.left = this._makeButton('rotate-left', '↺', 'Rotate camera left');
    this.right = this._makeButton('rotate-right', '↻', 'Rotate camera right');

    this._wire(this.left, -1);
    this._wire(this.right, +1);

    document.body.appendChild(this.left);
    document.body.appendChild(this.right);

    this._holdDir = 0;
    this._holdTimer = null;
    this._lastTickTime = 0;
    this._rafId = null;
  }

  _makeButton(id, glyph, label) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'rotate-btn';
    btn.textContent = glyph;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('type', 'button');
    return btn;
  }

  _wire(btn, sign) {
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // capture so pointerup still fires on this button if finger drifts
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      this._press(sign);
    });

    const release = (e) => {
      if (e) e.stopPropagation();
      this._release();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  _press(sign) {
    // 1) immediate single-step rotation — guarantees a tap is felt
    this.followCamera.rotate(sign * STEP_RAD);

    // 2) start hold-to-spin after a short delay
    this._holdDir = sign;
    clearTimeout(this._holdTimer);
    this._holdTimer = setTimeout(() => {
      this._lastTickTime = performance.now();
      this._tick();
    }, HOLD_DELAY_MS);
  }

  _release() {
    this._holdDir = 0;
    clearTimeout(this._holdTimer);
    this._holdTimer = null;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick = () => {
    if (this._holdDir === 0) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastTickTime) / 1000);
    this._lastTickTime = now;
    this.followCamera.rotate(this._holdDir * CONT_RATE_RAD_S * dt);
    this._rafId = requestAnimationFrame(this._tick);
  };
}
