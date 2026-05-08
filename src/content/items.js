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
    cost: 6,
    rarity: 'common',
    icon: 'fa-solid fa-dumbbell',
  },
  {
    id: 'lucky-tee',
    name: 'Lucky Tee',
    desc: 'First shot of each hole: +20% Power.',
    cost: 5,
    rarity: 'common',
    icon: 'fa-solid fa-clover',
  },
  {
    id: 'sandbagger',
    name: 'Sandbagger',
    desc: '+$3 every time the ball lands in a bunker.',
    cost: 6,
    rarity: 'common',
    icon: 'fa-solid fa-money-bill-wave',
  },
  {
    id: 'driver-specialist',
    name: 'Driver Specialist',
    desc: 'Driver only: +25% Power.',
    cost: 8,
    rarity: 'common',
    icon: 'fa-solid fa-bullseye',
  },
  {
    id: 'lead-wedge',
    name: 'Lead Wedge',
    desc: 'Wedge only: +25% Power.',
    cost: 8,
    rarity: 'common',
    icon: 'fa-solid fa-mountain-sun',
  },

  // ---- uncommon: stronger / utility ----
  {
    id: 'trust-fund',
    name: 'Trust Fund',
    desc: '+$2 at the start of each hole.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'fa-solid fa-piggy-bank',
  },
  {
    id: 'country-club-card',
    name: 'Country Club Card',
    desc: 'All shop prices 20% off.',
    cost: 12,
    rarity: 'uncommon',
    icon: 'fa-solid fa-credit-card',
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    desc: 'Interest cap doubled ($2 → $4).',
    cost: 13,
    rarity: 'uncommon',
    icon: 'fa-solid fa-chart-line',
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    desc: 'Minimap reveals the full bounce + roll path.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'fa-solid fa-eye',
  },
  {
    id: 'range-finder',
    name: 'Range Finder',
    desc: 'Adds 50 / 100 / 150 yd rings to the minimap.',
    cost: 8,
    rarity: 'uncommon',
    icon: 'fa-solid fa-ruler',
  },
  {
    id: 'fairway-finder',
    name: 'Fairway Finder',
    desc: '+$1 every time the ball rests on the fairway.',
    cost: 9,
    rarity: 'uncommon',
    icon: 'fa-solid fa-crosshairs',
  },
  {
    id: 'hole-hustler',
    name: 'Hole Hustler',
    desc: '+$1 per under-par stroke at hole-out.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'fa-solid fa-flag',
  },

  // ---- rare: changes how the ball BEHAVES in the world ----
  {
    id: 'bouncy-ball',
    name: 'Bouncy Ball',
    desc: 'Your ball is BOUNCIER. Glows orange.',
    cost: 15,
    rarity: 'rare',
    icon: 'fa-solid fa-basketball',
  },
];

export function itemById(id) {
  return ITEMS.find((it) => it.id === id) || null;
}
