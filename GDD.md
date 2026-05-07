# Wacky Golf — Game Design Document

**Version:** 0.6 (themed items, auto-consumables, simpler bosses)
**Last updated:** 2026-05-07
**Author:** Tzvi + Claude

---

## Quick Overview (read this first)

You play 3D golf on your phone. A run is endless **rounds of 3 holes each** — two regular holes and a boss hole.

For each regular hole you choose **Play** (earn cash) or **Skip** (get a random reward called a Tag). The boss hole is mandatory and arrives with a **handicap** like *No Driver allowed* — visible from the start of the round so you can plan. Bust the stroke limit on any played hole and the run ends.

Every shot uses the **same drag-back swing** — point, pull back to set power, release. Same UI for tee shots, fairway shots, and putts. The minimap always shows where the ball will land.

After every played hole, the **Pro Shop** opens. You can buy:

- **Items** (one unified pool, two storage trays — your *bag* for persistent buffs that always run, your *consumables* tray for tap-to-use effects you save for clutch moments)
- **Club upgrades** for your fixed 4-club bag (Driver, 5-Iron, Wedge, Putter — each levels 1 to 4)
- **Stat upgrades** for your 4 stats (Power, Accuracy, Touch, Luck)

Items have funny golfer-themed names — *Daddy's Credit Card* lets you go $25 into shop debt, *Plaid Pants* widens your tempo zone, *Pro V1s* boost your next 3 shots. Stack the right items and you can make your Putter outshoot your Driver.

Push deeper than last run. Repeat forever.

---

## 1. Vision Statement

**Wacky Golf** is a **mobile-first** 3D golf roguelike. You play endless rounds of 3 holes each — two regular holes and a boss hole. Finish a hole and you earn cash and unlock the pro shop. Skip a hole and you trade that money + shop visit for a one-shot reward (a Tag). Spend cash in the shop on **items** and on **stat upgrades**. Stack synergies. Push deeper. Bust your stroke limit and the run ends.

It's **Golf Clash's swing feel** wearing **Balatro's metagame skin** — radically simplified: a single item pool, a clean stat tree, no attachment systems, no curses. Low-poly, runs buttery on a phone.

---

## 2. Core Pillars

1. **Mobile-first feel.** One thumb plays the game. Every interaction works on a 6-inch touchscreen at 60 FPS. Portrait orientation by default, landscape supported.
2. **Easy to start, deep to master.** A new player finishes a hole in 30 seconds. A veteran nails Perfect tempo, stacks 5 items, and pushes past Round 8.
3. **Build variety > balance.** Some items will feel broken. That's the genre. We patch only the truly degenerate (infinite money, zero-stroke holes).
4. **Run length ≈ 10–25 minutes.** A full death-spiral fits a commute. No mid-run save-scumming.
5. **Cheap, expressive low-poly.** Every asset buildable from Three.js primitives + vertex colors. No artist required to ship.

---

## 3. Platform & Tech

| Concern | Choice |
|---|---|
| Render engine | Three.js (r170+), WebGL 2 |
| Physics | Custom ball physics (gravity + drag + Magnus + surface friction) |
| Collision | Sphere vs AABB checks; raycasts for terrain height |
| Build | Vite + vanilla JS (ES2022) |
| State | In-memory tree; `localStorage` for run save + meta |
| Audio | WebAudio API; user-gesture-gated start to satisfy iOS Safari |
| Hosting | **GitHub Pages** with GitHub Actions auto-deploy on push to `main` |
| Target browsers | **iOS Safari 16+** (primary) and **Chrome Android** — must work on both |
| Touch input | **Pointer Events API** (`pointerdown` / `pointermove` / `pointerup`) — works the same in Safari, Chrome, and on desktop |
| Orientation | Portrait primary, landscape supported |
| Perf budget | 60 FPS on iPhone 12 / Pixel 5; < 5 MB initial download; < 200 draw calls/frame |

---

## 4. Core Gameplay Loop

**Run start sequence:** New run → player gets $8 seed cash → **Round 1 Preview** screen (the hole picker — see all 3 holes including boss handicap) → choose Play or Skip on hole 1 → first swing or first Skip Tag draw.

There is no shop before the first hole. The first shop visit happens *after* the first played hole.

```
              ┌──────────────────┐
              │ ROUND 1 PREVIEW  │   (the hole picker — all 3 holes, boss handicap)
              └────────┬─────────┘
                       ↓
        ┌──────────────┴──────────────┐
        ↓                              ↓
  [PLAY hole 1]                  [SKIP hole 1]
   ↓                              ↓
   earn cash                      get Skip Tag (no cash, no shop)
   ↓                              ↓
   PRO SHOP                       (skip to hole 2 immediately)
   ↓                              ↓
        └──────────────┬──────────────┘
                       ↓
        ┌──────────────┴──────────────┐
        ↓                              ↓
  [PLAY hole 2]                  [SKIP hole 2]
   ↓                              ↓
   earn cash                      get Skip Tag
   ↓                              ↓
   PRO SHOP                       (skip to boss hole immediately)
   ↓                              ↓
        └──────────────┬──────────────┘
                       ↓
                [PLAY BOSS HOLE]      ← cannot skip
                       ↓
                  earn cash
                       ↓
                   PRO SHOP
                       ↓
              ROUND N+1 begins (3 new holes, harder)
```

**Per shot:** aim → swing → react → repeat until ball is in cup or stroke limit busts.
**Per hole:** finish under stroke limit OR run ends.
**Per round:** 2 regular holes (each play-or-skip) + 1 mandatory boss.
**Per run:** rounds keep coming forever, scaling harder, until you bust.

---

## 5. Swing System

The heartbeat of the game. Reference touchstones: **Golf Clash** (drag-back power + tempo bar), **Wii Sports Golf** (clear shot quality feedback), **Mario Golf** (club distance bands).

### Phases of a shot

1. **Aim phase.** A chevron arrow on the ground points from ball toward target. Player drags left/right anywhere on screen to rotate aim. The 3D world shows a faint ghost arc, but the *primary* preview is the **minimap** (see below).
2. **Pull-back phase.** Player touches the ball and drags backward (away from aim direction). Distance dragged = power %. A target zone marks "perfect" power for the current shot.
3. **Tempo (skill check).** While dragging back, a small horizontal bar appears with a moving dot. There's a green Perfect zone near center. Player must release within that zone or eat an accuracy penalty.
4. **Release.** Ball is launched: `power × tempo_modifier × club_stats × player_stats × wind × spin`.
5. **Spin (optional, advanced).** *(Unlocked via items)* Mid-flight, a swipe on the ball adds backspin/topspin/hook/slice.

### Minimap (the primary landing preview)

In 1st/3rd-person 3D view, a tree, a hill, or pure distance can hide the predicted landing spot. The **minimap** solves that.

