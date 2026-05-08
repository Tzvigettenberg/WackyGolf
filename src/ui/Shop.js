// Shop — Phase 4b
//
// Pro Shop modal that opens after the cash-out screen. The Items tab is the
// heart of the meta — three random items rolled per visit (Balatro-style),
// each can be bought once if you can afford it AND have a free bag slot.
// A flat-cost reroll button replaces the offers with a fresh roll.
//
// Bag is a row of N slots (default 5). Each filled slot is a separate item
// instance (duplicates are independent — sell each one back individually).
// Tapping a filled slot expands it to show the item's full description.

import { ITEMS, itemById } from '../content/items.js';
import { REROLL_COST } from '../core/Run.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

export class Shop {
  constructor({ run, onContinue }) {
    this.run = run;
    this.onContinue = onContinue || null;

    this.modal = document.getElementById('shop');
    this.cashEl = this.modal.querySelector('.shop-cash');
    this.continueBtn = this.modal.querySelector('.shop-continue');
    this.itemsTabEl = this.modal.querySelector('.items-tab');
    this.titleEl = this.modal.querySelector('.shop-title');

    // The 3 item ids currently being offered + a per-visit set of ids that have
    // already been bought (prevents buying the same offer twice in one visit).
    this.offers = [];
    this.purchasedThisVisit = new Set();
    // Slot index whose description is currently expanded. -1 = none.
    this.expandedSlot = -1;
    // Set of offer item ids whose description popup is open. (Offers already
    // show their desc inline so this is currently unused — kept for parity.)

    this.continueBtn.addEventListener('click', () => {
      this.hide();
      if (this.onContinue) this.onContinue();
    });

    // Refresh whenever the run changes (cash, item added/removed, slots).
    run.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
  }

  show({ holeName, holeNumber } = {}) {
    if (this.titleEl) {
      const sub = holeName ? ` · After ${holeName}` : '';
      this.titleEl.textContent = `Pro Shop${sub}`;
    }
    // Roll a fresh set of offers each visit.
    this.offers = this._rollOffers(3);
    this.purchasedThisVisit = new Set();
    this.expandedSlot = -1;
    this._buildItemsTab();
    this._refresh();
    this.modal.classList.add('shown');
  }

  hide() {
    this.modal.classList.remove('shown');
  }

  // ----- internals -----

