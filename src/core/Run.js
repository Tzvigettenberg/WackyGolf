// Run — Phase 3
//
// Owns the player's progression through a run: which hole they're on,
// strokes used on the current hole, cash, status. The host (main.js)
// drives this with shot-fired / holed / came-to-rest events.
//
// For this first cut every hole is the same template (par 4, stroke limit 8).
// Multiple hole layouts and round structure come in the next chunk.

const STARTING_CASH = 8;
const DEFAULT_PAR = 4;
const DEFAULT_LEEWAY = 4;   // stroke limit = par + leeway

/**
 * Score → cash payout, broken into three buckets so the cash-out screen
 * can count them up visually:
 *
 *   parCredit   — flat bonus for completing the hole (par-or-better $5, bogey $2)
 *   underParCash — cumulative payout for each under-par circle ($10, $15, $25, ...)
 *   leewayCash   — flat $5 per stroke saved against the stroke limit
 *
 * Returns enough metadata for the visual:
 *   strokes, par, strokeLimit, underBy, overBy, underParCircles, leewaySaved
 */
const PER_BALL_UNDER = [10, 15, 25, 40, 60]; // 1st, 2nd, 3rd, ... under par
const PER_LEEWAY = 5;
const PAR_CREDIT = 5;
const BOGEY_CREDIT = 2;

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

  // 3) leeway saved — flat $5 per stroke saved past par/strokes
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
    this.status = 'playing'; // 'playing' | 'holed' | 'busted'
    this.lastResult = null;
    // Consecutive birdies/eagles/aces. Resets on bogey or worse. Drives the
    // streak bonus shown on the cash-out screen.
    this.birdieStreak = 0;
    // Player stat levels. Power is wired into swing speed; Accuracy/Touch/Luck
    // are placeholders for upcoming systems (tempo bar, shop rarity bias).
    this.stats = {
      power: 5, accuracy: 5, touch: 5, luck: 1,
    };

    this._listeners = [];
  }

  // ---- stat upgrades ----

  /** Cost to bump `name` from level N to N+1 — `$5 + N²` per the GDD. */
  statUpgradeCost(name) {
    const lvl = this.stats[name] ?? 1;
    return 5 + lvl * lvl;
  }
  statMax(name) {
    return name === 'luck' ? 5 : 10;
  }
  canUpgrade(name) {
    return this.stats[name] !== undefined && this.stats[name] < this.statMax(name);
  }
  /** Returns true on success, false if the player can't afford or stat is maxed. */
  upgradeStat(name) {
    if (!this.canUpgrade(name)) return false;
    const cost = this.statUpgradeCost(name);
    if (this.cash < cost) return false;
    this.cash -= cost;
    this.stats[name] = (this.stats[name] ?? 1) + 1;
    this._emit();
    return true;
  }

  /** +5% distance per level above 1 — wired into SwingController. */
  get powerMultiplier() {
    return 1 + 0.05 * Math.max(0, (this.stats.power || 1) - 1);
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

    // streak: +$2 per consecutive birdie/eagle/ace, resets on par-or-worse
    const isBirdieOrBetter = result.kind === 'birdie' || result.kind === 'eagle' || result.kind === 'ace';
    if (isBirdieOrBetter) this.birdieStreak += 1;
    else                  this.birdieStreak = 0;
    const streakCash = isBirdieOrBetter ? this.birdieStreak * 2 : 0;

    // interest: $1 per $5 on the post-payout balance, capped at $5
    const provisional = this.cash + result.cash + streakCash;
    const interestCash = Math.min(5, Math.floor(provisional / 5));

    const total = result.cash + streakCash + interestCash;
    const cashBefore = this.cash;
    this.cash += total;

    this.lastResult = {
      ...result,
      breakdown: {
        parCredit: result.parCredit,
        underPar: result.underParCash,
        leeway: result.leewayCash,
        streak: streakCash,
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
      this._emit();
      return true;
    }
    return false;
  }

  /** Begin the current hole with given meta — resets strokes, status, last result. */
  startHole(meta) {
    this.holeMeta = meta || this.holeMeta;
    this.strokes = 0;
    this.status = 'playing';
    this.lastResult = null;
    this._emit();
  }

  /** Move on to the next hole. Pass meta from the new template. */
  nextHole(meta) {
    this.holeNumber += 1;
    this.startHole(meta);
  }

  /** Start a fresh run. Pass meta from the first template. */
  resetRun(meta) {
    this.cash = STARTING_CASH;
    this.holeNumber = 1;
    this.birdieStreak = 0;
    this.stats = { power: 5, accuracy: 5, touch: 5, luck: 1 };
    this.startHole(meta);
  }

  // ----- queries -----

  get strokesLeft() { return Math.max(0, this.holeMeta.strokeLimit - this.strokes); }
  get isLastChance() { return this.strokesLeft === 1 && this.status === 'playing'; }
  get isPlayable() { return this.status === 'playing'; }
}