- Always-visible top-down minimap pinned to a screen corner (default top-right, ~25% of screen width).
- Shows: ball position, pin position, all hazards (water, sand, OOB), green outline, wind arrow.
- Shows the **predicted landing zone** as a colored circle that updates live with aim and club selection.
- Predicted landing assumes "Perfect" power and "Good" tempo for the selected club (with `Eagle Eye`-style items extending the prediction to multi-bounce).
- Tap the minimap to expand it to full-screen tactical view; tap again to collapse.
- Pinch on the minimap to zoom; drag to pan.

Dot-color legend on the minimap: green dot = green/fairway, yellow = sand, blue = water, red = OOB.

The minimap is **the** ruler of the game. Use it.

### Tempo zones

| Tempo result | Zone (distance from center) | Effect |
|---|---|---|
| Perfect | inner 10% | +5% distance, no curve, +$1 bonus |
| Good | 10–30% | as-aimed, no penalty |
| OK | 30–60% | small random curve (±5°) |
| Sloppy | 60–100% (outer band) | big curve (±15°), -10% power |

Zone widths are modified by club stats, player Accuracy stat, and items.

### Wind

Each hole rolls a wind direction (compass heading) and strength (0–25 mph early tiers, up to 40+ late tiers). Shown as arrow + mph in HUD and as an arrow on the minimap. Wind affects ball flight in proportion to airtime — tall lobs catch more wind than line drives. Low-loft shots like rolling Putter shots feel almost no wind.

### Item activation feedback

**Persistent items auto-trigger** when their condition fires (e.g., "first shot of each hole"). **Consumables are tap-to-activate** — the player decides when to use them, which lets them save a *Power Pellet* for the boss tee shot or hold a *Mulligan Mike* for the moment they shank into water.

Once a consumable is activated, multi-shot effects auto-decrement across their remaining charges — you tap once to **arm** it, then it fires for the next 3 shots (or whatever its charge count is) without further input.

Whenever any item triggers — persistent auto-fire OR an armed consumable firing one of its charges — the UI shows feedback:

- The item's card flashes (white border pulse, ~0.4 s)
- A small floating tooltip appears next to the item tray: `⚡ Pro V1s · +10% distance (2 left)`
- Subtle sfx ping (post-MVP)

So players never have to track charges in their head, and they always see *which* item just changed their shot.

### One swing for everything (no separate putting mode)

**The same drag-back swing is used for every shot — tee shots, fairway shots, chip shots, putts.** The only thing that differs between clubs is the club's stat profile (Power, Accuracy, Loft, Range). On the green, you tap to switch to your Putter and use the same swing UI. Off the green, you can still pick the Putter if you want — the ball just won't go far without upgrades.

This is intentional: it makes the "**max your Putter so it replaces your Driver**" build possible. With enough Putter level upgrades, a *Mountain Putter* item, a *Putter Devotee* item, and a maxed Power stat, your Putter can outshoot your Driver.

The minimap landing dot updates with whichever club is selected, so picking a Putter on the tee shows you exactly how short the shot will be — visual feedback that's club-agnostic.

---

## 6. Run Structure

### Round = 3 holes

Modeled directly on Balatro's small/big/boss blind structure.

| Hole in round | Role | Skip allowed? |
|---|---|---|
| 1 | Regular hole | Yes (gives Skip Tag) |
| 2 | Regular hole | Yes (gives Skip Tag) |
| 3 | **Boss hole** | **NEVER** — must be played |

Skipping awards a **Skip Tag** (see § 8) instead of cash + shop. The trade is sharp: no shop visit means no items or stat upgrades that round. Choose carefully.

### Round preview screen (Balatro-style)

At the start of each round (after the post-round shop), a **Round Preview** screen appears showing all 3 upcoming holes side-by-side. The boss hole's handicap is revealed here — so you can plan shop spending around it.

```
┌─ ROUND 4 ────────────────────────────────────────────┐
│                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐      │
│  │  HOLE 1  │   │  HOLE 2  │   │   ★ BOSS ★   │      │
│  │  Par 4   │   │  Par 5   │   │  Lava Cup    │      │
│  │  342 yd  │   │  481 yd  │   │  Par 4       │      │
│  │  Wind ↗  │   │  Wind ←  │   │  ⚠ NO DRIVER │      │
│  │  $reward │   │  $reward │   │  +$60 boss   │      │
│  │ [Play]   │   │ [Play]   │   │   bonus      │      │
│  │ [Skip ▸] │   │ [Skip ▸] │   │  [Mandatory] │      │
│  └──────────┘   └──────────┘   └──────────────┘      │
│                                                       │
│   Skip rewards: Cash $12 / Item / Stat / Discount    │
│                                                       │
│   [▶  Begin Round]                                    │
└───────────────────────────────────────────────────────┘
```

Decisions are still made **per hole as you reach it** (Play/Skip prompt re-appears at hole 1 and hole 2), but you've seen the full round in advance and can plan accordingly. The Round Preview is also accessible anytime during the round via a "Round" button in the HUD.

### Boss handicaps

Every boss has a **handicap** — a single rule that bends standard golf for that hole only. Handicaps are shown on the Round Preview so you can plan upgrades and item buys to counter them.

| Handicap | Effect |
|---|---|
| **No Driver** | Driver disabled this hole |
| **No Wedges** | Wedge disabled this hole |
| **No Putter** | Putter disabled — you must finish without it (chip-ins encouraged) |
| **No Items** | Persistent + consumable items disabled this hole |
| **Wind 2×** | Wind strength doubled |
| **Tiny Cup** | Cup is half size, harder to hole out |
| **Tight Limit** | Stroke limit is `par + 0` regardless of round tier |

Handicaps are randomized per boss spawn — same boss can have different handicaps on different runs. Geometric gimmicks (Windmill blades, Lava lake, etc.) are baked into the boss's geometry and don't change. So a boss = (geometric gimmick) + (random handicap).

**Communication to player:** A red banner is always visible on the boss card in the Round Preview ("⚠ NO DRIVER"). The **first time** a player encounters any specific handicap on this device, a one-shot tooltip popup explains what it means in detail. Subsequent encounters just show the banner — we trust the player remembers. Tracked in `localStorage` as a flag set per handicap-type-seen.

### Round difficulty (endless)

| Round | Stroke leeway over par (regular) | Boss hole limit | Wind | Hazard density |
|---|---|---|---|---|
| 1 | par + 4 | par + 2 | mild | low |
| 2 | par + 3 | par + 2 | mild–moderate | low |
| 3 | par + 3 | par + 1 | moderate | medium |
| 4 | par + 3 | par + 1 | moderate | medium |
| 5 | par + 2 | par + 1 | strong | high |
| 6 | par + 2 | par + 0 | strong | high |
| 7+ | par + 1 (− 1 every 3 rounds) | par + 0 | extreme | extreme |

Round 7+ also introduces course modifiers: gravity pulses, moving hazards, visibility fog, etc.

### Boss holes = regular hole + boss modifier + handicap

We **don't** build bespoke boss courses (rotating windmills, pinball machines, etc.). Bosses are just **regular hole templates** dressed up with two layered "boss" effects:

1. **A boss modifier** — a thematic visual + mechanical change applied to the geometry. Easy to implement (numeric tweaks to existing systems).
2. **A handicap** — a temporary rule that bends the player's gameplay. Random per spawn.

This keeps boss design cheap to ship and easy to expand. New bosses = new combinations, not new code.

#### Boss modifier pool

| Modifier | Effect |
|---|---|
| Lava Course | Sand bunkers become lava — landing in lava = stroke penalty + ball replaced |
| Old Growth | Trees on the course are 2× the size and 2× the density |
| Tight Greens | Green is half the normal size |
| Hazard Heavy | +50% more sand and water on the course |
| Storm Course | Wind doubled in strength |
| Slick Greens | Putts roll +50% farther — easy to overshoot |
| Long Grass | Fairway has rough zones that sap shot power |
| Foggy Course | Reduced visibility in 3D view; the minimap becomes essential |

#### Boss formula

Per boss spawn, roll one **modifier** from the pool, one **handicap** from § "Boss handicaps" above. So a typical boss might be a *Crescent Lake template + Lava Course modifier + No Driver handicap*. Same template a few rounds later might roll *Crescent Lake + Old Growth + Tiny Cup* — feels different.

Boss holes pay a flat cash bonus on top of normal scoring (see § 8) and **always grant a shop visit**. **You can never skip a boss.**

---

## 7. Failure Condition

**Single rule: bust the stroke limit on a played hole = run over.**

The stroke limit per hole is `par + leeway` from the round table. On the last legal stroke before busting, a clear UI warning appears ("LAST CHANCE"). On bust, run ends → results screen (rounds completed, holes played, total cash, items collected, longest birdie streak) → main menu / new run.

Skipping a regular hole (1 or 2) does **not** bust you, but it skips both the cash and the shop for that hole, which is its own kind of cost.

**Boss holes can never be skipped — there is no Skip button on hole 3.** The only way past a boss is to play it under stroke limit. Plan your shop spending around the boss handicap (visible in Round Preview) so you're ready.

---

## 8. Economy & Scoring

**Starting cash:** $8. Seed money carried into your first played-hole shop, on top of whatever you earn from that hole. Or, if you skip your way to the boss, $8 + boss earnings hits the shop.

### Score → cash (regular holes)

| Result | Cash |
|---|---|
| Hole-in-one | $50 |
| Eagle (-2) | $25 |
| Birdie (-1) | $15 |
| Par (0) | $8 |
| Bogey (+1) | $3 |
| Double Bogey (+2) | $0 |
| Triple+ | $0 |

### Boss hole bonus

On top of score-based cash:

| Round | Boss bonus |
|---|---|
| 1 | +$15 |
| 2 | +$25 |
| 3 | +$40 |
| 4 | +$60 |
| 5 | +$80 |
| 6 | +$100 |
| 7+ | +$150, +$25 each subsequent round |

### End-of-hole bonuses

- **Interest:** +$1 per $5 currently held, capped at $5/hole (Balatro-style). Cap can be raised by items/stats.
- **Tempo bonus:** +$1 per Perfect tempo shot during the hole. Items can buff this.
- **Streak bonus:** +$2 per consecutive birdie-or-better; resets on bogey.

### Skip Tags (compensation for skipping holes 1 or 2)

When a regular hole is skipped, the player draws **one random Tag** from a small weighted pool:

| Tag | Effect | Weight |
|---|---|---|
| Cash Tag | +$12 immediately | 35% |
| Item Tag | Free random Common item | 30% |
| Stat Tag | +1 to a random stat | 20% |
| Discount Tag | Next shop is 25% off | 10% |
| Bounty Tag | Next hole pays 2× | 5% |

5 tag types — small enough to be predictable, varied enough to surprise. Skipping is a known-cost-unknown-reward trade.

### Cash sinks

- Items in the shop ($4–$25 typical)
- Stat upgrades ($6+, scaling with current level — see § 11)
- Reroll shop ($3 first reroll, +$1 each subsequent within same shop)
- Buy/sell clubs (§ 9)

---

## 9. Clubs

The player has a **fixed bag of 4 clubs** for the entire run. You don't buy new clubs and you don't sell them. What you *do* is **upgrade them** in the shop, and items can buff specific club types.

### The 4-club bag

| Club | Type | Power (L1) | Accuracy (L1) | Loft | Range (yds) | Notes |
|---|---|---|---|---|---|---|
| Driver | driver | 100 | 60 | Low | 200–280 | Tee shots, longest |
| 5-Iron | iron | 70 | 80 | Mid | 140–180 | All-purpose fairway |
| Wedge | wedge | 40 | 90 | V. High | 50–100 | Approach / chip / sand |
| Putter | putter | 20 | 99 | Flat | 0–30 (rolling) | Green only — by default |

These four are all you ever have. Variety comes from **upgrades** and **items**, not from collection.

### Club upgrades (Clubs tab in shop)

Each club levels from **1 → 4**. Each level adds +15% Power and +5 Accuracy to that club specifically. Upgrades are permanent for the run.

| Level transition | Cost |
|---|---|
| 1 → 2 | $15 |
| 2 → 3 | $30 |
| 3 → 4 | $50 |

A fully upgraded club (level 4) is **+45% Power** stronger than its level-1 self. Stack with items and stats and a level-4 Putter with the right items can functionally replace your Driver — that's the dream "Putter-only" build.

### Items, not clubs, drive build variety

Since clubs are fixed, items are where the run shape lives. Items can:

- **Boost a club type** — *Driver Forge: All Drivers +20% power* (applies to your one Driver)
- **Lock a club type out** — tradeoff items that disable one club for a big buff elsewhere (see § 10 Tradeoff items)
- **Expand a club's domain** — *Mountain Putter: Putter usable anywhere on the course* (yes, even the tee)
- **Compound with stats** — a maxed Power stat × a maxed Driver level × a Driver-buff item = ~3× base distance

### Boss handicaps temporarily disable clubs

Some boss holes show a **handicap** like "No Driver" — that club is disabled for that single hole only. The handicap is visible at the start of the round so you can plan shop spending (e.g., "Boss locks Driver, I'll upgrade my Iron and Putter this round"). See § 6.

---

## 10. Items

One unified pool, two simple categories, three rarity tiers, golfer-themed names. Items **never attach to specific clubs** — a "Drivers +20% Power" item buffs every Driver in your bag automatically.

### Two categories, two storage trays

| Category | Lifespan | Storage | Activation |
|---|---|---|---|
| **Persistent** | Run-long passive effect | **Bag** — 3 slots default, raisable to 6 via items | Auto-fires when condition met (no tap) |
| **Consumable** | One-shot or N-shot effect | **Consumables tray** — unlimited capacity, scrollable | **Tap to arm**; once armed, multi-shot effects fire automatically across remaining charges |

Consumables are tap-to-activate so you can **save them for clutch moments** — a *Power Pellet* held back for the boss tee shot, a *Mulligan Mike* armed only when you actually shank a shot. Once you tap to arm, you don't need to tap per shot — the charges decrement on their own.