  /** Pick `count` distinct item ids from the pool. */
  _rollOffers(count) {
    const pool = ITEMS.slice();
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).map((it) => it.id);
  }

  _buildItemsTab() {
    this.itemsTabEl.innerHTML = `
      <div class="items-section">
        <div class="items-section-title">
          <span>Bag</span>
          <span class="bag-count"></span>
        </div>
        <div class="bag-slots"></div>
      </div>
      <div class="items-section">
        <div class="items-section-title">
          <span>For sale</span>
          <button class="reroll-btn" type="button">Reroll $${REROLL_COST}</button>
        </div>
        <div class="shop-offers"></div>
      </div>
    `;

    const rerollBtn = this.itemsTabEl.querySelector('.reroll-btn');
    rerollBtn.addEventListener('click', () => this._tryReroll());

    this._buildOfferCards();
  }

  /** (Re)build the offer cards section in place — called on first build and on reroll. */
  _buildOfferCards() {
    const offersEl = this.itemsTabEl.querySelector('.shop-offers');
    offersEl.innerHTML = '';
    for (const id of this.offers) {
      const item = itemById(id);
      if (!item) continue;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.itemId = id;
      card.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
      card.innerHTML = `
        <div class="item-rarity">${item.rarity}</div>
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.desc}</div>
        <button class="item-buy" type="button">$0</button>
      `;
      const btn = card.querySelector('.item-buy');
      btn.addEventListener('click', () => this._tryBuy(id));
      offersEl.appendChild(card);
    }
  }

  _tryBuy(id) {
    if (this.purchasedThisVisit.has(id)) return;
    if (!this.run.hasFreeSlot) return;
    const item = itemById(id);
    if (!item) return;
    const cost = this.run.effectiveCost(item.cost);
    if (this.run.cash < cost) return;

    // Mark purchased BEFORE the run mutation so the resulting refresh sees
    // the new state and the card immediately reads "OWNED".
    this.purchasedThisVisit.add(id);
    this.run.cash -= cost;
    if (!this.run.addItem(id)) {
      // Shouldn't happen — hasFreeSlot guard above. Roll back if it does.
      this.purchasedThisVisit.delete(id);
      this.run.cash += cost;
      return;
    }
    // brief visual punch on the card
    const card = this.itemsTabEl.querySelector(`.item-card[data-item-id="${id}"]`);
    if (card) {
      card.classList.add('just-bought');
      setTimeout(() => card.classList.remove('just-bought'), 350);
    }
    // Force a refresh so the cash-display + card states update immediately
    // (cash mutation alone doesn't emit; addItem does, but we want a single
    // consistent paint after both writes).
    this._refresh();
  }

  _trySell(slotIndex) {
    const id = this.run.items[slotIndex];
    if (!id) return;
    const item = itemById(id);
    if (!item) return;
    const value = this.run.sellValue(item.cost);
    const removed = this.run.removeAt(slotIndex);
    if (removed) this.run.cash += value;
    // Fix expanded-slot pointer if we sold the expanded one or a slot before it.
    if (this.expandedSlot === slotIndex) this.expandedSlot = -1;
    else if (this.expandedSlot > slotIndex) this.expandedSlot -= 1;
    this._refresh();
  }

  _tryReroll() {
    if (this.run.cash < REROLL_COST) return;
    this.run.cash -= REROLL_COST;
    this.offers = this._rollOffers(3);
    this.purchasedThisVisit = new Set();
    this._buildOfferCards();
    this._refresh();
  }

  _toggleExpand(slotIndex) {
    this.expandedSlot = this.expandedSlot === slotIndex ? -1 : slotIndex;
    this._refresh();
  }

  _refresh() {
    this.cashEl.textContent = `$${this.run.cash}`;

    // Bag slot count + grid
    const countEl = this.itemsTabEl.querySelector('.bag-count');
    if (countEl) {
      countEl.textContent = `${this.run.items.length} / ${this.run.bagSlots}`;
    }

    const slotsEl = this.itemsTabEl.querySelector('.bag-slots');
    if (slotsEl) {
      slotsEl.innerHTML = '';
      for (let i = 0; i < this.run.bagSlots; i++) {
        const slot = document.createElement('div');
        slot.className = 'bag-slot';
        const id = this.run.items[i];
        if (!id) {
          slot.classList.add('empty');
          slot.innerHTML = '<span class="slot-empty-dot">+</span>';
          slotsEl.appendChild(slot);
          continue;
        }
        const item = itemById(id);
        if (!item) continue;
        const sellValue = this.run.sellValue(item.cost);
        const expanded = this.expandedSlot === i;
        slot.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
        if (expanded) slot.classList.add('expanded');
        slot.innerHTML = `
          <div class="slot-head">
            <div class="slot-name">${item.name}</div>
            <button class="slot-info" type="button" aria-label="Show description">i</button>
          </div>
          ${expanded ? `<div class="slot-desc">${item.desc}</div>` : ''}
          <button class="slot-sell" type="button">Sell $${sellValue}</button>
        `;

        const idx = i; // capture
        // Tap the head to toggle desc, sell button has its own handler.
        slot.querySelector('.slot-head').addEventListener('click', (e) => {
          if (e.target.closest('.slot-sell')) return;
          this._toggleExpand(idx);
        });
        slot.querySelector('.slot-sell').addEventListener('click', (e) => {
          e.stopPropagation();
          this._trySell(idx);
        });
        slotsEl.appendChild(slot);
      }
    }

    // Reroll button state
    const rerollBtn = this.itemsTabEl.querySelector('.reroll-btn');
    if (rerollBtn) {
      const canAffordReroll = this.run.cash >= REROLL_COST;
      rerollBtn.disabled = !canAffordReroll;
      rerollBtn.classList.toggle('cant-afford', !canAffordReroll);
    }

    // Offer cards: update buy button states. Disable buy when bag is full.
    const cards = this.itemsTabEl.querySelectorAll('.item-card');
    const bagFull = !this.run.hasFreeSlot;
    for (const card of cards) {
      const id = card.dataset.itemId;
      const item = itemById(id);
      if (!item) continue;
      const cost = this.run.effectiveCost(item.cost);
      const btn = card.querySelector('.item-buy');
      const sold = this.purchasedThisVisit.has(id);
      const canAfford = this.run.cash >= cost;

      if (sold) {
        btn.textContent = 'OWNED';
        btn.disabled = true;
        btn.classList.add('sold');
        btn.classList.remove('cant-afford', 'bag-full');
        card.classList.add('sold');
      } else if (bagFull) {
        btn.textContent = 'BAG FULL';
        btn.disabled = true;
        btn.classList.add('bag-full');
        btn.classList.remove('sold', 'cant-afford');
        card.classList.remove('sold');
      } else {
        btn.textContent = `$${cost}`;
        btn.disabled = !canAfford;
        btn.classList.toggle('cant-afford', !canAfford);
        btn.classList.remove('sold', 'bag-full');
        card.classList.remove('sold');
      }
    }
  }
}
