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

/** Score → cash payout. Mirrors GDD § 8. */
export function computeScore(strokes, par) {
  if (strokes === 1) return { name: 'HOLE IN ONE!', cash: 50, kind: 'ace' };
  const diff = strokes - par;
  if (diff <= -2) return { name: 'EAGLE', cash: 25, kind: 'eagle' };
  if (diff === -1) return { name: 'BIRDIE', cash: 15, kind: 'birdie' };
  if (diff === 0)  return { name: 'PAR', cash: 8, kind: 'par' };
  if (diff === 1)  return { name: 'BOGEY', cash: 3, kind: 'bogey' };
  if (diff === 2)  return { name: 'DOUBLE BOGEY', cash: 0, kind: 'doublebogey' };
  return { name: `+${diff}`, cash: 0, kind: 'over' };
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

    this._listeners = [];
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

    const result = computeScore(this.strokes, this.holeMeta.par);

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
        score: result.cash,
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
    this.startHole(meta);
  }

  // ----- queries -----

  get strokesLeft() { return Math.max(0, this.holeMeta.strokeLimit - this.strokes); }
  get isLastChance() { return this.strokesLeft === 1 && this.status === 'playing'; }
  get isPlayable() { return this.status === 'playing'; }
}