When an item activates (persistent auto-fire OR armed consumable firing a charge), the card flashes and a tooltip pops up (see § 5).

### Three rarity tiers (border color = rarity)

| Rarity | Border color | Typical cost | Power |
|---|---|---|---|
| Common | white | $3–$10 | Modest, build foundations |
| Uncommon | blue | $8–$15 | Significant, build-shaping |
| Rare | purple | $14–$25 | Build-defining, sometimes broken |

Persistent items can be **sold** for half price from the shop's Bag view. Consumables can't be sold — they get used.

### Design rule: simple effects, funny names

We deliberately avoid items with edge-case logic ("skips to nearest grass") in favor of clean numeric tweaks ("rolls 50% less", "ignores wind", "adds $5 per hole if X"). The personality lives in the **names** and **flavor text**, not in clever rules.

### Sample item pool (target: 30+ at v1.0; 22 at v0.3)

#### Consumables — tap to arm ($3–$14)

Hold these in your tray for clutch moments. Tap a consumable's card → **Use** to arm it. Once armed, multi-shot effects auto-decrement across their charges.

| Item | Rarity | Cost | Effect once armed |
|---|---|---|---|
| Power Pellet | Common | $4 | +25% power on the next 1 shot |
| Wind Stone | Common | $4 | Ignores wind on the next 1 shot |
| Pro V1s | Common | $5 | +10% distance on the next 3 shots |
| Sticky Wedge | Common | $4 | No roll on landing for the next 1 shot |
| Cash Bundle | Common | $6 | +$10 at the end of the next hole (arm at the start of that hole) |
| Mulligan Mike | Uncommon | $8 | Re-do your last shot once. Arm just before your re-do swing. |
| Coach's Whistle | Uncommon | $6 | Next stat upgrade is half price (arm in the shop, before tapping a stat) |
| Sand Whisperer | Uncommon | $7 | No power penalty in sand for the next 3 shots |
| Spin Snack | Uncommon | $5 | +50% spin on the next 1 shot |
| Lucky Day | Rare | $10 | For the rest of this hole, any shot stopping within 1 ft of the cup auto-rolls in |
| Trainer's Notes | Rare | $10 | Next 3 stat upgrades each cost $5 less |
| Workout Plan | Rare | $12 | Instant on Use: +1 Power level |
| Eagle's Sight | Rare | $14 | Instant on Use: +1 Accuracy level |

#### Persistent — held in your bag

**Player-wide buffs**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Lucky Tee | Common | $6 | First shot of each hole: +20% power |
| Plaid Pants | Common | $6 | All shots: tempo Good zone +5% wider |
| Cigar Habit | Common | $6 | End of each hole: +$2 |
| Lefty Stance | Common | $5 | All shots: aim assist toward pin (mild auto-correct) |
| Sandbagger | Common | $6 | If ball lands in a bunker this hole: +$5 |
| Hot Streak | Uncommon | $8 | Each consecutive birdie/eagle: +$2 (resets on bogey) |
| Pro Tour Veteran | Uncommon | $10 | All clubs: +10% power |
| Hand-Stitched Glove | Uncommon | $10 | Perfect tempo bonus is +$3 instead of +$1 |
| The 19th Hole | Rare | $14 | End of each round: +$2 per item you hold |
| Bullseye | Rare | $10 | Perfect tempo bonus is +$5 instead of +$1 |
| Wind Whisperer | Rare | $12 | Wind ignored on full-power shots |
| Eagle Eye | Rare | $11 | Minimap shows extended multi-bounce trajectory |

**Money / shop-meta items**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Daddy's Credit Card | Rare | $0 | You can spend in shop down to **−$25**. Debt clears at run end. |
| Trust Fund | Rare | $20 | Start of each round: +$10 |
| Country Club Membership | Uncommon | $14 | All shop items: 20% off |
| Caddy on the Take | Uncommon | $10 | Each shop purchase refunds $1 |
| Reroll Card | Uncommon | $10 | First reroll each shop visit: free |
| Frugal Caddy | Common | $9 | Interest cap +$3 |
| Compound Interest | Rare | $20 | Interest cap doubled |
| Bounty Hunter | Rare | $14 | Each Perfect tempo: +$5 |

**Bag / inventory expansion**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Caddy Hire | Uncommon | $12 | +1 persistent item slot |
| Pro Bag | Rare | $20 | +2 persistent item slots |

**Ball property changes (ball goes everywhere with you, so these are run-long)**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Pro V1 Set | Common | $10 | All shots: +5% distance |
| Spin Set | Common | $10 | All shots: +20% spin |
| Heavy Set | Uncommon | $10 | All shots: 30% less wind drift |
| Soft Set | Common | $9 | All shots: 30% less roll on landing |
| Floaty Ball Set | Uncommon | $12 | Ball floats in water — no penalty, played from where it lands |
| Bouncy Set | Common | $8 | All shots: +30% roll on landing |

**Club-type buffs (apply to all clubs of that type, no attachment needed)**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Driver Forge | Uncommon | $10 | Driver: +20% power |
| Iron Master | Uncommon | $11 | 5-Iron: tempo zone +20% wider |
| Wedge Spin Wax | Common | $9 | Wedge: +50% spin |
| Putter Mallet | Uncommon | $10 | Putter: tempo zone +30% wider |
| Long Iron | Rare | $18 | 5-Iron range extended to 100–230 yds |

**Tradeoff / "lock-out" items (sell for half if you regret)**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Putter Devotee | Rare | $0 | Putter: +150% power. Driver disabled for the run. |
| Driver Cult | Rare | $3 | Driver: +50% power. Wedge disabled for the run. |
| Iron Will | Rare | $3 | 5-Iron: +60% power, +30% accuracy. Putter disabled for the run. |
| Minimalist | Rare | $5 | All clubs: +25% power. Wedge AND Putter disabled for the run. |

### Sample synergies (intentional broken builds)

- **Putter Devotee + maxed Putter levels + Pro Tour Veteran + Pro V1 Set + maxed Power stat** = the Putter-as-Driver meme build. Driver disabled, but who cares — your Putter outshoots it.
- **Bullseye + Plaid Pants + Hand-Stitched Glove + maxed Touch stat** = "Perfect tempo every shot" money printer.
- **Daddy's Credit Card + Country Club Membership + Reroll Card + Caddy on the Take** = shop-game build, ignore the actual golf, just buy out the shop with rerolls and refunds.
- **Workout Plan ×3 + Trainer's Notes + Coach's Whistle** = stat-mountain build, raw power instead of items.

We *want* these to exist. Patch only the truly degenerate.

### Sample item pool (target: 30+ at v1.0; 20 at v0.3)

