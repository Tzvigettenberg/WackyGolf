// Run — Phase 3
//
// Owns the player's progression through a run: which hole they're on,
// strokes used on the current hole, cash, status. The host (main.js)
// drives this with shot-fired / holed / came-to-rest events.

const STARTING_CASH = 5;
const DEFAULT_PAR = 4;
const DEFAULT_LEEWAY = 4;   // stroke limit = par + leeway

// Bag size — items take a slot each, duplicates take separate slots (Balatro
// jokers). Limited slots force the player to choose what to keep.
export const STARTING_BAG_SLOTS = 5;

// Reroll cost in the shop, flat per click.
export const REROLL_COST = 3;

/**
 * Score → cash payout. Money is hard to come by without a money-earning
 * build (Trust Fund, Sandbagger, etc.) — par alone pays nothing, you only
 * earn from going UNDER par or from items.
 *
 *   parCredit   — completion bonus ($0; reserved for future modifiers)
 *   underParCash — cumulative payout for each under-par circle ($3, $5, $8, ...)
 *   leewayCash   — $0 in v1 (kept in the data shape for the cash-out visual,
 *                  may return as a difficulty modifier later)
 */
const PER_BALL_UNDER = [4, 6, 9, 13, 18]; // 1st, 2nd, 3rd, ... under par
const PER_LEEWAY = 0;
const PAR_CREDIT = 1;     // small token for finishing — survival pays a buck
const BOGEY_CREDIT = 0;

export function computeScore(strokes, par, strokeLimit) {
  const limit = strokeLimit || (par + DEFAULT_LEEWAY);
  const overBy = strokes - par;
  const underBy = -overBy;

  let name, kind;
  if (strokes === 1)        { name = 'HOLE IN ONE!';   kind = 'ace'; }
  else if (underBy >= 3)    { name = 'ALBATROSS';       kind = 'eagle'; }
  else if (underBy === 2)   { name = 'EAGLE';           kind = 'eagle'; }
  else if (underBy === 1)   { name = 'BIRDIE';          kind = 'birdie'; }
  else if (underBy === 0)   { name = 'PAR';             kind = 'par'; }
  else if (overBy === 1)    { name = 'BOGEY';           kind = 'bogey'; }
  else if (overBy === 2)    { name = 'DOUBLE BOGEY';    kind = 'doublebogey'; }
  else                      { name = `+${overBy}`;      kind = 'over'; }

  // 1) par credit — flat bonus for finishing
  let parCredit = 0;
  if (underBy >= 0) parCredit = PAR_CREDIT;
  else if (overBy === 1) parCredit = BOGEY_CREDIT;

  // 2) under-par balls — cumulative
  const underParCircles = Math.max(0, underBy);
  let underParCash = 0;
  for (let i = 0; i < underParCircles; i++) {
    underParCash += PER_BALL_UNDER[Math.min(i, PER_BALL_UNDER.length - 1)];
  }

  // 3) leeway saved — flat $2 per stroke saved past par/strokes
  const leewaySaved = Math.max(0, limit - Math.max(strokes, par));
  const leewayCash = leewaySaved * PER_LEEWAY;

  const cash = parCredit + underParCash + leewayCash;

  return {
    name, kind, cash, strokes, par,
    strokeLimit: limit,
    underBy, overBy,
    underParCircles, leewaySaved,
    parCredit, underParCash, leewayCash,
  };
}

export class Run {
  constructor() {
    this.cash = STARTING_CASH;
    this.holeNumber = 1;
    this.strokes = 0;
    this.holeMeta = { par: DEFAULT_PAR, strokeLimit: DEFAULT_PAR + DEFAULT_LEEWAY };
    this.status = 'playing'; // 'playing' | 'holed' | 'busted' | 'completed'
    this.lastResult = null;
    // Consecutive birdies/eagles/aces. Resets on bogey or worse. Drives the
    // streak bonus shown on the cash-out screen.
    this.birdieStreak = 0;
    // Items the player has bought during this run. One slot per instance —
    // duplicates take separate slots (Balatro joker model). Each slot can be
    // sold back from the shop independently.
    this.items = [];
    this.bagSlots = STARTING_BAG_SLOTS;
    // Equipment slot — currently just one: the ball. Stores an item id or null.
    this.ball = null;
    // Golf score: sum of (strokes - par) over holes that actually contributed
    // — i.e., were holed-out or busted. Skipped holes don't count. Lower = better.
    this.totalScore = 0;
    this.holesPlayed = 0;
    // Weather Vane: once-per-hole rotate. Reset on startHole().
    this.weatherVaneUsed = false;

    this._listeners = [];
  }

  // ---- items ----

  /** True if owned anywhere — bag slot OR equipment (currently just ball). */
  hasItem(id)    { return this.items.includes(id) || this.ball === id; }
  /** Total copies owned across bag + equipment. Equipment slots are 0 or 1. */
  itemCount(id)  {
    return this.items.filter((x) => x === id).length + (this.ball === id ? 1 : 0);
  }

  // ---- equipment: ball slot ----

  /** Equip a ball; returns the previous ball id (so caller can refund). */
  equipBall(id) {
    const prev = this.ball;
    this.ball = id;
    this._emit();
    return prev;
  }
  unequipBall() {
    const prev = this.ball;
    this.ball = null;
    this._emit();
    return prev;
  }

  /** True if at least one slot is free for a new purchase. */
  get hasFreeSlot() { return this.items.length < this.bagSlots; }
  get freeSlots()   { return Math.max(0, this.bagSlots - this.items.length); }

  /** Try to add an item. Returns false if the bag is full. */
  addItem(id) {
    if (!this.hasFreeSlot) return false;
    this.items.push(id);
    this._emit();
    return true;
  }

