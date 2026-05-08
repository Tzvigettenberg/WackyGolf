// Clubs and the player's bag — Phase 4o (rarity + duplicates)
//
// Each club has a rarity (common / uncommon / rare). The visual color of
// the club — pill border, icon tint, ItemBar pill — is derived from rarity,
// so commons all read together visually and rares pop.
//
// Bag is an ARRAY (not a Set), so duplicates are allowed — buy two Phoenix
// Irons, you get two independent 5-use counters; sell either one and the
// other stays. Each instance is addressed by index.
//
// Use limits (per instance):
//   usesPerHole  — fresh count at the start of every hole (Cannon = 1)
//   usesTotal    — pool that depletes across the whole run; when it hits 0
//                  the club BREAKS and is removed from the bag

const deg = (d) => (d * Math.PI) / 180;

/** Visual color per rarity tier. The frame + icon of a club use this. */
export const RARITY_COLORS = {
  common:    '#cfd9d6',
  uncommon:  '#7fd6ff',
  rare:      '#c79cff',
  legendary: '#ffb84a',
};

export const CLUBS = [
  // ---- base clubs (all common) ----
  {
    id: 'driver',
    name: 'Driver',
    short: 'DR',
    rarity: 'common',
    maxSpeed: 60,
    launchAngle: deg(14),
    cost: 7,
    desc: 'Long. Tee-shot specialist.',
    icon: 'icon-club',
  },
  {
    id: 'iron',
    name: '5-Iron',
    short: '5i',
    rarity: 'common',
    maxSpeed: 44,
    launchAngle: deg(24),
    starter: true,
    cost: 0,
    desc: 'All-purpose mid-iron. The starter club.',
    icon: 'icon-club',
  },
  {
    id: 'wedge',
    name: 'Wedge',
    short: 'W',
    rarity: 'common',
    maxSpeed: 30,
    launchAngle: deg(52),
    cost: 7,
    desc: 'High lob. Short and stops fast on the green.',
    icon: 'icon-club',
  },
  {
    id: 'putter',
    name: 'Putter',
    short: 'P',
    rarity: 'common',
    maxSpeed: 14,
    launchAngle: deg(0),
    cost: 5,
    desc: 'Low rolling stroke. Use on the green.',
    icon: 'icon-club',
  },

  // ---- rarer clubs — visually distinguished by rarity color, not labels ----
  {
    id: 'phoenix-iron',
    name: 'Phoenix Iron',
    short: 'PX',
    rarity: 'uncommon',
    maxSpeed: 58,
    launchAngle: deg(22),
    cost: 12,
    usesTotal: 5,
    desc: 'Powerful 5-iron. Breaks after 5 swings.',
    icon: 'icon-club',
  },
  {
    id: 'cannon',
    name: 'Cannon',
    short: 'CN',
    rarity: 'rare',
    maxSpeed: 90,
    launchAngle: deg(12),
    cost: 16,
    usesPerHole: 1,
    desc: 'Massive range. 1 use per hole.',
    icon: 'icon-club',
  },
];

// Derive visual color from rarity (uniform across all clubs of the same tier).
for (const c of CLUBS) {
  c.color = RARITY_COLORS[c.rarity || 'common'];
}

export function getClub(id) {
  return CLUBS.find((c) => c.id === id) || CLUBS[0];
}

export function starterClubIds() {
  return CLUBS.filter((c) => c.starter).map((c) => c.id);
}

/** Max clubs in the bag at once. Forces you to pick a kit, not hoard. */
export const MAX_CLUBS = 4;

/** Sell value when getting rid of a club — half of cost, min 1. */
export function clubSellValue(club) {
  return Math.max(1, Math.floor((club.cost || 0) / 2));
}

/**
 * Bag — tracks owned clubs (as an array, allowing duplicates), the active
 * selection (by index), and per-instance use counters.
 *
 * Indexed API (preferred for UI):
 *   ownedSlots()                 — render-friendly array per instance
 *   setActiveByIndex(i)
 *   sellClubAtIndex(i)
 *   usesLeftThisHole(index)
 *   usesLeftTotal(index)
 *   canUseAtIndex(index)
 *
 * Backward-compat shortcuts (for code that doesn't care about instances):
 *   activeId, lockedClubId       — clubId of active / locked instance
 *   isOwned(id)                  — true if any instance has this id
 */
