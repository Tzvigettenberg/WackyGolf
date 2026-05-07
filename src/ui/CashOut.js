// CashOut — Phase 4 prep
//
// Full-screen "you sunk the hole, here's your money" overlay. Counts up
// each line item satisfyingly (base + streak + interest), totals them, then
// animates the cash counter from old → new. Player taps Cash Out to advance.
// Later this hooks into the Pro Shop instead of going straight to the next hole.

const FADE_IN_MS  = 220;
const COUNT_MS    = 380;
const STAGGER_MS  = 380;
const CASH_MS     = 700;

export class CashOut {
  constructor({ onCashOut } = {}) {
    this.onCashOut = onCashOut || null;

    this.modal = document.getElementById('cash-out');
    this.titleEl = this.modal.querySelector('.cashout-title');
    this.scoreEl = this.modal.querySelector('.cashout-score');

    // strokes vs par ball track
    this.strokesBallsEl = this.modal.querySelector('.strokes-balls');
    this.parBallsEl = this.modal.querySelector('.par-balls');
    this.strokesCountEl = this.modal.querySelector('.strokes-count');
    this.parCountEl = this.modal.querySelector('.par-row .track-count');

    this.scoreLine = this.modal.querySelector('.line-score');
    this.scoreLineLabel = this.modal.querySelector('.line-score .label');
    this.scoreValEl = this.modal.querySelector('.line-score .cash');
    this.streakLine = this.modal.querySelector('.line-streak');
    this.streakValEl = this.modal.querySelector('.line-streak .cash');
    this.streakCountEl = this.modal.querySelector('.line-streak .count');
    this.interestLine = this.modal.querySelector('.line-interest');
    this.interestValEl = this.modal.querySelector('.line-interest .cash');

    this.totalEl = this.modal.querySelector('.cashout-total .cash');
    this.cashFromEl = this.modal.querySelector('.cashout-cash .from');
    this.cashToEl = this.modal.querySelector('.cashout-cash .to');

    this.btn = this.modal.querySelector('.cashout-btn');
    this.btn.addEventListener('click', () => {
      if (this.onCashOut) this.onCashOut();
    });

    this._timers = [];
    this._rafs = [];
  }

  show({ holeName, par, score, breakdown, cashBefore, cashAfter, streakCount }) {
    this._cancelAll();

    this.titleEl.textContent = `${holeName.toUpperCase()} · PAR ${par}`;
    this.scoreEl.textContent = score.name;
    this.scoreEl.className = 'cashout-score ' + (score.kind || '');

    // Score line label: e.g., "BIRDIE −1", "PAR", "BOGEY +1"
    this.scoreLineLabel.textContent = formatScoreLabel(score);

    this.btn.disabled = true;
    this.btn.classList.remove('ready');

    // Reset displayed numbers
    this.scoreValEl.textContent = '+$0';
    this.streakValEl.textContent = '+$0';
    this.interestValEl.textContent = '+$0';
    this.totalEl.textContent = '+$0';
    this.cashFromEl.textContent = `$${cashBefore}`;
    this.cashToEl.textContent = `$${cashBefore}`;

    // Render strokes vs par balls
    this._renderBalls(score.strokes, score.par);

    // Streak line only visible when there's a streak bonus to show
    const showStreak = breakdown.streak > 0;
    this.streakLine.style.display = showStreak ? '' : 'none';
    if (showStreak) {
      this.streakCountEl.textContent = `×${streakCount}`;
    }

    // Interest line only visible when interest is non-zero
    const showInterest = breakdown.interest > 0;
    this.interestLine.style.display = showInterest ? '' : 'none';

    this.modal.classList.add('shown');

    // ----- animate -----
    let delay = FADE_IN_MS;

    // Strokes balls fade in one by one, with the count incrementing.
    delay = this._animateBalls(score.strokes, score.par, delay);

    this._countUp(this.scoreValEl, 0, breakdown.score, delay);
    delay += STAGGER_MS;

    if (showStreak) {
      this._countUp(this.streakValEl, 0, breakdown.streak, delay);
      delay += STAGGER_MS;
    }
    if (showInterest) {
      this._countUp(this.interestValEl, 0, breakdown.interest, delay);
      delay += STAGGER_MS;
    }

    delay += 100;
    this._countUp(this.totalEl, 0, breakdown.total, delay);
    delay += COUNT_MS;

    this._timers.push(setTimeout(() => {
      this._countCash(this.cashToEl, cashBefore, cashAfter, CASH_MS);
    }, delay));
    delay += CASH_MS + 200;

    this._timers.push(setTimeout(() => {
      this.btn.disabled = false;
      this.btn.classList.add('ready');
    }, delay));
  }

  hide() {
    this.modal.classList.remove('shown');
    this._cancelAll();
  }

  // ----- internals -----

  _countUp(el, from, to, delayMs) {
    this._timers.push(setTimeout(() => {
      this._animate(el, from, to, COUNT_MS, (v) => `+$${v}`);
    }, delayMs));
  }

  _countCash(el, from, to, durationMs) {
    this._animate(el, from, to, durationMs, (v) => `$${v}`);
  }

  _animate(el, from, to, durationMs, fmt) {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = Math.round(from + (to - from) * eased);
      el.textContent = fmt(value);
      if (t < 1) {
        const id = requestAnimationFrame(step);
        this._rafs.push(id);
      }
    };
    const id = requestAnimationFrame(step);
    this._rafs.push(id);
  }

  _cancelAll() {
    for (const id of this._timers) clearTimeout(id);
    for (const id of this._rafs)   cancelAnimationFrame(id);
    this._timers = [];
    this._rafs = [];
  }

  _renderBalls(strokes, par) {
    // Build N stroke balls + M par balls, all hidden initially.
    this.strokesBallsEl.innerHTML = '';
    this.parBallsEl.innerHTML = '';
    this.strokesCountEl.textContent = '0';
    if (this.parCountEl) this.parCountEl.textContent = `${par}`;

    for (let i = 0; i < strokes; i++) {
      const b = document.createElement('span');
      b.className = 'ball' + (i >= par ? ' over' : '');
      this.strokesBallsEl.appendChild(b);
    }
    for (let i = 0; i < par; i++) {
      const b = document.createElement('span');
      b.className = 'ball';
      this.parBallsEl.appendChild(b);
    }
  }

  /** Fade balls in sequentially. Returns the delay (ms) at which the
   *  last ball animation finishes. */
  _animateBalls(strokes, par, startDelay) {
    let delay = startDelay;
    const STROKE_GAP = 160;
    const PAR_GAP = 60;

    // Strokes — pop in one by one, count ticks up
    const strokeBalls = this.strokesBallsEl.querySelectorAll('.ball');
    let count = 0;
    for (const b of strokeBalls) {
      this._timers.push(setTimeout(() => {
        b.classList.add('appeared');
        count += 1;
        this.strokesCountEl.textContent = `${count}`;
      }, delay));
      delay += STROKE_GAP;
    }

    // Small gap, then par balls fade in (faster, less drama)
    delay += 120;
    const parBalls = this.parBallsEl.querySelectorAll('.ball');
    for (const b of parBalls) {
      this._timers.push(setTimeout(() => b.classList.add('appeared'), delay));
      delay += PAR_GAP;
    }

    return delay + 120;
  }
}

function formatScoreLabel(score) {
  if (score.kind === 'ace') return score.name;
  if (score.underBy > 0) return `${score.name} −${score.underBy}`;
  if (score.underBy === 0) return score.name;
  return `${score.name} +${score.overBy}`;
}
