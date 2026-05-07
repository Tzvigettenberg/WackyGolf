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

  // -------------------- HOLE 3: Island Green (par 3, ~95 yd) --------------------
  {
    id: 'island-green',
    name: 'Island Green',
    par: 3,
    teePosition: new Vector3(0, 0, 55),
    cupPosition: new Vector3(0, 0, -40),
    fairway: [
      // small tee strip — the rest is water
      { cx: 0, cz: 50, w: 14, h: 16 },
    ],
    green:  { cx: 0, cz: -40, radius: 6 },
    bounds: { minX: -28, maxX: 28, minZ: -58, maxZ: 65 },
    trees: [
      [-16, 60, 1.0], [16, 60, 1.0],
      [-22, 35, 1.0], [22, 35, 1.0],
      [-25,  0, 1.1], [25,  0, 1.1],
      [-22, -45, 1.0], [22, -45, 1.0],
      [-15, -55, 0.9], [15, -55, 0.9],
    ],
    bunkers: [
      { cx: 4, cz: -43, radius: 1.5 },   // tiny greenside trap
    ],
    water: [
      // large pond between tee and green; the green is its own island
      { type: 'rect', cx: 0, cz: 5, w: 38, h: 70 },
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
export function templateForHole(holeNumber) {
  return HOLES[(holeNumber - 1) % HOLES.length];
}

/** Stroke limit for a hole — par + 4 in this iteration. */
export function holeMetaFromTemplate(template) {
  return { par: template.par, strokeLimit: template.par + 4 };
}
