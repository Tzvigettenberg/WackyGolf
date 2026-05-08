// In-game ItemBar — Phase 4b
//
// Small vertical strip on the right edge under the minimap. One pill per
// owned item instance. Pills have three visual states:
//
//   idle      — held but not relevant to whatever's happening right now
//   active    — its conditions are currently being met (e.g. driver selected
//               while you own Driver Specialist; or always-on items like
//               Range Finder, Bouncy Ball, Heavy Driver)
//   triggered — a brief glow/pulse the moment the item PAID OUT (a shot
//               applying its bonus, hole-start payout, sand bonus, etc.)
//
// The host (main.js) drives state via:
//   itemBar.update({ run, club, isAiming, isAtRest })   — every frame, cheap
//   itemBar.trigger(itemId)                              — at gameplay events
//
// Triggered pulses last TRIGGER_MS and stack onto whatever the active state
// would otherwise be.

import { itemById } from '../content/items.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

const TRIGGER_MS = 700;

// Item ids whose effect is always passively in play once owned. These will
// always render as "active" — no conditional check needed.
const ALWAYS_ACTIVE = new Set([
  'heavy-driver',
  'country-club-card',
  'compound-interest',
  'range-finder',
  'bouncy-ball',
  'trust-fund',     // pays at hole start regardless of conditions
  'sandbagger',     // pays whenever ball lands in sand regardless
  'fairway-finder', // pays whenever ball rests on fairway
  'hole-hustler',   // pays at hole-out
]);

export class ItemBar {
  constructor({ run }) {
    this.run = run;

    // Build the host element. Floats on the right, below the minimap.
    this.el = document.createElement('div');
    this.el.id = 'item-bar';
    document.body.appendChild(this.el);

    // Cached rendered slot DOM. Rebuilt only when the items array changes
    // (length or composition), so update() per frame stays cheap.
    this._renderedKey = '';
    this._slotEls = [];

    // Per-slot trigger timestamps so flashes auto-clear.
    this._triggerUntil = new Map(); // slotIndex → ms timestamp

    run.onChange(() => this._rebuild());
    this._rebuild();
  }

  /** Cheap per-frame state push from main.js. */
  update({ club, isAiming, isAtRest }) {
    const items = this.run.items;
    const now = performance.now();
    const clubId = club && club.id;

    for (let i = 0; i < items.length; i++) {
      const id = items[i];
      const slot = this._slotEls[i];
      if (!slot) continue;

      // active = its effect would apply RIGHT NOW
      let active = ALWAYS_ACTIVE.has(id);
      if (id === 'lucky-tee')         active = this.run.strokes === 0;
      if (id === 'driver-specialist') active = clubId === 'driver';
      if (id === 'lead-wedge')        active = clubId === 'wedge';
      if (id === 'eagle-eye')         active = !!isAiming;

      const triggered = (this._triggerUntil.get(i) || 0) > now;

      slot.classList.toggle('active', active && !triggered);
      slot.classList.toggle('triggered', triggered);
    }

    // Auto-clear stale trigger timestamps (cheap — Map stays small).
    if (this._triggerUntil.size) {
      for (const [k, t] of this._triggerUntil) {
        if (t <= now) this._triggerUntil.delete(k);
      }
    }
  }

  /**
   * Flash every owned slot whose item id matches `itemId`. Use at gameplay
   * events (a shot was fired with bonus X applied, ball landed in bunker, etc.)
   * The pulse lasts TRIGGER_MS regardless of whether `update` is called.
   */
  trigger(itemId) {
    const until = performance.now() + TRIGGER_MS;
    const items = this.run.items;
    let any = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === itemId) {
        this._triggerUntil.set(i, until);
        const slot = this._slotEls[i];
        if (slot) slot.classList.add('triggered');
        any = true;
      }
    }
    return any;
  }

  /** Hide the bar (used during title/pause via body class). */
  setVisible(visible) {
    this.el.style.display = visible ? '' : 'none';
  }

  // ----- internals -----

  _rebuild() {
    const items = this.run.items;
    const key = items.join('|');
    if (key === this._renderedKey) return;
    this._renderedKey = key;

    this.el.innerHTML = '';
    this._slotEls = [];
    this._triggerUntil.clear();

    for (let i = 0; i < items.length; i++) {
      const id = items[i];
      const item = itemById(id);
      if (!item) continue;
      const slot = document.createElement('div');
      slot.className = 'item-pill';
      slot.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
      slot.title = `${item.name} — ${item.desc}`;
      slot.innerHTML = `<i class="pill-icon ${item.icon || 'fa-solid fa-circle'}"></i>`;
      this.el.appendChild(slot);
      this._slotEls.push(slot);
    }
  }
}
