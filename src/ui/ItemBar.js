// In-game ItemBar — Phase 4g
//
// Vertical strip on the right edge under the minimap. Shows one pill per
// owned item — both bag trinkets and the equipped equipment slot (ball).
//
// Each pill has three visual states:
//   idle      — held but not relevant to the current moment
//   active    — its conditions are currently being met (e.g. driver selected
//               while you own Driver Specialist; or always-on items)
//   triggered — a brief glow/pulse the moment the item PAID OUT
//
// Pills are tappable: tapping opens a small popover with the item's name +
// description (so you can remember what each pill does without going to
// the shop).
//
// trigger(id, text?) optionally floats a small "+$2" / "+10% Power" label
// next to the pill that fades out after ~1.4s — so the player sees what
// just happened, not just that something happened.
//
// Host (main.js) drives state via:
//   itemBar.update({ run, club, isAiming, isAtRest })   — every frame, cheap
//   itemBar.trigger(itemId, optionalText)                — at gameplay events

import { itemById } from '../content/items.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

const TRIGGER_MS = 700;
const FLOAT_TEXT_MS = 1400;

const ALWAYS_ACTIVE = new Set([
  'heavy-driver',
  'country-club-card',
  'compound-interest',
  'range-finder',
  'bouncy-ball',
  'golden-ball',
  'heavy-ball',
  'floaty-ball',
  'all-terrain-ball',
  'wind-charm',
  'tailwind-talisman',
  'weather-vane',
  'trust-fund',
  'sandbagger',
  'fairway-finder',
  'hole-hustler',
]);

export class ItemBar {
  constructor({ run }) {
    this.run = run;

    this.el = document.createElement('div');
    this.el.id = 'item-bar';
    document.body.appendChild(this.el);

    // Floating popover for tap-to-explain.
    this.popoverEl = document.createElement('div');
    this.popoverEl.id = 'item-bar-popover';
    document.body.appendChild(this.popoverEl);
    this._popoverItemId = null;

    // Dismiss popover when tapping anywhere outside it.
    document.addEventListener('pointerdown', (e) => {
      if (!this._popoverItemId) return;
      if (this.popoverEl.contains(e.target)) return;
      if (this.el.contains(e.target)) return; // pill clicks handled separately
      this._hidePopover();
    });

    this._renderedKey = '';
    this._slotEls = [];
    this._slotMeta = []; // { id, isEquipment } per pill

    this._triggerUntil = new Map();

    run.onChange(() => this._rebuild());
    this._rebuild();
  }

  /** Cheap per-frame state push. */
  update({ club, isAiming }) {
    const now = performance.now();
    const clubId = club && club.id;

    for (let i = 0; i < this._slotMeta.length; i++) {
      const { id } = this._slotMeta[i];
      const slot = this._slotEls[i];
      if (!slot) continue;

      let active = ALWAYS_ACTIVE.has(id);
      if (id === 'lucky-tee')         active = this.run.strokes === 0;
      if (id === 'driver-specialist') active = clubId === 'driver';
      if (id === 'lead-wedge')        active = clubId === 'wedge';
      if (id === 'eagle-eye')         active = !!isAiming;

      const triggered = (this._triggerUntil.get(i) || 0) > now;
      slot.classList.toggle('active', active && !triggered);
      slot.classList.toggle('triggered', triggered);
    }

    if (this._triggerUntil.size) {
      for (const [k, t] of this._triggerUntil) {
        if (t <= now) this._triggerUntil.delete(k);
      }
    }
  }

  /**
   * Pulse every pill matching itemId. Optional floatText shows briefly next
   * to the pill — pass strings like "+$2" or "+10% Power" so the player
   * sees what the item just did.
   */
  trigger(itemId, floatText) {
    const until = performance.now() + TRIGGER_MS;
    let any = false;
    for (let i = 0; i < this._slotMeta.length; i++) {
      if (this._slotMeta[i].id === itemId) {
        this._triggerUntil.set(i, until);
        const slot = this._slotEls[i];
        if (slot) {
          slot.classList.add('triggered');
          if (floatText) this._showFloatText(slot, floatText);
        }
        any = true;
      }
    }
    return any;
  }