#### Consumables ($3–$14)

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Power Pellet | Common | $4 | Next shot +25% power |
| Wind Stone | Common | $4 | Next shot ignores wind |
| Accuracy Tonic | Common | $5 | Next 3 shots: tempo Perfect zone +50% wider |
| Sticky Ball | Common | $4 | Next shot has 0 roll on landing |
| Cash Bundle | Common | $6 | Pays out $10 at end of next hole |
| Mulligan Coin | Uncommon | $5 | Re-do your last shot once |
| Coach's Whistle | Uncommon | $6 | Next stat upgrade is half price |
| Hazard Hopper | Uncommon | $6 | Next time ball lands in water/sand, it skips to nearest grass |
| Spin Ball | Uncommon | $5 | Next shot +50% spin |
| Lucky Ball | Rare | $7 | Next hole, any shot stopping within 1 ft of the cup auto-rolls in |
| Trainer's Notes | Rare | $10 | Next 3 stat upgrades each cost -$5 |
| Workout Plan | Rare | $12 | +1 Power stat instantly |
| Eagle's Sight | Rare | $14 | +1 Accuracy stat instantly |

#### Persistent ($6–$25) — held in your 3-slot inventory

**Player-wide effects**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Lucky Tee | Common | $6 | First shot of each hole +20% power |
| Sandbagger | Common | $6 | +$5 per hole if ball lands in bunker |
| Frugal Caddy | Common | $9 | Interest cap +$3 |
| Glass Cannon | Common | $5 | All clubs +30% power, stroke leeway -1 for the run |
| Hot Streak | Uncommon | $8 | +$2 per consecutive birdie/eagle (resets on bogey) |
| Greens Keeper | Uncommon | $8 | Putter shots that stop within 6 ft of the cup auto-roll in |
| Speedrun Caddy | Uncommon | $10 | Finish a hole in ≤3 strokes for +$15 |
| Tempo Trainer | Uncommon | $10 | Perfect zone permanently +20% wider |
| Bullseye | Rare | $10 | Perfect tempo bonus is +$5 instead of +$1 |
| Wind Whisperer | Rare | $12 | Wind ignored on full-power shots |
| Eagle Eye | Rare | $11 | Minimap shows extended multi-bounce trajectory |
| Combo Breaker | Rare | $12 | Birdie immediately followed by eagle = $50 bonus |
| Bigger Pockets | Rare | $15 | +1 persistent item slot |

**Club-type buffs (apply to all clubs of that type in your bag)**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Driver Forge | Uncommon | $10 | Driver +20% power |
| Iron Master | Uncommon | $11 | 5-Iron: tempo zone +20% wider |
| Wedge Spin Wax | Common | $9 | Wedge +50% spin |
| Putter Mallet | Uncommon | $10 | Putter forgiveness +30% |
| Mountain Putter | Rare | $20 | Putter usable anywhere on the course (not just on green) |
| Long Iron | Rare | $18 | 5-Iron range extended to 100–230 yds |

**Tradeoff items (lock one club, buff another)** — sellable for half if you regret the trade

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Putter Devotee | Rare | $0 | Putter +150% power. Driver disabled for the run. |
| Driver Cult | Rare | $3 | Driver +50% power. Wedge disabled for the run. |
| Iron Will | Rare | $3 | 5-Iron +60% power, +30% accuracy. Putter disabled for the run. |
| Minimalist | Rare | $5 | All clubs +25% power. Wedge AND Putter disabled for the run. |

**Ball buffs (apply to every shot for the run)**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Power Ball Set | Common | $10 | All shots +5% distance |
| Spin Ball Set | Common | $10 | All shots +20% spin |
| Heavy Ball Set | Uncommon | $10 | All shots resist wind by 30% |
| Soft Ball Set | Common | $9 | All shots: 30% less roll on landing |

**Shop & economy effects**

| Item | Rarity | Cost | Effect |
|---|---|---|---|
| Reroll Card | Uncommon | $10 | First reroll each shop visit is free |
| Discount Card | Uncommon | $12 | All shop items 20% off |
| Stat Sale | Uncommon | $10 | Stat upgrades cost -$5 |
| Bounty Hunter | Rare | $14 | +$5 every time you hit Perfect tempo |
| Wholesale Pass | Rare | $15 | Buy 1 item, get 1 free (once per shop visit) |
| Compound Interest | Rare | $20 | Interest cap doubled |

### Sample synergies (intentional broken combos)

- **Greens Keeper + Putter Mallet + high Putting stat** = guaranteed putts, free to play aggressive approaches.
- **Bullseye + Tempo Trainer + Bounty Hunter** = money printer, every Perfect tempo dumps cash.
- **Glass Cannon + Lucky Tee + Driver Forge + Power Ball Set** = blast-or-bust mega-power build.
- **Workout Plan ×3 + Trainer's Notes + Coach's Whistle** = stat-mountain build, raw stats over items.

We *want* these to exist. Patch only the truly degenerate.

---

## 11. Stats & Upgrades

The character has **4 stats**. Upgrade them in the **Stats** tab of the shop.

| Stat | Range | Effect |
|---|---|---|
| **Power** | 1–10 | +5% distance per level above 1 (applies to all clubs equally) |
| **Accuracy** | 1–10 | +5% wider tempo "Good" zone per level above 1 |
| **Touch** | 1–10 | +5% wider tempo "Perfect" zone per level above 1 (the bonus zone, all shots) |
| **Luck** | 1–5 | Shifts shop rarity weights (see § 12 table); +1% chance of kinder bounces per level |

All 4 stats apply to **every shot equally**, including Putter shots. There's no putter-specific stat — that's deliberate, so the "max-out-Putter" build is driven by club levels and items, not stat allocation.

(Spin is a *club* and *ball* stat, not a player stat. Bag Size is gone — your bag is always the 4 starter clubs.)

### Upgrade costs

Cost to go from level *N* to *N+1*: **`$5 + N²`**.

| Level transition | Cost |
|---|---|
| 1 → 2 | $6 |
| 2 → 3 | $9 |
| 3 → 4 | $14 |
| 4 → 5 | $21 |
| 5 → 6 | $30 |
| 6 → 7 | $41 |
| 7 → 8 | $54 |
| 8 → 9 | $69 |
| 9 → 10 | $86 |

Modifications:
- *Coach's Whistle* halves the next upgrade.
- *Trainer's Notes* applies -$5 to the next 3 upgrades.
- *Workout Plan / Eagle's Sight* grants a free level outright.

Luck has only 5 levels (1 → 5). Apply the same `$5 + N²` formula but cap at level 5.

### Starting stats

Power 5, Accuracy 5, Touch 5, Luck 1.

---

## 12. Pro Shop

Visited at:

1. **After every PLAYED hole** (regular + boss).
2. **NOT after a skipped hole** — skipping forfeits the shop.

There is no shop before the first hole. A new run drops you straight into the Round 1 Preview.

### Layout

Three tabs: **Items**, **Clubs**, **Stats**. One screen, simple. Tap any card for a popup with full details. Tap **Buy** or **Sell** to act. Tap **Continue** to proceed to the next hole.

```
┌─ HOLE COMPLETE — $73 cash ─────────────────┐
│                                             │
│   [Items]   Clubs   Stats                  │
│                                             │
│   ┌──────┐  ┌──────┐  ┌──────┐             │
│   │ Item │  │ Item │  │ Item │             │
│   │ $7   │  │ $5   │  │ $4   │             │
│   └──────┘  └──────┘  └──────┘             │
│                                             │
│   YOUR ITEMS:  [Lucky Tee] [Eagle Eye]     │
│                                             │
│   [ Reroll $3 ]      [ Continue → ]        │
└─────────────────────────────────────────────┘
```

