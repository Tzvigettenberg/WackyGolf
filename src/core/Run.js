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
 * Score → cash payout. The cash is built up per under-par stroke so the
 * cash-out screen can count up "balls" with each one paying more than the
 * last. Returns strokes/par/underBy so the screen can render the visual.
 */
const PER_BALL_UNDER = [10, 15, 25, 40, 60]; // 1st, 2nd, 3rd, ... under par
const PAR_CASH = 5;
const BOGEY_CASH = 2;

export function computeScore(strokes, par) {
  const overBy = strokes - par;        // positive = over par
  const underBy = -overBy;             // positive = under par

  let name, kind;
  if (strokes === 1)        { name = 'HOLE IN ONE!';   kind = 'ace'; }
  else if (underBy >= 3)    { name = 'ALBATROSS';       kind = 'eagle'; }
  else if (underBy === 2)   { name = 'EAGLE';           kind = 'eagle'; }
  else if (underBy === 1)   { name = 'BIRDIE';          kind = 'birdie'; }
  else if (underBy === 0)   { name = 'PAR';             kind = 'par'; }
  else if (overBy === 1)    { name = 'BOGEY';           kind = 'bogey'; }
  else if (overBy === 2)    { name = 'DOUBLE BOGEY';    kind = 'doublebogey'; }
  else                      { name = `+${overBy}`;      kind = 'over'; }

  let cash = 0;
  if (underBy > 0) {
    cash = PAR_CASH; // base for completing the hole
    for (let i = 0; i < underBy; i++) {
      cash += PER_BALL_UNDER[Math.min(i, PER_BALL_UNDER.length - 1)];
    }
  } else if (underBy === 0) {
    cash = PAR_CASH;
  } else if (overBy === 1) {
    cash = BOGEY_CASH;
  }

  return { name, cash, kind, strokes, par, underBy, overBy };
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
