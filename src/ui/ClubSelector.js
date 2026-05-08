// Club selector UI — Phase 4c
//
// Bottom-of-screen row, one button per OWNED club. Special clubs show a
// remaining-uses badge in the corner. A club with 0 uses left this hole
// is rendered disabled (greyed out, can't be selected).
//
// The selector is rebuilt whenever the bag changes (new club unlocked,
// active changed, use consumed, club broke).

export class ClubSelector {
  constructor(bag) {
    this.bag = bag;

    this.container = document.createElement('div');
    this.container.id = 'club-selector';
    document.body.appendChild(this.container);

    this._render();
    this.bag.onChange(() => this._render());
  }

  _render() {
    this.container.innerHTML = '';
    const owned = this.bag.ownedClubs();
    for (const club of owned) {
      const btn = document.createElement('button');
      btn.className = 'club-btn';
      btn.dataset.id = club.id;
      btn.style.setProperty('--club-color', club.color);

      // remaining-uses badge for special clubs
      let badge = '';
      const perHole = this.bag.usesLeftThisHole(club.id);
      const total = this.bag.usesLeftTotal(club.id);
      if (perHole !== Infinity) {
        badge = `<span class="club-uses">${perHole}/${club.usesPerHole}</span>`;
      } else if (total !== Infinity) {
        badge = `<span class="club-uses">${total}</span>`;
      }

      btn.innerHTML = `
        ${badge}
        <span class="club-short">${club.short}</span>
        <span class="club-name">${club.name}</span>
      `;

      const usable = this.bag.canUseThisHole(club.id);
      const lockedOut = this.bag.lockedClubId && this.bag.lockedClubId !== club.id;
      if (!usable) btn.classList.add('disabled');
      if (lockedOut) btn.classList.add('locked-out');
      if (this.bag.activeId === club.id) btn.classList.add('active');
      if (this.bag.lockedClubId === club.id) btn.classList.add('locked-in');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!usable || lockedOut) return;
        this.bag.setActive(club.id);
      });

      this.container.appendChild(btn);
    }
  }
}