**Items tab**
- 3 random items from the pool, drawn against the rarity weights for the current round (table below) further shifted by your **Luck** stat.
- Each item card has a **colored border** indicating its rarity (white/blue/purple).
- Below: your owned persistent items, with **Sell** button on each (tap card → popup → Sell for half).
- Below that: your consumables tray (scrollable, tap to use during gameplay).

### Reroll mechanic

A **Reroll** button at the bottom of the Items tab redraws all 3 items. Cost escalates within a single shop visit and resets when you leave the shop:

| Reroll # this shop | Cost |
|---|---|
| 1st | $3 |
| 2nd | $5 |
| 3rd | $8 |
| 4th | $12 |
| 5th+ | $12 (cap) |

Items can change this:
- *Reroll Card* (persistent): first reroll each shop visit is free.
- *Discount Card* (persistent): reroll costs included in the 20% off.

Rerolls only redraw the **Items** tab. Clubs and Stats are not rerolled.

**Clubs tab**
- Your 4 clubs listed with current level (1–4) and upgrade cost.
- Tap a club card → popup shows current stats, what the next level adds, and an **Upgrade** button.
- Greyed if you can't afford the upgrade or the club is already maxed.
- No buying or selling clubs — your bag is permanent. Variety lives in items and stats.

**Stats tab**
- All 6 stats listed with current level and cost to upgrade.
- Tap any stat → confirm popup → upgrade.
- Greyed if you can't afford it.

The whole shop is two taps deep at most. No nested menus, no drag-drop, no attachment flows.

### Item rarity by round (base weights)

| Round | Common | Uncommon | Rare |
|---|---|---|---|
| 1 | 80% | 18% | 2% |
| 2 | 70% | 25% | 5% |
| 3 | 55% | 35% | 10% |
| 4 | 45% | 40% | 15% |
| 5 | 35% | 45% | 20% |
| 6+ | 25% | 50% | 25% |

### Luck modifier

The **Luck** stat shifts these weights toward the rarer end. For each level of Luck above 1, +5% is taken from Common and split between Uncommon and Rare:

| Luck | Shift applied |
|---|---|
| 1 (start) | base weights, no shift |
| 2 | -5% Common → +3% Uncommon, +2% Rare |
| 3 | -10% Common → +6% Uncommon, +4% Rare |
| 4 | -15% Common → +9% Uncommon, +6% Rare |
| 5 (max) | -20% Common → +12% Uncommon, +8% Rare |

*Example:* At Round 3 with Luck 5, weights become 35% Common / 47% Uncommon / 18% Rare. Stacks each reroll, so investing in Luck makes deep-round shops noticeably better.

---

## 13. Hole Design

### Hole templates (the building blocks)

For v1.0 we ship **6 hand-designed templates**, re-skinned across biomes and parameter-tuned by round difficulty.

| Template | Par | Notes |
|---|---|---|
| Wide Open | 3 | Beginner-friendly, single-shot vibe |
| Straight Long | 5 | Driver-heavy, big landing zone |
| Dogleg | 4 | Cut the corner or lay up (mirrored for L/R variety) |
| Island Green | 3 | Long par-3, water all around |
| Narrow Corridor | 4 | Trees both sides, accuracy test |
| Crescent Lake | 4 | Water guards approach |

Each template has parameterized green size, hazard density, distance, wind. Round difficulty dials these.

### Boss holes (hand-built, see § 6)

Bespoke geometry, bespoke logic, bespoke flourish. Treat each like a mini-puzzle.

### Biomes (cosmetic re-skins)

For v1.0, ship **3 biomes**, each just a recoloring + minor prop swap:

- Classic Green (default)
- Desert (sand fairway, cacti instead of trees)
- Tundra (snow, frozen water hazards, low gravity feel)

Biome rotates every 3 rounds. Adding more biomes later is cheap (palette + prop list).

---

## 14. Camera & Controls

### Cameras

| Camera | When | How to invoke |
|---|---|---|
| Follow (3rd person, behind ball) | Default during shot | n/a |
| Pin View | Pre-shot, see destination | "Pin" button HUD |
| Top-Down | Tactical preview, slope check | Tap minimap to expand |
| Free Orbit | Anytime | One-finger drag on the world (not on ball) |

### Mobile controls (portrait orientation)

- **One-finger drag on the world** → orbit camera around ball
- **Drag from ball backward** → enter swing pull-back phase
- **Tap minimap** → expand to full-screen tactical
- **Pinch on minimap** → zoom map
- **Tap club name in HUD** → cycle to next club
- **Long-press club name** → open full bag
- **Two-finger tap** → toggle Pin/Follow camera
- **Bottom-edge swipe up** → open inventory / pause menu

No virtual joysticks. No two-handed gestures required.

### Desktop fallback

Mouse drag = touch drag. Scroll wheel = zoom. Number keys = club select. Space = launch swing.

---

## 15. Art Direction

**Style:** Stylized low-poly. Vertex colors over textures. Crisp silhouettes. Saturated palette. *Crossy Road* terrain × *Mario Golf Super Rush* characters × *Balatro* card UI.

### Why this style

- **Performance.** No texture memory. Tiny draw call budget.
- **Production.** Buildable from Three.js primitives + vertex-color material. No artist needed.
- **Readability.** Strong shapes communicate hazards instantly on a small screen.

### Asset library (built from primitives)

| Asset | Composition |
|---|---|
| Tree | Cylinder trunk + 2-3 cone leaves, vertex-colored |
| Bunker | Flat circle disc, sand-yellow with darker rim |
| Water | Plane with simple animated normal-only shader |
| Cup | Cylinder hole + flag pole + flat triangle flag |
| Ball | Sphere with light dimples |
| Tee marker | Box pair |
| Cloud | 3-4 overlapping spheres, white |
| Bumper (boss) | Cylinder with glow ring |
| Lava | Plane with red-orange gradient + slow noise scroll |

### Lighting

One ambient + one directional sun. **No real-time shadows.** Each object has a baked dark-blob shadow as a flat circle decal.

### UI

Flat 2D overlay. Big tappable buttons (≥48 px). Item cards in Balatro style — colored borders by rarity (white / blue / purple / red for cursed).

---

## 16. UI / UX

### Portrait HUD (in-hole)

```
┌────────────────────────────────┐
│ HOLE 5 · PAR 4 · STROKE 2  $73 │
├────────────────────────────────┤
│                       ┌──────┐ │
│                       │ MAP  │ │
│                       │  •   │ │  ← minimap
│       3D world        │ ↗ 🚩 │ │
│                       └──────┘ │
│                                │
│   [📦 Items]   [🏌 Bag]        │
│                                │
│  Wind: 🡆 8mph   Pin: 142yd    │
│  Club: [5-Iron ▾]              │
└────────────────────────────────┘
```

