// Items pool — Phase 4b
//
// Persistent items the player can buy from the Pro Shop. Each instance takes
// one bag slot; duplicates take separate slots and can be sold independently.
// Effects are queried by id at the relevant point in gameplay (swing, hole
// start, cash-out, etc.) — no per-item handler hooks, just `run.hasItem(id)`
// or `run.itemCount(id)` lookups.

export const ITEMS = [
  // ---- common: cheap, stack-friendly ----
  {
    id: 'heavy-driver',
    name: 'Heavy Driver',
    desc: 'Driver only: +10% Power. Stacks.',
    cost: 8,
    rarity: 'common',
  },
  {
    id: 'lucky-tee',
    name: 'Lucky Tee',
    desc: 'First shot of each hole: +20% Power.',
    cost: 6,
    rarity: 'common',
  },
  {
    id: 'sandbagger',
    name: 'Sandbagger',
    desc: '+$3 every time the ball lands in a bunker.',
    cost: 7,
    rarity: 'common',
  },
  {
    id: 'driver-specialist',
    name: 'Driver Specialist',
    desc: 'Driver only: +25% Power.',
    cost: 10,
    rarity: 'common',
  },
  {
    id: 'lead-wedge',
    name: 'Lead Wedge',
    desc: 'Wedge only: +25% Power.',
    cost: 10,
    rarity: 'common',
  },

  // ---- uncommon: stronger / utility ----
  {
    id: 'trust-fund',
    name: 'Trust Fund',
    desc: '+$2 at the start of each hole.',
    cost: 12,
    rarity: 'uncommon',
  },
  {
    id: 'country-club-card',
    name: 'Country Club Card',
    desc: 'All shop prices 20% off.',
    cost: 14,
    rarity: 'uncommon',
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    desc: 'Interest cap doubled ($2 → $4).',
    cost: 16,
    rarity: 'uncommon',
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    desc: 'Minimap reveals the full bounce + roll path.',
    cost: 12,
    rarity: 'uncommon',
  },
  {
    id: 'range-finder',
    name: 'Range Finder',
    desc: 'Adds 50 / 100 / 150 yd rings to the minimap.',
    cost: 9,
    rarity: 'uncommon',
  },

  // ---- rare: changes how the ball BEHAVES in the world ----
  {
    id: 'bouncy-ball',
    name: 'Bouncy Ball',
    desc: 'Your ball is BOUNCIER. Glows orange.',
    cost: 18,
    rarity: 'rare',
  },
];

export function itemById(id) {
  return ITEMS.find((it) => it.id === id) || null;
}
