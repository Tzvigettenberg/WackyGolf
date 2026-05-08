// Clubs and the player's bag — Phase 4c
//
// The player starts with one club (the 5-iron). Other clubs are unlocked
// via the Pro Shop's Clubs tab. Some "special" clubs trade cost for raw
// power but have per-hole or per-run use limits.
//
// Use limits:
//   usesPerHole  — fresh count at the start of every hole (Cannon = 1)
//   usesTotal    — pool that depletes across the whole run; when it hits 0
//                  the club BREAKS and is removed from the bag
//
// When neither field is set, the club has unlimited uses (the four base clubs).

const deg = (d) => (d * Math.PI) / 180;

export const CLUBS = [
  // ---- base clubs ----
  {
    id: 'driver',
    name: 'Driver',
    short: 'DR',
    color: '#3a8eff',
    maxSpeed: 60,           // yd/s at full power
    launchAngle: deg(14),   // raised from 11° for a real arc, less rolling
    cost: 7,
    desc: 'Long. Tee-shot specialist.',
  },
  {
    id: 'iron',
    name: '5-Iron',
    short: '5i',
    color: '#22c55e',
    maxSpeed: 44,
    launchAngle: deg(24),   // medium-high arc
    starter: true,          // free at run start
    cost: 0,
    desc: 'All-purpose mid-iron. The starter club.',
  },
  {
    id: 'wedge',
    name: 'Wedge',
    short: 'W',
    color: '#f59e0b',
    maxSpeed: 30,
    launchAngle: deg(52),   // high lob — short, stops fast
    cost: 7,
    desc: 'High lob. Short and stops fast on the green.',
  },
  {
    id: 'putter',
    name: 'Putter',
    short: 'P',
    color: '#a855f7',
    maxSpeed: 14,           // ~22 yd roll cap — green-only at hole scale
    launchAngle: deg(0),    // rolls flat
    cost: 5,
    desc: 'Low rolling stroke. Use on the green.',
  },

  // ---- special clubs ----
  {
    id: 'cannon',
    name: 'Cannon',
    short: 'CN',
    color: '#ff4444',
    maxSpeed: 90,           // +50% over driver
    launchAngle: deg(12),
    cost: 16,
    usesPerHole: 1,
    desc: 'Massive range. 1 use per hole.',
    special: true,
  },
  {
    id: 'phoenix-iron',
    name: 'Phoenix Iron',
    short: 'PX',
    color: '#ff9b3a',
    maxSpeed: 58,           // +32% over 5-iron
    launchAngle: deg(22),
    cost: 12,
    usesTotal: 5,           // breaks after 5 total uses across the run
    desc: 'Powerful 5-iron. Breaks after 5 swings.',
    special: true,
  },
];

export function getClub(id) {
  return CLUBS.find((c) => c.id === id) || CLUBS[0];
}

export function starterClubIds() {
  return CLUBS.filter((c) => c.starter).map((c) => c.id);
}

/**
 * Bag — tracks owned clubs, the active selection, and the use-counters that
 * make special clubs limited.
 *
 * Per-hole counters reset on `resetHoleUses()` (called from main.js on hole
 * start). Total counters live for the whole run.
 *
 * Listeners are notified on:
 *   - active club change
 *   - club unlock (newly purchased)
 *   - club break (use counter hit 0)
 *   - per-hole use consumed (so the UI can update remaining-uses badge)
 */
export class Bag {
  constructor(initialIds) {
    const ids = (initialIds && initialIds.length ? initialIds : starterClubIds());
    this.ownedIds = new Set(ids);
    this.activeId = ids[0];

    // Per-club use trackers. Keys are club ids; absence = unlimited.
    this.usesPerHoleLeft = new Map();
    this.usesTotalLeft = new Map();
    this._initUsesFor(this.ownedIds);

    // Boss-handicap: when set to a club id, the player can only use THAT
    // club for the rest of the hole. Cleared at hole start.
    this.lockedClubId = null;

    this._listeners = [];
  }

  // ---- ownership ----

  isOwned(id)        { return this.ownedIds.has(id); }
  /** All owned club objects, in canonical CLUBS order. */
  ownedClubs()       { return CLUBS.filter((c) => this.ownedIds.has(c.id)); }
  /** All UNowned club objects, for the Shop's Clubs tab. */
  shopClubs()        { return CLUBS.filter((c) => !this.ownedIds.has(c.id) && c.cost !== undefined); }

  unlock(id) {
    if (this.ownedIds.has(id)) return false;
    if (!CLUBS.some((c) => c.id === id)) return false;
    this.ownedIds.add(id);
    this._initUsesFor([id]);
    this._emit();
    return true;
  }