- **Top bar:** hole, par, stroke, cash. One line, no chrome.
- **Top-right minimap:** always visible, tap to expand fullscreen.
- **Items button:** opens a single scrolling list of all owned items (persistent bag + consumables tray, separated by a divider). Tap any item for full info popup. Consumable popups have a big **Use** button to arm them; persistent popups have a Sell button. Armed consumables show their remaining charges right on the card.
- **Bag button:** opens a single scrolling list of all owned clubs with their stats. Tap any club for full info popup.
- **Club selector (bottom):** tap to cycle to next club. Long-press to jump straight into Bag.
- **Stats panel:** accessed via pause menu — kept off main HUD for portrait cleanliness.

### UX principles (apply everywhere)

1. **One screen, one job.** Items list shows items. Bag shows clubs. Shop sells stuff. Don't combine.
2. **Two taps max.** Anything actionable is reachable within two taps from gameplay.
3. **Tap card → popup → action.** Item details, stats, buy/sell — all surface as a popup over the current screen, never a route to a new page.
4. **No drag-drop.** No item-to-club attachment. No reordering needed. Lists are auto-sorted by recency.
5. **Big tap targets.** ≥48 px. Especially the Sell button (destructive — slight pause + confirm popup) and the Use button on consumables.

### Between-hole flow

1. **Score banner** — animated, "BIRDIE" stamp, big number
2. **Cash payout breakdown** — base + tempo bonuses + streak + interest + boss bonus
3. **Pro Shop screen** (Items / Clubs / Stats tabs)
4. **Continue** → next hole's tee-off cinematic
5. **(If hole 1 or 2) Play / Skip prompt**
6. **Tee-off** → play

### Skip-or-Play prompt (regular holes)

```
┌──────────────────────────────┐
│  HOLE 4 · PAR 4              │
│  Estimated payout: $8–$25    │
│                              │
│   [ PLAY ]   [ SKIP ▸ ]      │
│                              │
│  Skip = draw 1 Skip Tag      │
│  (no shop visit)             │
└──────────────────────────────┘
```

### Pause menu

Resume / View Stats / View Bag / View Items / Restart Run / Settings / Quit.
Settings: SFX vol, music vol, vibration, camera sensitivity, color-blind mode, minimap position.

---

## 17. Audio Direction

**SFX (≤30 clips):**
- Swing whoosh (3 variants by club power)
- Ball contact thwack (4 variants by club type)
- Ball-on-grass roll (looped)
- Ball splash (water) / thud (sand)
- Cup drop "plonk"
- Crowd cheer (birdie+)
- Item activation "ding" (per-item pitch variance)
- Tempo perfect chime / tempo sloppy buzz
- Cash register
- Wind ambience (loop)
- Curse sting (cursed item bought)

**Music:**
- Calm chiptune-y course track (regular holes)
- Energetic boss track
- Pro shop track (light, jazzy)
- Run-end melancholy short cue
- Skip-tag flourish

Defaults: 60% music / 80% sfx, both adjustable.

---

## 18. Mobile Performance Targets

**Hard budgets:**
- 60 FPS sustained on Pixel 5 / iPhone 12 mini
- < 5 MB initial download (gzipped)
- < 200 draw calls/frame
- < 50k tris on screen
- < 30 ms avg frame time
- Cold load to first hole: < 4 seconds on LTE

**Techniques:**
- `InstancedMesh` for trees, rocks, clouds, bumpers
- One material per asset family, vertex colors carry variation
- No real-time shadows; baked blob decals
- Frustum culling default; manual occlusion on boss holes
- Custom ball physics (no engine)
- 30 FPS during shop UI to save battery
- Audio preloaded as a single sprite sheet

---

## 19. Tech Architecture

### Module layout

```
/wackygolf
├── index.html
├── /src
│   ├── main.js
│   ├── /core
│   │   ├── Game.js          # top-level state machine
│   │   ├── Run.js           # run state (cash, items, stats, round#, hole#)
│   │   ├── Save.js          # localStorage IO
│   │   └── Events.js        # tiny pub/sub
│   ├── /scene
│   │   ├── Scene.js
│   │   ├── Camera.js
│   │   ├── Lighting.js
│   │   └── Hole.js          # geometry + hazards
│   ├── /physics
│   │   └── BallPhysics.js
│   ├── /input
│   │   ├── TouchInput.js
│   │   └── SwingController.js
│   ├── /gameplay
│   │   ├── Club.js
│   │   ├── Item.js          # unified item system + triggers
│   │   ├── Stats.js         # player stat object
│   │   ├── Score.js
│   │   └── SkipTag.js
│   ├── /content
│   │   ├── holes/           # hole template JSONs
│   │   ├── items.js         # the unified item pool
│   │   ├── clubs.js
│   │   └── tags.js          # skip tag definitions
│   ├── /ui
│   │   ├── HUD.js
│   │   ├── Minimap.js
│   │   ├── Shop.js
│   │   ├── Bag.js
│   │   ├── PauseMenu.js
│   │   ├── ResultsScreen.js
│   │   └── SkipPrompt.js
│   └── /audio
│       └── Audio.js
└── /assets
    ├── /audio
    └── /textures            # flag, ball
```

### Data shape sketches

```js
// item definition
{
  id: 'lucky_tee',
  name: 'Lucky Tee',
  rarity: 'common',
  category: 'persistent',          // 'consumable' | 'persistent'
  cost: 6,
  description: '+20% power on the first shot of each hole.',
  triggers: { onShotStart: ({shotIndex}) => shotIndex === 0 },
  effect: ({modifiers}) => { modifiers.power *= 1.2; }
}

// club-type-buff item — no attachment needed; effect resolves against bag at shot time
{
  id: 'driver_forge',
  name: 'Driver Forge',
  category: 'persistent',
  cost: 10,
  description: 'All Drivers in your bag get +20% power.',
  triggers: { onShotStart: ({club}) => club.type === 'driver' },
  effect: ({modifiers}) => { modifiers.power *= 1.2; }
}

// run state
{
  round: 2,
  holeInRound: 3,            // 1, 2, or 3 (boss)
  cash: 73,
  par: 4,
  strokeLimit: 7,
  stats: { power:5, accuracy:6, touch:5, luck:1 },
  clubLevels: { driver:1, iron_5:2, wedge:1, putter:3 },   // 1-4 each
  items: ['lucky_tee', 'eagle_eye', 'driver_forge'],        // persistent
  consumables: [                                            // tap-to-arm; armed ones decrement automatically
    { id:'pro_v1s', armed:true,  shotsLeft:2 },             // already armed, 2 shots remaining
    { id:'power_pellet', armed:false, shotsLeft:1 },        // sitting in tray, will arm on tap
    { id:'mulligan_mike', armed:false, shotsLeft:1 }
  ],
  cashFloor: 0,                                             // -25 if Daddy's Credit Card is in bag
  birdieStreak: 1,
  pendingTags: [],
  upcomingRound: {                                          // shown on Round Preview
    holes: [
      { template:'dogleg', par:4, distance:342, wind:{dir:0.7, mph:8} },
      { template:'straight_long', par:5, distance:481, wind:{dir:3.1, mph:12} },
      { template:'lava_cup', par:4, distance:380, isBoss:true, handicap:'no_driver', bossBonus:60 }
    ]
  },
  seed: 0xABCD1234
}
```

