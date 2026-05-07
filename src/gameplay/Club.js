// Clubs and the player's bag — Phase 2
//
// Each club defines its own max launch speed and launch angle.
// Driver is low + long, Wedge is high + short, Putter rolls.
//
// SwingController reads the current club from the bag at fire time;
// the player switches clubs via the ClubSelector UI.

const deg = (d) => (d * Math.PI) / 180;

export const CLUBS = [
  {
    id: 'driver',
    name: 'Driver',
    short: 'DR',
    color: '#3a8eff',
    maxSpeed: 52,           // yd/s at full power
    launchAngle: deg(11),   // low arc — max range
  },
  {
    id: 'iron',
    name: '5-Iron',
    short: '5i',
    color: '#22c55e',
    maxSpeed: 42,
    launchAngle: deg(22),   // medium arc
  },
  {
    id: 'wedge',
    name: 'Wedge',
    short: 'W',
    color: '#f59e0b',
    maxSpeed: 30,
    launchAngle: deg(50),   // high lob — short, stops fast
  },
  {
    id: 'putter',
    name: 'Putter',
    short: 'P',
    color: '#a855f7',
    maxSpeed: 16,
    launchAngle: deg(0),    // rolls — no vertical lift
  },
];

export function getClub(id) {
  return CLUBS.find((c) => c.id === id) || CLUBS[0];
}

/**
 * Bag holds the currently-selected club and notifies listeners on change.
 * Tiny hand-rolled observer pattern, no dependencies.
 */
export class Bag {
  constructor(initialId = 'driver') {
    this.activeId = initialId;
    this._listeners = [];
  }

  get active() {
    return getClub(this.activeId);
  }

  setActive(id) {
    if (id === this.activeId) return;
    if (!CLUBS.some((c) => c.id === id)) return;
    this.activeId = id;
    for (const fn of this._listeners) fn(this.active);
  }

  cycle(dir = 1) {
    const idx = CLUBS.findIndex((c) => c.id === this.activeId);
    const next = (idx + dir + CLUBS.length) % CLUBS.length;
    this.setActive(CLUBS[next].id);
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((x) => x !== fn);
    };
  }
}