export class Bag {
  constructor(initialIds) {
    const ids = (initialIds && initialIds.length ? initialIds : starterClubIds());
    this.owned = ids.slice();           // Array<string clubId>, duplicates ok
    this.activeIndex = 0;
    this.usesPerHoleLeft = [];          // parallel array — count per index
    this.usesTotalLeft = [];            // parallel array
    this._initUsesForAll();
    // Boss "one-club" handicap — locks player to a clubId for the hole.
    // Tracked by id (not index) so duplicates of the locked club stay usable.
    this.lockedClubId = null;
    this._listeners = [];
  }

  // ---- indexed queries ----

  ownedSlots() {
    return this.owned.map((id, index) => ({
      index,
      club: getClub(id),
      isActive: this.activeIndex === index,
      // Locked = "this club id matches the boss lock". With clubId-based
      // locking, duplicates of the locked club are all flagged in.
      isLocked: this.lockedClubId !== null && id === this.lockedClubId,
      isLockedOut: this.lockedClubId !== null && id !== this.lockedClubId,
      usesLeftThisHole: this.usesPerHoleLeft[index],
      usesLeftTotal: this.usesTotalLeft[index],
      canUse: this.canUseAtIndex(index),
    }));
  }

  /** Convenience: the club objects only, in order. */
  ownedClubs() {
    return this.owned.map((id) => getClub(id));
  }

  /** All non-starter clubs available in the shop pool. Duplicates allowed
   *  in the bag, so we don't filter by ownership. */
  shopClubs() {
    return CLUBS.filter((c) => !c.starter && c.cost !== undefined);
  }

  isOwned(id) { return this.owned.includes(id); }
  ownedCountOfId(id) { return this.owned.filter((x) => x === id).length; }

  get clubSlotsLeft() { return Math.max(0, MAX_CLUBS - this.owned.length); }
  get hasFreeClubSlot() { return this.owned.length < MAX_CLUBS; }

  usesLeftThisHole(index) {
    return this.usesPerHoleLeft[index] !== undefined
      ? this.usesPerHoleLeft[index] : Infinity;
  }
  usesLeftTotal(index) {
    return this.usesTotalLeft[index] !== undefined
      ? this.usesTotalLeft[index] : Infinity;
  }
  canUseAtIndex(index) {
    return this.usesLeftThisHole(index) > 0 && this.usesLeftTotal(index) > 0;
  }

  // ---- backward-compat ID-based queries ----

  /** Currently-selected club's id. */
  get activeId() { return this.owned[this.activeIndex] || null; }
  /** Currently-selected club object. */
  get active() { return getClub(this.activeId); }

  // ---- ownership ----

  /** Add a club to the bag. With duplicates allowed, this just appends. */
  unlock(id) {
    if (!CLUBS.some((c) => c.id === id)) return false;
    if (!this.hasFreeClubSlot) return false;
    this.owned.push(id);
    const club = getClub(id);
    this.usesPerHoleLeft.push(club.usesPerHole !== undefined ? club.usesPerHole : Infinity);
    this.usesTotalLeft.push(club.usesTotal !== undefined ? club.usesTotal : Infinity);
    this._emit();
    return true;
  }

  /** Sell the club at this index. Refuses if it's your last club. Returns
   *  the sold club's definition (caller refunds based on it), or null. */
  sellClubAtIndex(index) {
    if (this.owned.length <= 1) return null;
    if (index < 0 || index >= this.owned.length) return null;
    const club = getClub(this.owned[index]);
    this._removeAt(index);
    return club;
  }

  /** Backward-compat: sell the FIRST instance of this id (for code that
   *  thinks in club ids rather than indexes). Use sellClubAtIndex when
   *  the user clicked a specific instance. */
  sellClub(id) {
    const idx = this.owned.indexOf(id);
    if (idx < 0) return null;
    return this.sellClubAtIndex(idx);
  }

  // ---- selection ----

