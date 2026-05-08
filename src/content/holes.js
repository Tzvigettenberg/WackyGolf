// Hole templates — Phase 3.5 (with water hazards)
//
// Original layouts inspired by universal golf course archetypes:
//   1. Bender       — gentle dogleg right, no water (warm-up)
//   2. Long Carry   — par 5 with a cross-fairway water hazard mid-shot
//   3. Island Green — par 3 over a wide pond to a small green
//   4. Pond Bend    — sharp dogleg with a pond in the corner (cut or play around)
//
// Distances tuned for our clubs:
//   Driver  ~110 yd reach (~77 yd carry + bounce/roll)
//   5-Iron  ~ 95 yd
//   Wedge   ~ 45 yd
//   Putter  ~ 22 yd

import { Vector3 } from 'three';

export const HOLES = [
  // -------------------- HOLE 1: Bender (par 4, ~170 yd) --------------------
  {
    id: 'bender',
    name: 'Bender',
    par: 4,
    teePosition: new Vector3(-12, 0, 75),
    cupPosition: new Vector3(22, 0, -50),
    fairway: [
      { cx: -10, cz: 25, w: 16, h: 100 },   // tee leg, slight rightward shape
      { cx:   8, cz: -25, w: 28, h: 30 },   // bend zone
      { cx:  22, cz: -45, w: 18, h: 30 },   // approach
    ],
    green:  { cx: 22, cz: -50, radius: 5 },
    bounds: { minX: -28, maxX: 38, minZ: -65, maxZ: 88 },
    trees: [
      // outside left (penalize over-cut)
      [-22, 60, 1.0], [-22, 30, 1.1], [-22,  0, 1.0],
      [-22, -30, 1.0], [-15, -50, 0.9],
      // inside corner (block straight cut)
      [3,  35, 1.0], [3,   5, 0.9], [4, -10, 1.0],
      // far right outer
      [32, 30, 1.0], [32,   0, 1.0], [32, -30, 1.0],
      // beyond green
      [27, -65, 1.0], [12, -65, 0.9],
      // around tee
      [-18, 80, 0.9], [0, 80, 1.0],
    ],
    bunkers: [
      { cx: -3, cz: -25, radius: 2 },   // corner bunker
      { cx: 17, cz: -45, radius: 2 },   // greenside front-left
      { cx: 27, cz: -50, radius: 2 },   // greenside right
    ],
    water: [],
  },

  // -------------------- HOLE 2: Long Carry (par 5, ~250 yd) --------------------
  {
    id: 'long-carry',
    name: 'Long Carry',
    par: 5,
    teePosition: new Vector3(0, 0, 130),
    cupPosition: new Vector3(0, 0, -120),
    fairway: [
      { cx: 0, cz: 110, w: 14, h: 40 },   // tee leg (z=90..130)
      // bail-out island in the middle of the water — layup here if you can't carry the full hazard
      { cx: 0, cz:  79, w:  7, h: 10 },
      { cx: 0, cz:  30, w: 14, h: 70 },   // first landing zone past the water (z=-5..65)
      { cx: 0, cz: -90, w: 12, h: 60 },   // approach (z=-120..-60)
    ],
    green:  { cx: 0, cz: -120, radius: 5 },
    bounds: { minX: -32, maxX: 32, minZ: -140, maxZ: 148 },
    trees: [
      [-13, 110, 1.0], [13, 110, 1.0],
      [-15,  50, 1.1], [15,  50, 1.0],
      [-13,  10, 1.0], [13,  10, 1.0],
      [-13, -30, 1.0], [13, -30, 1.0],
      [-13, -65, 1.0], [13, -65, 1.0],
      [-13, -100, 1.0], [13, -100, 1.0],
      [-25,  70, 1.2], [25,  70, 1.0],
      [-25, -50, 1.0], [25, -50, 1.2],
      [-25, 130, 0.9], [25, 130, 1.0],
    ],
    bunkers: [
      { cx: -3, cz:  -85, radius: 2 },
      { cx:  4, cz: -115, radius: 2.5 },
      { cx: -4, cz: -125, radius: 2 },
    ],
    water: [
      // narrower water (22 yd wide) hugs the fairway corridor — going wide
      // gets you to dry rough on the sides, but it costs you yards.
      { type: 'rect', cx: 0, cz: 79, w: 22, h: 22 },
    ],
  },

  // -------------------- HOLE 3: Island Green (par 3, ~40 yd carry) --------------------
  {
    id: 'island-green',
    name: 'Island Green',
    par: 3,
    teePosition: new Vector3(0, 0, 35),
    cupPosition: new Vector3(0, 0, -5),
    fairway: [
      // tee strip — the rest is water on all sides of the green
      { cx: 0, cz: 32, w: 14, h: 14 },
    ],
    green:  { cx: 0, cz: -5, radius: 8 },
    bounds: { minX: -28, maxX: 28, minZ: -40, maxZ: 50 },
    trees: [
      // ring of trees framing the lake
      [-22, 30, 1.0], [22, 30, 1.0],
      [-26,  0, 1.1], [26,  0, 1.1],
      [-22, -30, 1.0], [22, -30, 1.0],
      [-18, -40, 0.9], [18, -40, 0.9],
      [-22, 45, 0.9], [22, 45, 0.9],
    ],
    bunkers: [
      { cx: 5, cz: -7, radius: 1.5 },     // tiny pot bunker on the island green
    ],
    water: [
      // wide rectangular lake — the green sits as a true island within it.
      // Surface priority (green > water) means the green still reads as green.
      { type: 'rect', cx: 0, cz: 0, w: 44, h: 50 },
    ],
  },

  // -------------------- HOLE 4: Pond Bend (par 4, ~190 yd path) --------------------
  {
    id: 'pond-bend',
    name: 'Pond Bend',
    par: 4,
    teePosition: new Vector3(22, 0, 65),
    cupPosition: new Vector3(-25, 0, -45),
    fairway: [
      { cx: 22, cz: 25, w: 16, h: 90 },     // tee leg, going downrange
      { cx:  0, cz: -22, w: 30, h: 22 },    // bend zone
      { cx: -25, cz: -40, w: 18, h: 25 },   // approach to green
    ],
    green:  { cx: -25, cz: -45, radius: 5 },
    bounds: { minX: -42, maxX: 38, minZ: -62, maxZ: 80 },
    trees: [
      // outside right (rough on miss-right)
      [33, 55, 1.0], [33, 25, 1.0], [33,  -5, 1.0],
      // small grove inside the corner above the pond
      [12, 30, 1.0], [10,  5, 0.9],
      // beyond green
      [-37, -45, 1.0], [-32, -55, 0.9],
      // bottom edge
      [-15, -57, 1.0], [0, -57, 1.0],
      // around tee
      [14, 75, 0.9], [28, 75, 1.0],
    ],
    bunkers: [
      { cx: -25, cz: -38, radius: 2 },
      { cx: -32, cz: -50, radius: 2 },
    ],
    water: [
      // pond in the inside corner — cut over for risk/reward, or play around
      { type: 'circle', cx: 0, cz: 5, radius: 19 },
    ],
  },
];

