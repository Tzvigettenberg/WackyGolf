// Shop — Phase 4d unified
//
// Single scrolling pane: Bag (items) + Clubs (with sell) + For Sale (mixed
// pool of items + unowned clubs). One reroll button covers everything.
//
// Each shop offer is either an item or a club; the pool is mixed so a new
// club popping up feels like a real "ooh!" moment rather than a separate
// always-present catalog.

import { ITEMS, itemById, isEquipment } from '../content/items.js';
import { clubSellValue } from '../gameplay/Club.js';
import { REROLL_COST } from '../core/Run.js';
import { sfx } from '../audio/Sfx.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

// Number of offers shown per shop visit, mixed item/club.
const OFFERS_PER_VISIT = 3;

export class Shop {
  constructor({ run, bag, onContinue }) {
    this.run = run;
    this.bag = bag;
    this.onContinue = onContinue || null;

    this.modal = document.getElementById('shop');
    this.cashEl = this.modal.querySelector('.shop-cash');
    this.continueBtn = this.modal.querySelector('.shop-continue');
    this.bodyEl = this.modal.querySelector('.shop-body-inner');
    this.titleEl = this.modal.querySelector('.shop-title');

    // Universal slot-detail modal — populated when the player taps a
    // bag or ball pill. Shared element since only one is open at a time.
    this.slotModal       = document.getElementById('slot-modal');
    this.slotModalIcon   = this.slotModal.querySelector('.slot-modal-icon');
    this.slotModalRarity = this.slotModal.querySelector('.slot-modal-rarity');
    this.slotModalName   = this.slotModal.querySelector('.slot-modal-name');
    this.slotModalDesc   = this.slotModal.querySelector('.slot-modal-desc');
    this.slotModalSell   = this.slotModal.querySelector('.slot-modal-sell');
    this.slotModal.querySelector('.slot-modal-close')
      .addEventListener('click', () => this._closeSlotModal());
    this.slotModal.addEventListener('click', (e) => {
      if (e.target === this.slotModal) this._closeSlotModal();
    });
    this._slotSellHandler = null;

    // offers: array of { type: 'item' | 'club', id }
    this.offers = [];
    // ids (per type prefix, e.g. 'item:heavy-driver') already bought THIS visit.
    this.purchasedThisVisit = new Set();
    // Bag/ball details now live in the slot-modal (centered popup), so
    // there's no inline expand state anymore. Clubs and offers still expand
    // inline below their pills (compact-fit reasons).
    this.expandedClubIdx = -1;    // owned club slot index
    this.expandedOfferKey = null; // string — 'item:id' or 'club:id'

    this.continueBtn.addEventListener('click', () => {
      sfx.uiClick();
      this.hide();
      if (this.onContinue) this.onContinue();
    });

    run.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
    if (bag) bag.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
  }

  show({ holeName } = {}) {
    if (this.titleEl) {
      const sub = holeName ? ` · After ${holeName}` : '';
      this.titleEl.textContent = `Pro Shop${sub}`;
    }
    this.offers = this._rollOffers(OFFERS_PER_VISIT);
    this.purchasedThisVisit = new Set();
    this.expandedClubIdx = -1;
    this.expandedOfferKey = null;
    this._closeSlotModal();
    this._buildBody();
    this._refresh();
    this.modal.classList.add('shown');
    document.body.classList.add('shop-active');
  }

  hide() {
    this.modal.classList.remove('shown');
    this._closeSlotModal();
    document.body.classList.remove('shop-active');
  }

  // ----- offer pool -----

  _buildPool() {
    const pool = [];
    for (const item of ITEMS) pool.push({ type: 'item', id: item.id });
    if (this.bag) {
      for (const club of this.bag.shopClubs()) pool.push({ type: 'club', id: club.id });
    }
    return pool;
  }

