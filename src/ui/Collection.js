// Collection — Phase 3.6
//
// Modal showing all the hole templates in the game. Holes you've actually
// played show their top-down preview, name, and par. Holes you haven't yet
// played are locked — silhouette card with "???" and a "?" thumbnail.
//
// Discovered hole IDs persist across runs in localStorage so the collection
// fills in over time as you encounter new holes.

import { HOLES } from '../content/holes.js';
import { ITEMS } from '../content/items.js';
import { CLUBS } from '../gameplay/Club.js';

const STORAGE_KEY = 'wackygolf_discovered_holes_v1';
const PREVIEW_PX = 130;

const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

export class Collection {
  constructor({ onShowHoleDetail } = {}) {
    this.modal = document.getElementById('collection-modal');
    this.grid = document.getElementById('hole-grid');
    this.closeBtn = document.getElementById('collection-close');

    this.onShowHoleDetail = onShowHoleDetail || null;
    this.discovered = new Set(this._load());

    // tab elements
    this.tabButtons = Array.from(this.modal.querySelectorAll('.collection-tab'));
    this.tabContents = {
      holes: this.modal.querySelector('.holes-tab'),
      items: this.modal.querySelector('.items-tab'),
      clubs: this.modal.querySelector('.clubs-tab'),
    };
    this.itemsGrid = this.modal.querySelector('.items-grid');
    this.clubsGrid = this.modal.querySelector('.clubs-grid');
    for (const btn of this.tabButtons) {
      btn.addEventListener('click', () => this._setTab(btn.dataset.tab));
    }
    this.activeTab = 'holes';

    this.closeBtn.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this._renderGrid();
    this._renderItems();
    this._renderClubs();
  }

  _setTab(name) {
    this.activeTab = name;
    for (const btn of this.tabButtons) {
      btn.classList.toggle('active', btn.dataset.tab === name);
    }
    for (const [key, el] of Object.entries(this.tabContents)) {
      if (el) el.style.display = key === name ? '' : 'none';
    }
  }

  /** Mark a hole as discovered. Updates persistence + grid. */
  discoverHole(id) {
    if (!id || this.discovered.has(id)) return;
    this.discovered.add(id);
    this._save();
    this._renderGrid();
  }

  open() { this.modal.classList.add('shown'); }
  close() {
    this.modal.classList.remove('shown');
    if (this.detailEl) this.detailEl.classList.remove('shown');
  }

  // ---- internals ----

