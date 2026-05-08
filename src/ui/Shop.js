// Shop — Phase 4b/4c
//
// Pro Shop modal that opens after the cash-out screen. Two tabs:
//
//   Items — three random items rolled per visit (Balatro-style). Items take
//           a bag slot each. Reroll for $REROLL_COST. Tap a held slot to
//           expand its description; sell button on each.
//
//   Clubs — list of clubs the player doesn't own yet. Buy to unlock; the
//           ClubSelector picks them up automatically. Special clubs come
//           with use limits and are flagged as such.

import { ITEMS, itemById } from '../content/items.js';
import { REROLL_COST } from '../core/Run.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

export class Shop {
  constructor({ run, bag, onContinue }) {
    this.run = run;
    this.bag = bag;
    this.onContinue = onContinue || null;

    this.modal = document.getElementById('shop');
    this.cashEl = this.modal.querySelector('.shop-cash');
    this.continueBtn = this.modal.querySelector('.shop-continue');
    this.itemsTabEl = this.modal.querySelector('.items-tab');
    this.clubsTabEl = this.modal.querySelector('.clubs-tab');
    this.titleEl = this.modal.querySelector('.shop-title');

    // Tab buttons
    this.tabButtons = Array.from(this.modal.querySelectorAll('.shop-tab'));
    this.activeTab = 'items';
    for (const tab of this.tabButtons) {
      tab.addEventListener('click', () => {
        if (tab.disabled) return;
        this._setTab(tab.dataset.tab);
      });
    }

    this.offers = [];
    this.purchasedThisVisit = new Set();
    this.expandedSlot = -1;

    this.continueBtn.addEventListener('click', () => {
      this.hide();
      if (this.onContinue) this.onContinue();
    });

    // Refresh whenever the run or bag changes.
    run.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
    if (bag) bag.onChange(() => {
      if (this.modal.classList.contains('shown')) this._refresh();
    });
  }

  show({ holeName, holeNumber } = {}) {
    if (this.titleEl) {
      const sub = holeName ? ` · After ${holeName}` : '';
      this.titleEl.textContent = `Pro Shop${sub}`;
    }
    this.offers = this._rollOffers(3);
    this.purchasedThisVisit = new Set();
    this.expandedSlot = -1;
    this._setTab('items');
    this._buildItemsTab();
    this._buildClubsTab();
    this._refresh();
    this.modal.classList.add('shown');
  }

  hide() {
    this.modal.classList.remove('shown');
  }

  // ----- tabs -----

  _setTab(name) {
    this.activeTab = name;
    for (const btn of this.tabButtons) {
      btn.classList.toggle('active', btn.dataset.tab === name);
    }
    if (this.itemsTabEl) this.itemsTabEl.style.display = name === 'items' ? '' : 'none';
    if (this.clubsTabEl) this.clubsTabEl.style.display = name === 'clubs' ? '' : 'none';
  }

  // ----- internals: items tab -----

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

  /** (Re)build the offer cards section in place. */
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

    this.purchasedThisVisit.add(id);
    this.run.cash -= cost;
    if (!this.run.addItem(id)) {
      this.purchasedThisVisit.delete(id);
      this.run.cash += cost;
      return;
    }
    const card = this.itemsTabEl.querySelector(`.item-card[data-item-id="${id}"]`);
    if (card) {
      card.classList.add('just-bought');
      setTimeout(() => card.classList.remove('just-bought'), 350);
    }
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

  // ----- internals: clubs tab -----

  _buildClubsTab() {
    if (!this.clubsTabEl || !this.bag) return;
    // Description text + container that we'll re-render in _refresh
    this.clubsTabEl.innerHTML = `
      <div class="items-section">
        <div class="items-section-title">
          <span>Your clubs</span>
        </div>
        <div class="owned-clubs"></div>
      </div>
      <div class="items-section">
        <div class="items-section-title">
          <span>For sale</span>
        </div>
        <div class="club-offers"></div>
      </div>
    `;
  }

