// Items pool — Phase 4g
//
// Persistent items the player can buy from the Pro Shop. Two flavors:
//
//   slot: 'trinket' (default) — go in the items bag, can stack across copies
//   slot: 'ball'              — equipment: only one equipped at a time. Buying
//                               a new one auto-refunds the previous ball at
//                               half cost. The bag-slot system doesn't apply.
//
// Effects are queried at the relevant gameplay event via `run.hasItem(id)`
// or `run.itemCount(id)` (which see *both* the bag and the equipped ball).

export const ITEMS = [
  // ---- common: cheap, stack-friendly ----
  {
    id: 'heavy-driver',
    name: 'Heavy Driver',
    desc: 'Driver only: +10% Power. Stacks.',
    cost: 6,
    rarity: 'common',
    icon: 'icon-gem',
  },
  {
    id: 'lucky-tee',
    name: 'Lucky Tee',
    desc: 'First shot of each hole: +20% Power.',
    cost: 5,
    rarity: 'common',
    icon: 'icon-gem',
  },
  {
    id: 'sandbagger',
    name: 'Sandbagger',
    desc: '+$3 every time the ball lands in a bunker.',
    cost: 6,
    rarity: 'common',
    icon: 'icon-gem',
  },
  {
    id: 'driver-specialist',
    name: 'Driver Specialist',
    desc: 'Driver only: +25% Power.',
    cost: 8,
    rarity: 'common',
    icon: 'icon-gem',
  },
  {
    id: 'lead-wedge',
    name: 'Lead Wedge',
    desc: 'Wedge only: +25% Power.',
    cost: 8,
    rarity: 'common',
    icon: 'icon-gem',
  },

  // ---- uncommon: stronger / utility ----
  {
    id: 'trust-fund',
    name: 'Trust Fund',
    desc: '+$2 at the start of each hole.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'country-club-card',
    name: 'Country Club Card',
    desc: 'All shop prices 20% off.',
    cost: 12,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    desc: 'Interest cap doubled ($2 → $4).',
    cost: 13,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    desc: 'Minimap reveals the full bounce + roll path.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'range-finder',
    name: 'Range Finder',
    desc: 'Adds 50 / 100 / 150 yd rings to the minimap.',
    cost: 8,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'fairway-finder',
    name: 'Fairway Finder',
    desc: '+$1 every time the ball rests on the fairway.',
    cost: 9,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'hole-hustler',
    name: 'Hole Hustler',
    desc: '+$1 per under-par stroke at hole-out.',
    cost: 10,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },

  // ---- wind utility items ----
  {
    id: 'wind-charm',
    name: 'Wind Charm',
    desc: 'Wind has no effect on your shots.',
    cost: 12,
    rarity: 'uncommon',
    icon: 'icon-gem',
  },
  {
    id: 'tailwind-talisman',
    name: 'Tailwind Talisman',
    desc: 'Each hole, wind blows from your tee toward the cup.',
    cost: 18,
    rarity: 'rare',
    icon: 'icon-gem',
  },

  // ---- rare: changes how the ball BEHAVES in the world ----
  {
    id: 'bouncy-ball',
    name: 'Bouncy Ball',
    desc: 'Your ball is BOUNCIER. Glows orange.',
    cost: 15,
    rarity: 'rare',
    icon: 'fa-solid fa-circle',
    slot: 'ball',
  },
  {
    id: 'golden-ball',
    name: 'Golden Ball',
    desc: '+$3 every time you sink the ball.',
    cost: 14,
    rarity: 'rare',
    icon: 'fa-solid fa-circle',
    slot: 'ball',
  },
  {
    id: 'heavy-ball',
    name: 'Heavy Ball',
    desc: 'Wind affects you 50% less. Steel-grey ball.',
    cost: 9,
    rarity: 'common',
    icon: 'fa-solid fa-circle',
    slot: 'ball',
  },
];

/** True if this item is an equipment item (e.g. ball slot). Trinket items
 *  default to falsy here. */
export function isEquipment(item) {
  return !!(item && item.slot && item.slot !== 'trinket');
}

export function itemById(id) {
  return ITEMS.find((it) => it.id === id) || null;
}