  setActiveByIndex(index) {
    if (index === this.activeIndex) return;
    if (index < 0 || index >= this.owned.length) return;
    if (!this.canUseAtIndex(index)) return;
    // Boss lock: only allow switching among instances of the locked club id.
    if (this.lockedClubId !== null && this.owned[index] !== this.lockedClubId) return;
    this.activeIndex = index;
    this._emit();
  }

  /** Backward-compat: pick the first usable instance with this clubId. */
  setActive(id) {
    if (this.owned[this.activeIndex] === id) return;
    for (let i = 0; i < this.owned.length; i++) {
      if (this.owned[i] === id && this.canUseAtIndex(i)) {
        this.setActiveByIndex(i);
        return;
      }
    }
  }

  /** Cycle to the next usable owned club. */
  cycle(dir = 1) {
    const usable = [];
    for (let i = 0; i < this.owned.length; i++) {
      if (this.canUseAtIndex(i)) usable.push(i);
    }
    if (!usable.length) return;
    const cur = usable.indexOf(this.activeIndex);
    const next = (cur + dir + usable.length) % usable.length;
    this.setActiveByIndex(usable[next]);
  }

  // ---- uses ----

  consumeActiveUse() {
    const i = this.activeIndex;
    if (i < 0 || i >= this.owned.length) return;
    const id = this.owned[i];
    const club = getClub(id);
    let changed = false;
    if (club.usesPerHole !== undefined) {
      this.usesPerHoleLeft[i] = Math.max(0, this.usesPerHoleLeft[i] - 1);
      changed = true;
    }
    if (club.usesTotal !== undefined) {
      const next = this.usesTotalLeft[i] - 1;
      this.usesTotalLeft[i] = next;
      if (next <= 0) {
        this._breakClub(i);
        return;
      }
      changed = true;
    }
    // Auto-switch off the active if it ran out of uses for this hole.
    if (!this.canUseAtIndex(this.activeIndex)) {
      const fallback = this._firstUsableIndex();
      if (fallback >= 0) this.activeIndex = fallback;
    }
    if (changed) this._emit();
  }

  resetHoleUses() {
    for (let i = 0; i < this.owned.length; i++) {
      const club = getClub(this.owned[i]);
      if (club.usesPerHole !== undefined) {
        this.usesPerHoleLeft[i] = club.usesPerHole;
      }
    }
    this.lockedClubId = null;
    if (!this.canUseAtIndex(this.activeIndex)) {
      const fallback = this._firstUsableIndex();
      if (fallback >= 0) this.activeIndex = fallback;
    }
    this._emit();
  }

  resetForNewRun() {
    const starters = starterClubIds();
    this.owned = starters.slice();
    this.activeIndex = 0;
    this.lockedClubId = null;
    this._initUsesForAll();
    this._emit();
  }

  // ---- locking (boss handicap) ----

  lockToActive() {
    const id = this.activeId;
    if (this.lockedClubId === id) return;
    this.lockedClubId = id;
    this._emit();
  }

  // ---- listeners ----

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((x) => x !== fn); };
  }

  // ---- internals ----

  _emit() { for (const fn of this._listeners) fn(this); }

  _initUsesForAll() {
    this.usesPerHoleLeft = this.owned.map((id) => {
      const c = getClub(id);
      return c.usesPerHole !== undefined ? c.usesPerHole : Infinity;
    });
    this.usesTotalLeft = this.owned.map((id) => {
      const c = getClub(id);
      return c.usesTotal !== undefined ? c.usesTotal : Infinity;
    });
  }

  _firstUsableIndex() {
    for (let i = 0; i < this.owned.length; i++) {
      if (this.canUseAtIndex(i)) return i;
    }
    return -1;
  }

  _removeAt(index) {
    this.owned.splice(index, 1);
    this.usesPerHoleLeft.splice(index, 1);
    this.usesTotalLeft.splice(index, 1);
    if (this.activeIndex === index) {
      this.activeIndex = this._firstUsableIndex();
      if (this.activeIndex < 0) this.activeIndex = 0;
    } else if (this.activeIndex > index) {
      this.activeIndex -= 1;
    }
    // Clear the boss lock if no instance of the locked club is left.
    if (this.lockedClubId && !this.owned.includes(this.lockedClubId)) {
      this.lockedClubId = null;
    }
    this._emit();
  }

  _breakClub(index) {
    this._removeAt(index);
  }
}