  _rollOffers(count) {
    const pool = this._buildPool();
    // Fisher–Yates partial shuffle
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  // ----- DOM scaffolding -----

  _buildBody() {
    this.bodyEl.innerHTML = `
      <div class="items-section">
        <div class="items-section-title">
          <span>Items</span>
          <span class="bag-count"></span>
        </div>
        <div class="bag-slots"></div>
      </div>
      <div class="items-section">
        <div class="items-section-title">
          <span>Ball</span>
          <span class="equip-status"></span>
        </div>
        <div class="ball-slots"></div>
      </div>
      <div class="items-section">
        <div class="items-section-title">
          <span>Clubs</span>
          <span class="clubs-count"></span>
        </div>
        <div class="owned-clubs"></div>
      </div>
      <div class="items-section">
        <div class="items-section-title">
          <span>For sale</span>
          <button class="reroll-btn" type="button">Reroll $${REROLL_COST}</button>
        </div>
        <div class="shop-offers"></div>
      </div>
    `;
    this.bodyEl.querySelector('.reroll-btn').addEventListener('click', () => this._tryReroll());
    this._buildOfferCards();
  }

  _buildOfferCards() {
    const offersEl = this.bodyEl.querySelector('.shop-offers');
    offersEl.innerHTML = '';
    for (const offer of this.offers) {
      const card = offer.type === 'item'
        ? this._buildItemCard(offer.id)
        : this._buildClubCard(offer.id);
      if (card) offersEl.appendChild(card);
    }
  }

  _buildItemCard(id) {
    const item = itemById(id);
    if (!item) return null;
    const key = `item:${id}`;
    const expanded = this.expandedOfferKey === key;
    const card = document.createElement('div');
    card.className = 'shop-offer' + (expanded ? ' expanded' : '');
    card.dataset.itemId = id;
    card.dataset.offerType = 'item';
    card.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
    // Default: compact row with icon + name + price button. Tap row →
    // reveal rarity tag + description.
    card.innerHTML = `
      <div class="shop-offer-head">
        <div class="shop-offer-icon"><i class="${item.icon || 'fa-solid fa-circle'}"></i></div>
        <div class="shop-offer-name">${item.name}</div>
        <button class="shop-offer-buy" type="button">$0</button>
      </div>
      ${expanded ? `
        <div class="shop-offer-detail">
          <div class="shop-offer-rarity">${item.rarity}</div>
          <div class="shop-offer-desc">${item.desc}</div>
        </div>
      ` : ''}
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.shop-offer-buy')) return;
      this._toggleOffer(key);
    });
    card.querySelector('.shop-offer-buy').addEventListener('click', (e) => {
      e.stopPropagation();
      this._tryBuyItem(id);
    });
    return card;
  }

  _buildClubCard(id) {
    const club = this.bag.shopClubs().find((c) => c.id === id);
    if (!club) return null;
    const key = `club:${id}`;
    const expanded = this.expandedOfferKey === key;
    const card = document.createElement('div');
    card.className = 'shop-offer club-offer' + (expanded ? ' expanded' : '');
    card.dataset.clubId = id;
    card.dataset.offerType = 'club';
    card.style.setProperty('--rarity-color', club.color);

    let limit = '';
    if (club.usesPerHole !== undefined) limit = `${club.usesPerHole}/hole`;
    else if (club.usesTotal !== undefined) limit = `${club.usesTotal} uses then breaks`;

    card.innerHTML = `
      <div class="shop-offer-head">
        <div class="shop-offer-icon"><i class="${club.icon || 'fa-solid fa-club'}"></i></div>
        <div class="shop-offer-name">${club.name}</div>
        <button class="shop-offer-buy" type="button">$0</button>
      </div>
      ${expanded ? `
        <div class="shop-offer-detail">
          <div class="shop-offer-rarity">${club.rarity || 'club'}</div>
          <div class="shop-offer-desc">${club.desc || ''}</div>
          ${limit ? `<div class="shop-offer-limit">${limit}</div>` : ''}
        </div>
      ` : ''}
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.shop-offer-buy')) return;
      this._toggleOffer(key);
    });
    card.querySelector('.shop-offer-buy').addEventListener('click', (e) => {
      e.stopPropagation();
      this._tryBuyClub(id);
    });
    return card;
  }

  _toggleOffer(key) {
    this.expandedOfferKey = this.expandedOfferKey === key ? null : key;
    this._buildOfferCards();
    this._refresh();
  }

  // ----- buy / sell -----

  _tryBuyItem(id) {
    const item = itemById(id);
    if (!item) return;

    // Equipment items (currently just balls) route to a slot instead of the bag.
    if (isEquipment(item)) {
      this._tryBuyEquipment(id, item);
      return;
    }

    const key = `item:${id}`;
    if (this.purchasedThisVisit.has(key)) return;
    if (!this.run.hasFreeSlot) return;
    const cost = this.run.effectiveCost(item.cost);
    if (this.run.cash < cost) return;

    this.purchasedThisVisit.add(key);
    this.run.cash -= cost;
    if (!this.run.addItem(id)) {
      this.purchasedThisVisit.delete(key);
      this.run.cash += cost;
      return;
    }
    sfx.uiBuy();
    this._punchCard(`.shop-offer[data-item-id="${id}"]`);
    this._refresh();
  }

  /** Buy an equipment item (e.g. a ball). Refuses if a ball is already
   *  equipped — the player must explicitly sell the old one first so
   *  there's no surprise auto-refund. */
  _tryBuyEquipment(id, item) {
    if (item.slot !== 'ball') return; // future: hat/shirt/etc
    if (this.run.ball === id) return;  // already equipped, no-op
    if (this.run.ball) return;         // slot occupied — sell first
    const cost = this.run.effectiveCost(item.cost);
    if (this.run.cash < cost) return;

    this.run.cash -= cost;
    this.run.equipBall(id);
    sfx.uiBuy();
    this._punchCard(`.shop-offer[data-item-id="${id}"]`);
    this._refresh();
  }

  _tryBuyClub(id) {
    const key = `club:${id}`;
    if (this.purchasedThisVisit.has(key)) return;
    if (!this.bag.hasFreeClubSlot) return;
    const club = this.bag.shopClubs().find((c) => c.id === id);
    if (!club) return;
    const cost = this.run.effectiveCost(club.cost);
    if (this.run.cash < cost) return;

    this.purchasedThisVisit.add(key);
    this.run.cash -= cost;
    if (!this.bag.unlock(id)) {
      this.purchasedThisVisit.delete(key);
      this.run.cash += cost;
      return;
    }
    sfx.uiBuy();
    this._punchCard(`.shop-offer[data-club-id="${id}"]`);
    this._refresh();
  }

  _punchCard(selector) {
    const card = this.bodyEl.querySelector(selector);
    if (card) {
      card.classList.add('just-bought');
      setTimeout(() => card.classList.remove('just-bought'), 350);
    }
  }

  _trySellItem(slotIndex) {
    const id = this.run.items[slotIndex];
    if (!id) return;
    const item = itemById(id);
    if (!item) return;
    const value = this.run.sellValue(item.cost);
    if (!this.run.removeAt(slotIndex)) return;
    this.run.cash += value;
    sfx.uiSell();
    this._refresh();
  }

  _trySellClub(index) {
    const sold = this.bag.sellClubAtIndex(index);
    if (!sold) return;
    this.run.cash += clubSellValue(sold);
    sfx.uiSell();
    this.run._emit();
    this._refresh();
  }

  _trySellBall() {
    const id = this.run.ball;
    if (!id) return;
    const item = itemById(id);
    if (!item) return;
    this.run.unequipBall();
    this.run.cash += this.run.sellValue(item.cost);
    sfx.uiSell();
    this.run._emit();
    this._refresh();
  }

  _tryReroll() {
    if (this.run.cash < REROLL_COST) return;
    this.run.cash -= REROLL_COST;
    sfx.uiReroll();
    this.offers = this._rollOffers(OFFERS_PER_VISIT);
    this.purchasedThisVisit = new Set();
    this._buildOfferCards();
    this._refresh();
  }

  /**
   * Open the universal slot-detail modal for an item. The host passes a
   * sell handler that knows whether this is a bag slot or the ball slot;
   * the modal just calls it on click and closes itself.
   */
  _openSlotModal(item, onSell) {
    if (!item || !this.slotModal) return;
    const color = RARITY_COLORS[item.rarity] || '#fff';
    this.slotModal.style.setProperty('--rarity-color', color);
    this.slotModalIcon.className = `slot-modal-icon ${item.icon || 'fa-solid fa-circle'}`;
    this.slotModalRarity.textContent = item.rarity || '';
    this.slotModalName.textContent = item.name;
    this.slotModalDesc.textContent = item.desc || '';
    const sellValue = this.run.sellValue(item.cost);
    this.slotModalSell.textContent = `Sell $${sellValue}`;
    // Replace the previous handler so we don't accumulate listeners.
    if (this._slotSellHandler) {
      this.slotModalSell.removeEventListener('click', this._slotSellHandler);
    }
    this._slotSellHandler = () => {
      if (onSell) onSell();
      this._closeSlotModal();
    };
    this.slotModalSell.addEventListener('click', this._slotSellHandler);
    this.slotModal.classList.add('shown');
  }

  _closeSlotModal() {
    if (!this.slotModal) return;
    this.slotModal.classList.remove('shown');
    if (this._slotSellHandler) {
      this.slotModalSell.removeEventListener('click', this._slotSellHandler);
      this._slotSellHandler = null;
    }
  }

  // ----- refresh -----

  _refresh() {
    this.cashEl.textContent = `$${this.run.cash}`;
    this._refreshBag();
    this._refreshBall();
    this._refreshClubs();
    this._refreshOffers();
  }

  _refreshBall() {
    const slotsEl = this.bodyEl.querySelector('.ball-slots');
    const status = this.bodyEl.querySelector('.equip-status');
    if (!slotsEl) return;
    slotsEl.innerHTML = '';

    const id = this.run.ball;
    const slot = document.createElement('div');
    slot.className = 'bag-slot';
    if (!id) {
      slot.classList.add('empty');
      slot.innerHTML = '<span class="bag-slot-plus">+</span>';
      slotsEl.appendChild(slot);
      if (status) status.textContent = 'empty';
      return;
    }
    const item = itemById(id);
    if (!item) return;
    if (status) status.textContent = 'equipped';
    slot.classList.add('filled');
    slot.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
    slot.innerHTML = `
      <i class="bag-slot-icon ${item.icon || 'fa-solid fa-circle'}"></i>
      <span class="bag-slot-name">${item.name}</span>
    `;
    slot.addEventListener('click', () => this._openSlotModal(item, () => this._trySellBall()));
    slotsEl.appendChild(slot);
  }

  _refreshBag() {
    const countEl = this.bodyEl.querySelector('.bag-count');
    if (countEl) countEl.textContent = `${this.run.items.length} / ${this.run.bagSlots}`;

    const slotsEl = this.bodyEl.querySelector('.bag-slots');
    if (!slotsEl) return;
    slotsEl.innerHTML = '';

    for (let i = 0; i < this.run.bagSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'bag-slot';
      const id = this.run.items[i];
      if (!id) {
        slot.classList.add('empty');
        slot.innerHTML = '<span class="bag-slot-plus">+</span>';
        slotsEl.appendChild(slot);
        continue;
      }
      const item = itemById(id);
      if (!item) continue;
      slot.classList.add('filled');
      slot.style.setProperty('--rarity-color', RARITY_COLORS[item.rarity] || '#fff');
      slot.innerHTML = `
        <i class="bag-slot-icon ${item.icon || 'fa-solid fa-circle'}"></i>
        <span class="bag-slot-name">${item.name}</span>
      `;
      const idx = i;
      slot.addEventListener('click', () => this._openSlotModal(item, () => this._trySellItem(idx)));
      slotsEl.appendChild(slot);
    }
  }

  _refreshClubs() {
    if (!this.bag) return;
    const countEl = this.bodyEl.querySelector('.clubs-count');
    const slots = this.bag.ownedSlots();
    if (countEl) countEl.textContent = `${slots.length} / ${slots.length + this.bag.clubSlotsLeft}`;

    const list = this.bodyEl.querySelector('.owned-clubs');
    if (!list) return;
    list.innerHTML = '';
    for (const slot of slots) {
      const { index, club, usesLeftThisHole, usesLeftTotal } = slot;
      const sellValue = clubSellValue(club);
      const canSell = slots.length > 1;          // never sell your last club
      const expanded = this.expandedClubIdx === index;
      let badge = '';
      if (usesLeftThisHole !== Infinity) {
        badge = `<span class="shop-pill-tag">${usesLeftThisHole}/${club.usesPerHole}</span>`;
      } else if (usesLeftTotal !== Infinity) {
        badge = `<span class="shop-pill-tag">${usesLeftTotal} left</span>`;
      }

      const pill = document.createElement('div');
      pill.className = 'shop-pill club-pill' + (expanded ? ' expanded' : '');
      pill.style.setProperty('--rarity-color', club.color);
      pill.innerHTML = `
        <div class="shop-pill-head">
          <i class="shop-pill-icon ${club.icon || 'fa-solid fa-club'}"></i>
          <span class="shop-pill-name">${club.name}</span>
          ${badge}
        </div>
        ${expanded ? `
          <div class="shop-pill-desc">${club.desc || ''}</div>
          <button class="shop-pill-sell" type="button" ${canSell ? '' : 'disabled'}>${canSell ? `Sell $${sellValue}` : 'Last club — can\'t sell'}</button>
        ` : ''}
      `;
      pill.addEventListener('click', (e) => {
        if (e.target.closest('.shop-pill-sell')) return;
        this.expandedClubIdx = this.expandedClubIdx === index ? -1 : index;
        this._refresh();
      });
      const sellBtn = pill.querySelector('.shop-pill-sell');
      if (sellBtn) sellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sellBtn.disabled) return;
        this._trySellClub(index);
      });
      list.appendChild(pill);
    }
  }

  _refreshOffers() {
    const cards = this.bodyEl.querySelectorAll('.shop-offer');
    const itemBagFull = !this.run.hasFreeSlot;
    const clubBagFull = !this.bag || !this.bag.hasFreeClubSlot;

    for (const card of cards) {
      const type = card.dataset.offerType;
      const id = card.dataset.itemId || card.dataset.clubId;
      let cost, key, full, sold;
      if (type === 'item') {
        const item = itemById(id);
        if (!item) continue;
        cost = this.run.effectiveCost(item.cost);
        if (isEquipment(item)) {
          // Ball is equipped already (this exact one) → OWNED.
          // Ball slot is occupied by a DIFFERENT ball → "SLOT FULL"
          // (player must sell the old one first; no auto-refund).
          full = !!this.run.ball && this.run.ball !== id;
          sold = this.run.ball === id;
          key = `equip:${id}`;
        } else {
          key = `item:${id}`;
          full = itemBagFull;
          sold = this.purchasedThisVisit.has(key);
        }
      } else {
        // Clubs allow duplicates in the bag, so "already owned" is no longer
        // a buy-blocker. Only block on bag-full and per-visit-already-bought.
        const club = this.bag.shopClubs().find((c) => c.id === id);
        if (!club) continue;
        cost = this.run.effectiveCost(club.cost);
        key = `club:${id}`;
        full = clubBagFull;
        sold = this.purchasedThisVisit.has(key);
      }

      const btn = card.querySelector('.shop-offer-buy');
      const canAfford = this.run.cash >= cost;

      if (sold) {
        btn.textContent = 'OWNED';
        btn.disabled = true;
        btn.classList.add('sold');
        btn.classList.remove('cant-afford', 'bag-full');
        card.classList.add('sold');
      } else if (full) {
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

    const rerollBtn = this.bodyEl.querySelector('.reroll-btn');
    if (rerollBtn) {
      const canAffordReroll = this.run.cash >= REROLL_COST;
      rerollBtn.disabled = !canAffordReroll;
      rerollBtn.classList.toggle('cant-afford', !canAffordReroll);
    }
  }
}
