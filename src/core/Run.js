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

  /** Ball went in the cup. Returns the score result for display. */
  onHoled() {
    if (this.status !== 'playing') return null;
    this.status = 'holed';
    const result = computeScore(this.strokes, this.holeMeta.par);
    this.cash += result.cash;
    this.lastResult = result;
    this._emit();
    return result;
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

  /** Move on to the next hole — same template for now. */
  nextHole() {
    this.holeNumber += 1;
    this.strokes = 0;
    this.holeMeta = { par: DEFAULT_PAR, strokeLimit: DEFAULT_PAR + DEFAULT_LEEWAY };
    this.status = 'playing';
    this.lastResult = null;
    this._emit();
  }

  /** Start a fresh run. */
  resetRun() {
    this.cash = STARTING_CASH;
    this.holeNumber = 1;
    this.strokes = 0;
    this.holeMeta = { par: DEFAULT_PAR, strokeLimit: DEFAULT_PAR + DEFAULT_LEEWAY };
    this.status = 'playing';
    this.lastResult = null;
    this._emit();
  }

  // ----- queries -----

  get strokesLeft() { return Math.max(0, this.holeMeta.strokeLimit - this.strokes); }
  get isLastChance() { return this.strokesLeft === 1 && this.status === 'playing'; }
  get isPlayable() { return this.status === 'playing'; }
}
