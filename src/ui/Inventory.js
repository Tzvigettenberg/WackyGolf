// Inventory — Phase 4t
//
// Quick-look modal for what the player currently has — items, equipped ball,
// and clubs. Opened from the round preview so you can decide play/skip with
// full context, but lightweight enough to add a "from anywhere" button later.
//
// Each row is icon + name + (one-line) effect description. No buy/sell here —
// this is a reference panel, not the shop.

import { itemById } from '../content/items.js';

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

export class Inventory {
  constructor({ run, bag }) {
    this.run = run;
    this.bag = bag;

    this.modal = document.createElement('div');
    this.modal.id = 'inventory-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.innerHTML = `
      <div class="inv-card">
        <header class="inv-header">
          <h2 class="inv-title">Inventory</h2>
          <button class="inv-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="inv-body"></div>
      </div>
    `;
    document.body.appendChild(this.modal);

    this.bodyEl = this.modal.querySelector('.inv-body');
    this.modal.querySelector('.inv-close').addEventListener('click', () => this.close());
    // Tap outside the card to dismiss.
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  open() {
    this._render();
    this.modal.classList.add('shown');
  }

  close() {
    this.modal.classList.remove('shown');
  }

  // ---- internals ----

  _render() {
    const sections = [];

    sections.push(this._sectionItems());
    sections.push(this._sectionBall());
    sections.push(this._sectionClubs());

    this.bodyEl.innerHTML = sections.join('');
  }

  _sectionItems() {
    const slots = this.run.bagSlots;
    const items = this.run.items;
    let rows = '';
    for (let i = 0; i < slots; i++) {
      const id = items[i];
      if (!id) {
        rows += `<div class="inv-row inv-empty"><span class="inv-empty-dot">+</span><span class="inv-empty-label">Empty</span></div>`;
        continue;
      }
      rows += this._rowForItem(id);
    }
    return `
      <div class="inv-section">
        <div class="inv-section-title">Items <span class="inv-count">${items.length} / ${slots}</span></div>
        ${rows}
      </div>
    `;
  }

  _sectionBall() {
    const id = this.run.ball;
    const inner = id ? this._rowForItem(id) :
      `<div class="inv-row inv-empty"><span class="inv-empty-dot">+</span><span class="inv-empty-label">No ball equipped</span></div>`;
    return `
      <div class="inv-section">
        <div class="inv-section-title">Ball</div>
        ${inner}
      </div>
    `;
  }

  _sectionClubs() {
    const slots = this.bag.ownedSlots();
    let rows = '';
    for (const s of slots) {
      const c = s.club;
      const color = c.color || '#fff';
      let limit = '';
      if (s.usesLeftThisHole !== Infinity) limit = ` <span class="inv-tag">${s.usesLeftThisHole}/${c.usesPerHole}</span>`;
      else if (s.usesLeftTotal !== Infinity) limit = ` <span class="inv-tag">${s.usesLeftTotal} left</span>`;
      rows += `
        <div class="inv-row" style="--card-color: ${color}">
          <i class="inv-icon ${c.icon || 'icon-club'}"></i>
          <div class="inv-row-body">
            <div class="inv-row-name">${escapeHtml(c.name)}${limit}</div>
            <div class="inv-row-desc">${escapeHtml(c.desc || '')}</div>
          </div>
        </div>
      `;
    }
    return `
      <div class="inv-section">
        <div class="inv-section-title">Clubs <span class="inv-count">${slots.length}</span></div>
        ${rows}
      </div>
    `;
  }

  _rowForItem(id) {
    const item = itemById(id);
    if (!item) return '';
    const color = RARITY_COLORS[item.rarity] || '#fff';
    return `
      <div class="inv-row" style="--card-color: ${color}">
        <i class="inv-icon ${item.icon || 'fa-solid fa-circle'}"></i>
        <div class="inv-row-body">
          <div class="inv-row-name">${escapeHtml(item.name)}</div>
          <div class="inv-row-desc">${escapeHtml(item.desc || '')}</div>
        </div>
      </div>
    `;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
