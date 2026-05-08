// HolePreview — Phase 4d
//
// Round overview modal. Shows ALL three holes of the current round (each
// round = 3 holes, the third is always a boss). The card for the player's
// active decision is highlighted with Play / Skip buttons; the other two
// are shown as context — already-resolved (done) or coming-up (upcoming).
//
// Mobile-first: cards stack vertically, modal scrolls if content overflows.

import { holeFeatures, isBossHole, bossHandicapText } from '../content/holes.js';

export class HolePreview {
  constructor() {
    this.modal = document.getElementById('hole-preview');
    this.headerEl = this.modal.querySelector('.preview-header');
    this.cardsEl = this.modal.querySelector('.preview-cards');

    this._onPlay = null;
    this._onSkip = null;
  }

  /**
   * @param {object} args
   * @param {number} args.round         — 1-indexed round number
   * @param {number} args.totalRounds   — usually 3
   * @param {Array<{holeNumber:number, template:object, meta:object, status:'done'|'current'|'upcoming', skipCash:number}>} args.holes
   * @param {function} args.onPlay
   * @param {function} args.onSkip
   */
  show({ round, totalRounds, holes, cash, bagItems, bagSlots, onPlay, onSkip }) {
    this._onPlay = onPlay || null;
    this._onSkip = onSkip || null;

    const current = holes.find((h) => h.status === 'current');
    const isBossNow = current && isBossHole(current.holeNumber);
    this.modal.classList.toggle('boss', !!isBossNow);

    const bagBadge = (typeof bagItems === 'number' && typeof bagSlots === 'number')
      ? `<div class="preview-bagcount"><i class="fa-solid fa-shapes"></i> ${bagItems}/${bagSlots}</div>`
      : '';
    const cashBadge = (typeof cash === 'number')
      ? `<div class="preview-cash">$${cash}</div>`
      : '';

    this.headerEl.innerHTML = `
      <div class="preview-status-row">
        ${cashBadge}
        ${bagBadge}
      </div>
      <div class="preview-tag">${isBossNow ? '⚑ BOSS HOLE' : 'Up next'}</div>
      <div class="preview-round">Round ${round} / ${totalRounds}</div>
    `;

    this.cardsEl.innerHTML = '';
    for (const h of holes) {
      this.cardsEl.appendChild(this._buildCard(h));
    }

    this.modal.classList.add('shown');
  }

  hide() {
    this.modal.classList.remove('shown');
  }

  isShown() {
    return this.modal.classList.contains('shown');
  }

  // ----- internals -----

  _buildCard({ holeNumber, template, meta, status, skipCash }) {
    const card = document.createElement('div');
    card.className = `preview-hole-card ${status}`;
    const isBoss = isBossHole(holeNumber);
    if (isBoss) card.classList.add('boss');

    if (status === 'done') {
      card.innerHTML = `
        <div class="phc-row">
          <span class="phc-num">Hole ${holeNumber}</span>
          <span class="phc-name">${template.name}</span>
          <span class="phc-status">✓ done</span>
        </div>
      `;
      return card;
    }

    // current and upcoming both show full info; only current gets buttons.
    const f = holeFeatures(template);
    const featureBits = [];
    featureBits.push({ icon: '⛳', label: `${f.distance} yd to cup` });
    if (f.water)   featureBits.push({ icon: '💧', label: `${f.water} water hazard${f.water > 1 ? 's' : ''}` });
    if (f.bunkers) featureBits.push({ icon: '🏖', label: `${f.bunkers} bunker${f.bunkers > 1 ? 's' : ''}` });
    if (f.dogleg)  featureBits.push({ icon: '↪',  label: 'Shaped fairway' });

    const featuresHtml = featureBits.map(
      (b) => `<div class="phc-feature"><span class="phc-feature-icon">${b.icon}</span><span>${b.label}</span></div>`
    ).join('');

    const metaBits = [
      `Par ${template.par}`,
      `Stroke limit ${meta.strokeLimit}`,
    ];
    if (isBoss) metaBits.push('2× cash');

    const headerLabel = status === 'current' ? '◉ NOW' : (isBoss ? '⚑ BOSS' : 'Coming up');

    let buttonsHtml = '';
    if (status === 'current') {
      const skipDisabled = isBoss;
      const skipLabel = skipDisabled ? "Can't skip boss" : `Skip (+$${skipCash})`;
      buttonsHtml = `
        <div class="phc-buttons">
          <button class="phc-skip" type="button" ${skipDisabled ? 'disabled' : ''}>${skipLabel}</button>
          <button class="phc-play" type="button">Play ▸</button>
        </div>
      `;
    }

    const handicapHtml = isBoss
      ? `<div class="phc-handicap">⚠ ${bossHandicapText(meta.bossHandicap)}</div>`
      : '';

    card.innerHTML = `
      <div class="phc-head">
        <span class="phc-status-tag">${headerLabel}</span>
        <span class="phc-num">Hole ${holeNumber}</span>
      </div>
      <div class="phc-name big">${template.name}</div>
      <div class="phc-meta">${metaBits.join(' · ')}</div>
      ${handicapHtml}
      <div class="phc-features">${featuresHtml}</div>
      ${buttonsHtml}
    `;

    if (status === 'current') {
      const playBtn = card.querySelector('.phc-play');
      const skipBtn = card.querySelector('.phc-skip');
      playBtn.addEventListener('click', () => {
        if (this._onPlay) this._onPlay();
      });
      skipBtn.addEventListener('click', () => {
        if (skipBtn.disabled) return;
        if (this._onSkip) this._onSkip();
      });
    }

    return card;
  }
}
