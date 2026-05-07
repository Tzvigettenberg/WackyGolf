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

  set(power) {
    if (power == null) {
      this.container.style.opacity = '0';
      return;
    }
    this.container.style.opacity = '1';
    const pct = Math.max(0, Math.min(1, power));
    this.fill.style.height = `${pct * 100}%`;
    // green (120°) at 0% → red (0°) at 100%
    const hue = 120 - pct * 120;
    this.fill.style.background = `hsl(${hue}, 85%, 50%)`;
    this.label.textContent = `${Math.round(pct * 100)}%`;
  }
}