  setVisible(visible) { this.el.style.display = visible ? '' : 'none'; }

  // ---- internals ----

  _rebuild() {
    // Build the ordered list of currently-displayed item ids:
    //   bag trinkets first (in order), then equipped ball (if any) with a separator.
    const trinkets = this.run.items.slice();
    const ballId = this.run.ball;
    const displayed = trinkets.map((id) => ({ id, isEquipment: false }));
    if (ballId) displayed.push({ id: ballId, isEquipment: true });

    const key = displayed.map((d) => `${d.isEquipment ? 'E' : 'T'}:${d.id}`).join('|');
    if (key === this._renderedKey) return;
    this._renderedKey = key;

    this.el.innerHTML = '';
    this._slotEls = [];
    this._slotMeta = [];
    this._triggerUntil.clear();
    if (this._popoverItemId) this._hidePopover();

    for (let i = 0; i < displayed.length; i++) {
      const { id, isEquipment } = displayed[i];
      const item = itemById(id);
      if (!item) continue;

      // Visual divider between trinkets and equipment.
      if (isEquipment && i > 0 && !displayed[i - 1].isEquipment) {
        const sep = document.createElement('div');
        sep.className = 'item-bar-sep';
        this.el.appendChild(sep);
      }

      const slot = document.createElement('div');
      slot.className = 'item-pill';
      if (isEquipment) slot.classList.add('equipment');
      slot.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
      slot.title = `${item.name} — ${item.desc}`;
      slot.innerHTML = `
        <i class="pill-icon ${item.icon || 'fa-solid fa-circle'}"></i>
        <span class="pill-float-text"></span>
      `;
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._togglePopover(id, slot);
      });
      this.el.appendChild(slot);
      this._slotEls.push(slot);
      this._slotMeta.push({ id, isEquipment });
    }
  }

  _showFloatText(slotEl, text) {
    const floatEl = slotEl.querySelector('.pill-float-text');
    if (!floatEl) return;
    floatEl.textContent = text;
    floatEl.classList.remove('shown');
    // Force reflow so the animation restarts from scratch.
    void floatEl.offsetWidth;
    floatEl.classList.add('shown');
    if (floatEl._clearT) clearTimeout(floatEl._clearT);
    floatEl._clearT = setTimeout(() => {
      floatEl.classList.remove('shown');
      floatEl.textContent = '';
    }, FLOAT_TEXT_MS);
  }

  _togglePopover(itemId, slotEl) {
    if (this._popoverItemId === itemId) {
      this._hidePopover();
      return;
    }
    const item = itemById(itemId);
    if (!item) return;
    const color = RARITY_COLORS[item.rarity] || '#fff';
    this.popoverEl.style.setProperty('--rarity-color', color);
    this.popoverEl.innerHTML = `
      <div class="ibp-head">
        <i class="ibp-icon ${item.icon || 'fa-solid fa-circle'}"></i>
        <div class="ibp-titles">
          <div class="ibp-rarity">${item.rarity || 'item'}${item.slot && item.slot !== 'trinket' ? ` · ${item.slot}` : ''}</div>
          <div class="ibp-name">${item.name}</div>
        </div>
      </div>
      <div class="ibp-desc">${item.desc}</div>
    `;
    this._popoverItemId = itemId;

    // Position to the LEFT of the pill (the bar is right-anchored).
    const rect = slotEl.getBoundingClientRect();
    this.popoverEl.classList.add('shown');
    // Wait one frame so we can measure the popover's actual size.
    requestAnimationFrame(() => {
      const pw = this.popoverEl.offsetWidth;
      const ph = this.popoverEl.offsetHeight;
      let left = rect.left - pw - 10;
      if (left < 8) left = 8;
      let top = rect.top + rect.height / 2 - ph / 2;
      const maxTop = window.innerHeight - ph - 8;
      if (top < 8) top = 8;
      if (top > maxTop) top = maxTop;
      this.popoverEl.style.left = `${left}px`;
      this.popoverEl.style.top = `${top}px`;
    });
  }

  _hidePopover() {
    this._popoverItemId = null;
    this.popoverEl.classList.remove('shown');
  }
}