  /** Remove the item at slotIndex. Used by the shop's sell button. */
  removeAt(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.items.length) return null;
    const [id] = this.items.splice(slotIndex, 1);
    this._emit();
    return id;
  }

  /** Cash returned when selling a single instance — half of base cost. */
  sellValue(baseCost) {
    return Math.max(1, Math.floor(baseCost / 2));
  }

  /** Discount the input cost by any active shop-discount items. */
  effectiveCost(baseCost) {
    const discount = this.hasItem('country-club-card') ? 0.8 : 1.0;
    return Math.max(0, Math.ceil(baseCost * discount));
  }


  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((f) => f !== fn); };
  }
  _emit() { for (const fn of this._listeners) fn(this); }

  // ----- input from gameplay -----

  /** Player just released a swing — increment stroke counter. */
  onShot() {
    if (this.status !== 'playing') return;
    this.strokes += 1;
    this._emit();
  }

  /**
   * Ball went in the cup. Returns the score result + breakdown for the
   * cash-out screen, and applies the totals to run.cash.
   */
  onHoled() {
    if (this.status !== 'playing') return null;
    this.status = 'holed';

    const result = computeScore(this.strokes, this.holeMeta.par, this.holeMeta.strokeLimit);

    // Boss holes (3, 6, 9) pay double on the score-based portion.
    const bossMult = this.holeMeta.isBoss ? 2 : 1;
    if (bossMult !== 1) {
      result.parCredit   *= bossMult;
      result.underParCash *= bossMult;
      result.leewayCash  *= bossMult;
      result.cash         = result.parCredit + result.underParCash + result.leewayCash;
    }

    // streak: +$1 per consecutive birdie/eagle/ace, resets on par-or-worse
    const isBirdieOrBetter = result.kind === 'birdie' || result.kind === 'eagle' || result.kind === 'ace';
    if (isBirdieOrBetter) this.birdieStreak += 1;
    else                  this.birdieStreak = 0;
    const streakCash = isBirdieOrBetter ? this.birdieStreak * 1 : 0;

    // Hole Hustler — +$1 per under-par stroke (per copy). Quiet, additive
    // synergy with under-par builds.
    const hustlerCash = result.underParCircles * this.itemCount('hole-hustler');

    // Golden Ball (equipment) — flat bonus on every sink.
    const goldenCash = this.ball === 'golden-ball' ? 3 : 0;

    // interest: $1 per $5 on the post-payout balance, capped at $2
    // (or $4 with the Compound Interest item)
    const interestCap = this.hasItem('compound-interest') ? 4 : 2;
    const provisional = this.cash + result.cash + streakCash + hustlerCash + goldenCash;
    const interestCash = Math.min(interestCap, Math.floor(provisional / 5));

    const total = result.cash + streakCash + interestCash + hustlerCash + goldenCash;
    const cashBefore = this.cash;
    this.cash += total;

    // Accumulate golf score (strokes - par; under is negative, over positive).
    this.totalScore += result.overBy;
    this.holesPlayed += 1;

    this.lastResult = {
      ...result,
      breakdown: {
        parCredit: result.parCredit,
        underPar: result.underParCash,
        leeway: result.leewayCash,
        streak: streakCash,
        hustler: hustlerCash,
        golden: goldenCash,
        interest: interestCash,
        total,
      },
      cashBefore,
      cashAfter: this.cash,
      streakCount: this.birdieStreak,
    };
    this._emit();
    return this.lastResult;
  }

  /** Ball stopped without going in. Returns true if the run is now busted. */
  checkBustOnRest() {
    if (this.status !== 'playing') return false;
    if (this.strokes >= this.holeMeta.strokeLimit) {
      this.status = 'busted';
      this.lastResult = null;
      // Bust counts toward the score: strokeLimit - par for the failed hole.
      this.totalScore += (this.holeMeta.strokeLimit - this.holeMeta.par);
      this.holesPlayed += 1;
      this._emit();
      return true;
    }
    return false;
  }

  /**
   * Begin the current hole with given meta. Resets strokes/status/lastResult
   * and applies hole-start payouts (Trust Fund). Pass `applyPayouts: false`
   * when restoring from a save — the Trust Fund cash already lives in the
   * snapshot, so re-paying would double-dip.
   */
  startHole(meta, { applyPayouts = true } = {}) {
    this.holeMeta = meta || this.holeMeta;
    this.strokes = 0;
    this.status = 'playing';
    this.lastResult = null;
    // Per-hole flags reset on every hole start.
    this.weatherVaneUsed = false;
    if (applyPayouts && this.hasItem('trust-fund')) {
      this.cash += 2 * this.itemCount('trust-fund');
    }
    this._emit();
  }

  /** Move on to the next hole. Pass meta from the new template. */
  nextHole(meta) {
    this.holeNumber += 1;
    this.startHole(meta);
  }

  /**
   * Bank skip-bonus cash. Does NOT advance holeNumber — the host (preview
   * UI) tracks the target hole separately and only commits run.holeNumber
   * when the player actually presses Play.
   */
  bankSkipCash(cashGained) {
    this.cash += cashGained;
    this._emit();
  }

  /** Start a fresh run. Pass meta from the first template. */
  resetRun(meta) {
    this.cash = STARTING_CASH;
    this.holeNumber = 1;
    this.birdieStreak = 0;
    this.items = [];
    this.bagSlots = STARTING_BAG_SLOTS;
    this.ball = null;
    this.totalScore = 0;
    this.holesPlayed = 0;
    this.startHole(meta);
  }

  // ----- queries -----

  get strokesLeft() { return Math.max(0, this.holeMeta.strokeLimit - this.strokes); }
  get isLastChance() { return this.strokesLeft === 1 && this.status === 'playing'; }
  get isPlayable() { return this.status === 'playing'; }
}