### Game loop (high level)

```
update(dt):
  switch(state):
    case PRE_HOLE_PROMPT:  show play/skip prompt (holes 1, 2)
    case AIMING:           camera + aim arrow + minimap landing dot
    case PULLBACK:         power bar
    case TEMPO:            tempo dot
    case BALL_FLY:         physics step, hazards, holed?
    case RESOLVE:          payout, check stroke limit, advance
    case SHOP:              shop UI (items / clubs / stats)
    case SKIP_TAG_DRAW:    show drawn tag, apply effect
  render()
```

---

## 20. MVP Scope (v0.1)

The smallest thing that proves the loop is fun.

- [ ] Three.js scene, single low-poly par-4 hole template
- [ ] Custom ball physics (gravity + drag + surface friction + simple bounce)
- [ ] Drag-back swing with power bar — **no tempo bar yet**
- [ ] Minimap with live landing-zone preview
- [ ] All 4 clubs (Driver, 5-Iron, Wedge, Putter) — fixed bag
- [ ] Cash payout on hole completion
- [ ] **Pro Shop** with 3 tabs:
  - Items tab: 6-item starter pool, with reroll
  - Clubs tab: 4 clubs listed with upgrade buttons (1 → 2 only for v0.1)
  - Stats tab: Power upgradable (only stat for v0.1)
- [ ] Round of 3 holes (regular, regular, boss = "The Windmill")
- [ ] **Round Preview screen** at round start, showing all 3 holes + boss handicap
- [ ] Play/Skip prompt on holes 1 and 2
- [ ] Skip Tag draw — 2 tag types (Cash, Item)
- [ ] Boss handicap implementation: at minimum, "No Driver" working
- [ ] Loss condition: stroke-limit bust
- [ ] Save/resume mid-run via `localStorage`
- [ ] Mobile-friendly portrait touch controls
- [ ] Deployed to **Vercel** with GitHub auto-deploy

**Out of scope for v0.1:** tempo bar, more biomes, audio, animations beyond physics, settings menu, more boss types, full club upgrade range (1→4), full stat tree.

**Timebox guess:** ~2 weeks of evening work.

---

## 21. Post-MVP Roadmap

| Version | Adds |
|---|---|
| v0.2 | Tempo bar, full club set, Wedge + 8-Iron, 3 hole templates |
| v0.3 | Item pool fleshed out (~20 items across both categories) |
| v0.4 | Boss holes 1–3 with unique mechanics |
| v0.5 | All 6 stats wired in, full Stats tab, Stat Tools |
| v0.6 | Club buy/sell, full Skip Tag pool (8 tag types), biome reskin (3 biomes) |
| v0.7 | Audio pass + juice (particles, screen shake, big-text) |
| v0.8 | Save/resume mid-run, settings menu, color-blind mode |
| v1.0 | 30+ items, 6 boss holes, 7 biomes, polish |
| v1.1+ | Daily seeded runs, leaderboard, meta-progression unlocks |

---

## 22. Open Design Questions

1. **Tempo bar speed** — too fast = frustrating on mobile, too slow = trivial. Iterate.
2. **Putting tempo** — keep tempo-free by default, or always require it on bosses?
3. **Bag-size cap** — currently 7. Test if that's too generous.
4. **Skip Tag chain abuse** — skipping both holes 1 & 2 every round = double Tag. Is that overpowered or self-balancing (you miss two shop visits)?
5. **Stat upgrade pacing** — at $5 + N², a level-10 stat costs ≈$340 cumulative. Tune by playtest.
6. **Tag draw timing** — show the tag immediately on skip, or save it as a deck-of-pending-tags that surface at the end of the round?
7. **Persistent meta-progression** — Balatro-style unlocks across runs, or each run identical pool? MVP: identical. Post-1.0: unlocks.
8. **Items with downsides** — Glass Cannon stays as a high-risk persistent item. Should we add more "trade-off" items, or keep all items strictly upside?

---

## 23. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mobile FPS dies on hazard-heavy late rounds | Med | Strict draw-call budget, instancing from day 1 |
| Tempo bar too punishing on small screens | Med | Adjustable tempo speed, "Auto-Tempo" accessibility option |
| Items don't feel impactful enough | Med | Bias toward bigger numbers (+20%, not +5%) |
| Items list grows long, becomes unreadable | Med | Auto-sort by recency, group by category visually, lazy-render in scroll |
| Skip mechanic exploited (skip everything early, snowball Tags) | Low | Test in playtest; if abused, gate Tags to one per round or weight away from cash |
| Endless gets stale at round 10+ | Low | Boss variety + biome rotation + daily seeds |
| Custom physics weird edge cases | High | Build physics test scene early; keep Cannon-es as fallback |
| Stat curve too steep / too shallow | High | Easy lever to tune; not architectural |

---

## 24. Glossary

- **Run** — one playthrough from round 1 until you bust the stroke limit.
- **Round** — 3 holes (two regular, one boss). Mirrors Balatro's blind structure.
- **Hole** — single playable golf hole.
- **Boss Hole** — 3rd hole of every round. Mandatory — cannot be skipped. Pays bonus cash. Has a random handicap.
- **Handicap** — a single rule that bends standard golf for one boss hole (e.g., "No Driver"). Visible on the Round Preview.
- **Skip Tag** — random reward earned from skipping holes 1 or 2.
- **Bust** — exceed stroke limit on a played hole; ends the run.
- **Item** — single unified concept. Two categories: Consumable (one-shot) and Persistent (run-long). Three rarity tiers (Common/Uncommon/Rare). Persistent items can be sold; consumables can't.
- **Club Level** — each of the 4 clubs has a level 1–4. Upgrades cost cash in the Clubs tab.
- **Stat** — one of 4 character attributes (Power / Accuracy / Putting / Luck).
- **Tempo** — timing mini-meter on each swing; perfect = bonus, sloppy = penalty. *Not in v0.1 MVP.*

---

*End of GDD v0.6. This pass: Quick Overview added at the top for fast onboarding; consumables are **tap-to-arm** (save them for clutch moments) but multi-shot effects auto-decrement across their charges once armed; persistent items still auto-fire on their conditions; on-screen feedback whenever any item triggers; items rewritten with golfer-themed names (Daddy's Credit Card, Plaid Pants, Pro V1s, The 19th Hole, Country Club Membership, Trust Fund...); **Daddy's Credit Card** lets you spend down to −$25 in the shop; design rule locked in — simple numeric effects, no edge-case logic; **bosses no longer have bespoke geometry** — they're regular hole templates dressed up with a "boss modifier" (lava bunkers, giant trees, tight greens, slick greens, fog...) plus a random handicap.*
