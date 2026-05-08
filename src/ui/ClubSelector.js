// Club selector UI — Phase 4o
//
// Bottom-of-screen row, one button per OWNED club INSTANCE (duplicates get
// their own button). Selection is by index, so two Phoenix Irons each
// behave as separate slots.
//
// Visual: each button's border / icon use the rarity color (so commons
// read as a group, rares pop). The button name keeps the club's name.

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
    const slots = this.bag.ownedSlots();
    for (const slot of slots) {
      const { index, club, isActive, isLocked, isLockedOut, usesLeftThisHole, usesLeftTotal, canUse } = slot;

      const btn = document.createElement('button');
      btn.className = 'club-btn';
      btn.dataset.index = String(index);
      // Rarity color drives both the border and the icon tint.
      btn.style.setProperty('--club-color', club.color);

      // Use-counter badge for special clubs.
      let badge = '';
      if (usesLeftThisHole !== Infinity) {
        badge = `<span class="club-uses">${usesLeftThisHole}/${club.usesPerHole}</span>`;
      } else if (usesLeftTotal !== Infinity) {
        badge = `<span class="club-uses">${usesLeftTotal}</span>`;
      }

      btn.innerHTML = `
        ${badge}
        <i class="club-icon ${club.icon || 'fa-solid fa-flag-checkered'}"></i>
        <span class="club-name">${club.name}</span>
      `;

      if (!canUse) btn.classList.add('disabled');
      if (isLockedOut) btn.classList.add('locked-out');
      if (isActive) btn.classList.add('active');
      if (isLocked) btn.classList.add('locked-in');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canUse || isLockedOut) return;
        this.bag.setActiveByIndex(index);
      });

      this.container.appendChild(btn);
    }
  }
}