  _tryBuyClub(clubId) {
    if (!this.bag) return;
    const club = this.bag.shopClubs().find((c) => c.id === clubId);
    if (!club) return;
    const cost = this.run.effectiveCost(club.cost);
    if (this.run.cash < cost) return;
    this.run.cash -= cost;
    if (!this.bag.unlock(clubId)) {
      this.run.cash += cost;
      return;
    }
    // Force a refresh — bag.onChange will trigger this too, but doing it here
    // makes the cash counter and the disappearance of the offer card paint
    // in the same frame.
    this._refresh();
  }

  // ----- shared refresh -----

  _refresh() {
    this.cashEl.textContent = `$${this.run.cash}`;
    this._refreshItemsTab();
    this._refreshClubsTab();
  }

  _refreshItemsTab() {
    if (!this.itemsTabEl) return;
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

        const idx = i;
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

    const rerollBtn = this.itemsTabEl.querySelector('.reroll-btn');
    if (rerollBtn) {
      const canAffordReroll = this.run.cash >= REROLL_COST;
      rerollBtn.disabled = !canAffordReroll;
      rerollBtn.classList.toggle('cant-afford', !canAffordReroll);
    }

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

  _refreshClubsTab() {
    if (!this.clubsTabEl || !this.bag) return;

    // Owned clubs list (small pills)
    const ownedEl = this.clubsTabEl.querySelector('.owned-clubs');
    if (ownedEl) {
      ownedEl.innerHTML = '';
      for (const club of this.bag.ownedClubs()) {
        const pill = document.createElement('div');
        pill.className = 'owned-club-pill';
        pill.style.setProperty('--club-color', club.color);
        let badge = '';
        const ph = this.bag.usesLeftThisHole(club.id);
        const tl = this.bag.usesLeftTotal(club.id);
        if (ph !== Infinity)      badge = ` · ${ph}/${club.usesPerHole}`;
        else if (tl !== Infinity) badge = ` · ${tl} left`;
        pill.innerHTML = `<span class="oc-name">${club.name}${badge}</span>`;
        ownedEl.appendChild(pill);
      }
    }

    // Club offers — every NOT-yet-owned club, in canonical order
    const offersEl = this.clubsTabEl.querySelector('.club-offers');
    if (offersEl) {
      offersEl.innerHTML = '';
      const shopClubs = this.bag.shopClubs();
      if (!shopClubs.length) {
        const none = document.createElement('div');
        none.className = 'held-empty';
        none.textContent = 'You own every club. Nice.';
        offersEl.appendChild(none);
      }
      for (const club of shopClubs) {
        const cost = this.run.effectiveCost(club.cost);
        const canAfford = this.run.cash >= cost;
        const card = document.createElement('div');
        card.className = 'club-card';
        card.style.setProperty('--rarity-color', club.color);
        if (club.special) card.classList.add('special');

        // Limit badge text
        let limit = '';
        if (club.usesPerHole !== undefined) limit = `${club.usesPerHole}/hole`;
        else if (club.usesTotal !== undefined) limit = `${club.usesTotal} uses then breaks`;

        card.innerHTML = `
          <div class="club-card-head">
            <span class="club-card-short" style="background: ${club.color}">${club.short}</span>
            <div class="club-card-titles">
              <div class="club-card-name">${club.name}${club.special ? ' <span class="club-card-tag">SPECIAL</span>' : ''}</div>
              <div class="club-card-desc">${club.desc || ''}</div>
              ${limit ? `<div class="club-card-limit">${limit}</div>` : ''}
            </div>
            <button class="club-buy" type="button">$${cost}</button>
          </div>
        `;
        const btn = card.querySelector('.club-buy');
        btn.disabled = !canAfford;
        btn.classList.toggle('cant-afford', !canAfford);
        btn.addEventListener('click', () => this._tryBuyClub(club.id));
        offersEl.appendChild(card);
      }
    }
  }
}