  _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.discovered])); }
    catch (_) {}
  }

  _renderGrid() {
    if (!this.grid) return;
    this.grid.innerHTML = '';
    for (const hole of HOLES) {
      const card = document.createElement('div');
      card.className = 'hole-card';
      const seen = this.discovered.has(hole.id);
      if (!seen) card.classList.add('locked');

      const canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = PREVIEW_PX * dpr;
      canvas.height = PREVIEW_PX * dpr;
      canvas.style.width = `${PREVIEW_PX}px`;
      canvas.style.height = `${PREVIEW_PX}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      if (seen) {
        drawHolePreview(ctx, hole, PREVIEW_PX);
      } else {
        drawLockedThumb(ctx, PREVIEW_PX);
      }
      card.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'hole-label';
      if (seen) {
        label.innerHTML = `
          <div class="hole-name">${escapeHtml(hole.name)}</div>
          <div class="hole-meta">PAR ${hole.par}</div>
        `;
      } else {
        label.innerHTML = `
          <div class="hole-name">??? Locked</div>
          <div class="hole-meta">Play to discover</div>
        `;
      }
      card.appendChild(label);

      if (seen) {
        card.addEventListener('click', () => {
          if (this.onShowHoleDetail) this.onShowHoleDetail(hole);
        });
      }
      this.grid.appendChild(card);
    }
  }

  _renderItems() {
    if (!this.itemsGrid) return;
    this.itemsGrid.innerHTML = '';
    for (const item of ITEMS) {
      const card = document.createElement('div');
      card.className = 'col-card';
      const color = RARITY_COLORS[item.rarity] || '#fff';
      card.style.setProperty('--card-color', color);
      card.innerHTML = `
        <div class="col-card-icon"><i class="${item.icon || 'fa-solid fa-circle'}"></i></div>
        <div class="col-card-rarity">${item.rarity}</div>
        <div class="col-card-name">${escapeHtml(item.name)}</div>
        <div class="col-card-desc">${escapeHtml(item.desc)}</div>
        <div class="col-card-meta">$${item.cost}</div>
      `;
      this.itemsGrid.appendChild(card);
    }
  }

  _renderClubs() {
    if (!this.clubsGrid) return;
    this.clubsGrid.innerHTML = '';
    for (const club of CLUBS) {
      const card = document.createElement('div');
      card.className = 'col-card';
      if (club.special) card.classList.add('special');
      card.style.setProperty('--card-color', club.color);
      let limitText = '';
      if (club.usesPerHole !== undefined) limitText = ` · ${club.usesPerHole}/hole`;
      else if (club.usesTotal !== undefined) limitText = ` · ${club.usesTotal} uses then breaks`;
      const costText = club.starter ? 'Starter' : `$${club.cost}`;
      card.innerHTML = `
        <div class="col-card-icon"><i class="${club.icon || 'fa-solid fa-club'}"></i></div>
        <div class="col-card-rarity">${club.special ? 'special' : 'club'}</div>
        <div class="col-card-name">${escapeHtml(club.name)}</div>
        <div class="col-card-desc">${escapeHtml(club.desc || '')}</div>
        <div class="col-card-meta">${costText}${limitText}</div>
      `;
      this.clubsGrid.appendChild(card);
    }
  }
}

// ---------- preview rendering ----------

function drawHolePreview(ctx, hole, SIZE) {
  const PAD = 6;
  const b = hole.bounds;
  const tx = (wx) => PAD + ((wx - b.minX) / (b.maxX - b.minX)) * (SIZE - 2 * PAD);
  const tz = (wz) => PAD + ((wz - b.minZ) / (b.maxZ - b.minZ)) * (SIZE - 2 * PAD);
  const sx = (units) => (units / (b.maxX - b.minX)) * (SIZE - 2 * PAD);

  // background = rough
  ctx.fillStyle = '#3e8c47';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // water (under fairway)
  if (hole.water && hole.water.length) {
    ctx.fillStyle = '#2a8acc';
    for (const w of hole.water) {
      if (w.type === 'circle') {
        ctx.beginPath();
        ctx.arc(tx(w.cx), tz(w.cz), sx(w.radius), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const left = tx(w.cx - w.w / 2);
        const right = tx(w.cx + w.w / 2);
        const top = tz(w.cz - w.h / 2);
        const bot = tz(w.cz + w.h / 2);
        ctx.fillRect(left, top, right - left, bot - top);
      }
    }
  }

  // fairway
  ctx.fillStyle = '#5fb160';
  for (const r of hole.fairway) {
    const left = tx(r.cx - r.w / 2);
    const right = tx(r.cx + r.w / 2);
    const top = tz(r.cz - r.h / 2);
    const bot = tz(r.cz + r.h / 2);
    ctx.fillRect(left, top, right - left, bot - top);
  }

  // bunkers
  if (hole.bunkers) {
    ctx.fillStyle = '#e0c98c';
    for (const bk of hole.bunkers) {
      ctx.beginPath();
      ctx.arc(tx(bk.cx), tz(bk.cz), sx(bk.radius), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // green
  ctx.fillStyle = '#82d27c';
  ctx.beginPath();
  ctx.arc(tx(hole.green.cx), tz(hole.green.cz), sx(hole.green.radius), 0, Math.PI * 2);
  ctx.fill();

  // tee
  ctx.fillStyle = '#b58a5f';
  const tSize = Math.max(5, sx(1.6));
  ctx.fillRect(tx(hole.teePosition.x) - tSize / 2, tz(hole.teePosition.z) - tSize / 2, tSize, tSize);

  // cup + flag
  const cupCx = tx(hole.cupPosition.x);
  const cupCz = tz(hole.cupPosition.z);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cupCx, cupCz, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.moveTo(cupCx + 1, cupCz - 8);
  ctx.lineTo(cupCx + 7, cupCz - 6);
  ctx.lineTo(cupCx + 1, cupCz - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cupCx + 0.5, cupCz - 9);
  ctx.lineTo(cupCx + 0.5, cupCz);
  ctx.stroke();

  // border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
}

function drawLockedThumb(ctx, SIZE) {
  ctx.fillStyle = '#2c4f33';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', SIZE / 2, SIZE / 2);
}

function describeFeatures(hole) {
  const bits = [];
  if (hole.water && hole.water.length) bits.push('water');
  if (hole.bunkers && hole.bunkers.length) bits.push(`${hole.bunkers.length} bunker${hole.bunkers.length > 1 ? 's' : ''}`);
  if (hole.fairway && hole.fairway.length > 1) bits.push('shaped fairway');
  if (!bits.length) bits.push('open');
  return bits.join(' · ');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