/** Pick the template for a given hole number (1-indexed). Cycles. */
/**
 * Each round (3 holes) is played on the SAME hole template — the third
 * play in the round is a tougher boss version of that same hole. So one
 * full run = 3 distinct holes, each played 3 times with rising stakes.
 */
export function templateForHole(holeNumber) {
  const round = Math.ceil(holeNumber / 3);
  return HOLES[(round - 1) % HOLES.length];
}

/** A run is 9 holes. After holing #9 the player wins the run. */
export const RUN_LENGTH = 9;

/** Boss holes: stricter stroke limit + double payout multiplier. */
export const BOSS_HOLES = new Set([3, 6, 9]);

export function isBossHole(holeNumber) {
  return BOSS_HOLES.has(holeNumber);
}

/**
 * Cash payout for skipping a hole. Tuned to land between "par credit" and
 * "birdie" — tempting safety net, but skipping every hole leaves you poorer
 * than playing well. Boss holes can't be skipped.
 */
export function skipCashFor(template, holeNumber) {
  if (isBossHole(holeNumber)) return 0;
  return template.par + 2;
}

/**
 * Plain-English summary of the hazards on a hole, for the preview screen.
 *   { water, bunkers, dogleg, distance, par }
 */
export function holeFeatures(template) {
  const water = template.water && template.water.length ? template.water.length : 0;
  const bunkers = template.bunkers && template.bunkers.length ? template.bunkers.length : 0;
  const dogleg = template.fairway && template.fairway.length > 1;
  const dx = template.cupPosition.x - template.teePosition.x;
  const dz = template.cupPosition.z - template.teePosition.z;
  const distance = Math.round(Math.hypot(dx, dz));
  return { water, bunkers, dogleg, distance, par: template.par };
}

/**
 * Each boss hole has a distinct handicap so they don't all feel like
 * "tighter strokes". Indexed by which boss it is (1st, 2nd, or 3rd).
 *   one-club  — first swing locks your club for the rest of the hole
 *   tiny-cup  — cup radius shrinks dramatically, putts must be precise
 *   stormy    — every shot loses 30% power, ranges feel cramped
 */
const BOSS_HANDICAPS = ['one-club', 'tiny-cup', 'stormy'];

export function bossHandicapFor(holeNumber) {
  if (!isBossHole(holeNumber)) return null;
  // hole 3 → idx 0, hole 6 → idx 1, hole 9 → idx 2
  const idx = Math.floor((holeNumber - 1) / 3);
  return BOSS_HANDICAPS[idx % BOSS_HANDICAPS.length];
}

/** Human-readable description for the preview screen. */
export function bossHandicapText(handicap) {
  switch (handicap) {
    case 'one-club': return 'ONE CLUB ONLY — first swing locks your club';
    case 'tiny-cup': return 'TINY CUP — cup is half-size';
    case 'stormy':   return 'STORMY — every shot loses 30% power';
    default:         return '';
  }
}

/**
 * Stroke limit for a hole. Boss holes get par+2 (tight); normal holes get
 * par+4. Hole-number-aware so the host can pass it in directly.
 */
export function holeMetaFromTemplate(template, holeNumber = 1) {
  const leeway = isBossHole(holeNumber) ? 2 : 4;
  return {
    par: template.par,
    strokeLimit: template.par + leeway,
    isBoss: isBossHole(holeNumber),
    bossHandicap: bossHandicapFor(holeNumber),
    holeNumber,
  };
}