  // ---- selection ----

  get active() { return getClub(this.activeId); }

  /** Try to switch to club id. No-op if not owned, out of uses, or locked. */
  setActive(id) {
    if (id === this.activeId) return;
    if (!this.ownedIds.has(id)) return;
    if (!this.canUseThisHole(id)) return;
    if (this.lockedClubId && this.lockedClubId !== id) return;
    this.activeId = id;
    this._emit();
  }

  /** Lock the player to whatever club is currently active for the rest of
   *  the hole. Boss handicap. Cleared by resetHoleUses(). */
  lockToActive() {
    if (this.lockedClubId === this.activeId) return;
    this.lockedClubId = this.activeId;
    this._emit();
  }

  /** Cycle to the next owned + usable club. */
  cycle(dir = 1) {
    const owned = this.ownedClubs().filter((c) => this.canUseThisHole(c.id));
    if (!owned.length) return;
    const idx = owned.findIndex((c) => c.id === this.activeId);
    const next = (idx + dir + owned.length) % owned.length;
    this.setActive(owned[next].id);
  }

  // ---- uses ----

  /** Per-hole uses remaining for this club id, Infinity if unlimited. */
  usesLeftThisHole(id) {
    return this.usesPerHoleLeft.has(id) ? this.usesPerHoleLeft.get(id) : Infinity;
  }
  /** Total-run uses remaining for this club id, Infinity if unlimited. */
  usesLeftTotal(id) {
    return this.usesTotalLeft.has(id) ? this.usesTotalLeft.get(id) : Infinity;
  }
  /** True if the club has at least one use left this hole. */
  canUseThisHole(id) {
    return this.usesLeftThisHole(id) > 0 && this.usesLeftTotal(id) > 0;
  }

  /** Decrement the active club's use counters by 1 (called on shot fire). */
  consumeActiveUse() {
    const id = this.activeId;
    let changed = false;
    if (this.usesPerHoleLeft.has(id)) {
      this.usesPerHoleLeft.set(id, Math.max(0, this.usesPerHoleLeft.get(id) - 1));
      changed = true;
    }
    if (this.usesTotalLeft.has(id)) {
      const next = this.usesTotalLeft.get(id) - 1;
      this.usesTotalLeft.set(id, next);
      if (next <= 0) {
        // Club breaks — remove from bag, switch active to something else.
        this._breakClub(id);
        return;
      }
      changed = true;
    }
    // If the active club just ran out for this hole, auto-switch to a usable
    // owned club so the player isn't stuck with a dead Cannon selected.
    if (!this.canUseThisHole(this.activeId)) {
      const fallback = this.ownedClubs().find((c) => this.canUseThisHole(c.id));
      if (fallback) this.activeId = fallback.id;
    }
    if (changed) this._emit();
  }

  /** Refresh per-hole counters from the club definitions. Called on hole start. */
  resetHoleUses() {
    for (const club of this.ownedClubs()) {
      if (club.usesPerHole !== undefined) {
        this.usesPerHoleLeft.set(club.id, club.usesPerHole);
      }
    }
    // Hole transition clears any boss-handicap lock from the previous hole.
    this.lockedClubId = null;
    // If active club has no uses left this hole, fall back to a usable one.
    if (!this.canUseThisHole(this.activeId)) {
      const fallback = this.ownedClubs().find((c) => this.canUseThisHole(c.id));
      if (fallback) this.activeId = fallback.id;
    }
    this._emit();
  }

  /** Wipe state back to a fresh run with just the starter club. */
  resetForNewRun() {
    const starters = starterClubIds();
    this.ownedIds = new Set(starters);
    this.usesPerHoleLeft = new Map();
    this.usesTotalLeft = new Map();
    this._initUsesFor(this.ownedIds);
    this.activeId = starters[0];
    this._emit();
  }

  // ---- listeners ----

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((x) => x !== fn);
    };
  }

  // ---- internals ----

  _initUsesFor(ids) {
    for (const id of ids) {
      const club = getClub(id);
      if (!club) continue;
      if (club.usesPerHole !== undefined) this.usesPerHoleLeft.set(id, club.usesPerHole);
      if (club.usesTotal !== undefined)   this.usesTotalLeft.set(id, club.usesTotal);
    }
  }

  _breakClub(id) {
    this.ownedIds.delete(id);
    this.usesPerHoleLeft.delete(id);
    this.usesTotalLeft.delete(id);
    if (this.activeId === id) {
      const fallback = this.ownedClubs()[0];
      this.activeId = fallback ? fallback.id : null;
    }
    this._emit();
  }

  _emit() {
    for (const fn of this._listeners) fn(this);
  }
}
