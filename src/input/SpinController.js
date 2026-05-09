// SpinController — Phase 4u
//
// Detects swipe gestures on the canvas WHILE the ball is airborne and
// converts them into spin commands. Sits alongside SwingController:
// SwingController bails out when the ball isn't at rest, so the canvas
// pointer events are free during flight.
//
// Swipe direction → spin:
//   down  → backspin   (kills horizontal momentum on first ground contact)
//   up    → topspin    (boosts horizontal momentum on first ground contact)
//   left  → hook       (curves left in flight)
//   right → slice      (curves right in flight)
//
// Only ONE spin per shot. Once applied, further swipes are ignored until
// the ball comes to rest and a new shot launches.

const MIN_SWIPE_PX = 28;            // ignore tiny finger jitters

const UI_BLOCK_SELECTOR = '#club-selector, #minimap, #hud-top, #wind-indicator, #item-bar, button';

export class SpinController {
  constructor({ ball, canvas, onSpin }) {
    this.ball = ball;
    this.canvas = canvas;
    this.onSpin = onSpin || (() => {});

    this.tracking = false;
    this.startX = 0;
    this.startY = 0;
    this.activePointerId = null;

    this.canvas.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
  }

  /** Per-frame check — true if the ball is mid-flight and accepting input. */
  _isAirborne() {
    return !this.ball.isAtRest && !this.ball.isHoled;
  }

  _onDown = (e) => {
    if (!this._isAirborne()) return;
    if (this.ball.spin) return;                  // already applied this shot
    if (e.isPrimary === false) return;
    if (e.target && e.target.closest && e.target.closest(UI_BLOCK_SELECTOR)) return;
    this.tracking = true;
    this.activePointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    e.preventDefault();
  };

  _onMove = (e) => {
    // We don't need real-time updates — the spin is decided at release.
    // Just guard against losing the gesture if the finger drifts.
    if (!this.tracking) return;
    if (e.pointerId !== this.activePointerId) return;
  };

  _onUp = (e) => {
    if (!this.tracking) return;
    if (e.pointerId !== this.activePointerId) return;
    this.tracking = false;
    this.activePointerId = null;

    // If the ball came to rest (or holed) mid-swipe, bail.
    if (!this._isAirborne()) return;
    if (this.ball.spin) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const len = Math.hypot(dx, dy);
    if (len < MIN_SWIPE_PX) return;

    let spin;
    if (Math.abs(dy) > Math.abs(dx)) {
      spin = dy > 0 ? 'back' : 'top';
    } else {
      spin = dx > 0 ? 'slice' : 'hook';
    }

    this.ball.spin = spin;
    this.ball._spinAppliedOnContact = false;
    this.onSpin(spin);
  };
}
