// PowerMeter — Phase 2
//
// Tall thin vertical bar pinned to the left edge. Fills bottom-up as the
// player drags back. Hue runs green → yellow → red. Hidden when no swing
// is in progress.

export class PowerMeter {
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'power-meter';

    this.fill = document.createElement('div');
    this.fill.id = 'power-meter-fill';
    this.container.appendChild(this.fill);

    this.label = document.createElement('div');
    this.label.id = 'power-meter-label';
    this.label.textContent = '0%';
    this.container.appendChild(this.label);

    document.body.appendChild(this.container);
    this.set(null);
  }

  /**
   * Show the meter at `power` (0..1). Pass `{ cancel: true }` to switch to
   * the "release here to cancel" indicator — bar shows in muted red with
   * a CANCEL label so the player knows their next release won't fire.
   */
  set(power, opts = {}) {
    if (power == null) {
      this.container.style.opacity = '0';
      return;
    }
    this.container.style.opacity = '1';
    const pct = Math.max(0, Math.min(1, power));
    this.fill.style.height = `${pct * 100}%`;
    if (opts.cancel) {
      this.fill.style.background = 'hsl(0, 55%, 38%)';
      this.label.textContent = 'CANCEL';
    } else {
      // green (120°) at 0% → red (0°) at 100%
      const hue = 120 - pct * 120;
      this.fill.style.background = `hsl(${hue}, 85%, 50%)`;
      this.label.textContent = `${Math.round(pct * 100)}%`;
    }
  }
}
