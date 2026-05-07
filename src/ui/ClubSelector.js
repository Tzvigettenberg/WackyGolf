// Club selector UI — Phase 2
//
// Bottom-of-screen row of 4 buttons. Tap to switch. The active club is
// highlighted. Buttons are color-coded so the active club is recognisable
// at a glance.

import { CLUBS } from '../gameplay/Club.js';

export class ClubSelector {
  constructor(bag) {
    this.bag = bag;

    this.container = document.createElement('div');
    this.container.id = 'club-selector';

    this.buttons = CLUBS.map((club) => {
      const btn = document.createElement('button');
      btn.className = 'club-btn';
      btn.dataset.id = club.id;
      btn.style.setProperty('--club-color', club.color);
      btn.innerHTML = `
        <span class="club-short">${club.short}</span>
        <span class="club-name">${club.name}</span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.bag.setActive(club.id);
      });
      this.container.appendChild(btn);
      return btn;
    });

    document.body.appendChild(this.container);
    this._update(this.bag.active);
    this.bag.onChange((c) => this._update(c));
  }

  _update(active) {
    for (const btn of this.buttons) {
      btn.classList.toggle('active', btn.dataset.id === active.id);
    }
  }
}
