// CashOut — Phase 4 prep (v2: single-row stroke track)
import { sfx } from '../audio/Sfx.js';
//
// Full-screen overlay shown after holing out. One row of stroke-limit circles:
//   green   = stroke used (within par)
//   red     = stroke used past par
//   gold    = saved stroke (under par bonus)
//   silver  = saved stroke (within leeway)
//
// Breakdown lines spell out where the cash comes from:
//   par credit, under par bonus, strokes-saved bonus, streak, interest, total

const FADE_IN_MS  = 220;
const COUNT_MS    = 380;
const STAGGER_MS  = 380;
const CASH_MS     = 700;
const STROKE_GAP  = 160;
const SAVED_GAP   = 130;

export class CashOut {
  constructor({ onCashOut } = {}) {
    this.onCashOut = onCashOut || null;

    this.modal = document.getElementById('cash-out');
    this.titleEl = this.modal.querySelector('.cashout-title');
    this.scoreEl = this.modal.querySelector('.cashout-score');

    // single-row stroke track
    this.strokeBallsEl = this.modal.querySelector('.stroke-balls');
    this.strokesCountEl = this.modal.querySelector('.strokes-count');

    // breakdown lines
    this.parLine    = this.modal.querySelector('.line-par');
    this.parValEl   = this.modal.querySelector('.line-par .cash');
    this.underLine  = this.modal.querySelector('.line-under');
    this.underValEl = this.modal.querySelector('.line-under .cash');
    this.underCountEl = this.modal.querySelector('.line-under .count');
    this.leewayLine = this.modal.querySelector('.line-leeway');
    this.leewayValEl = this.modal.querySelector('.line-leeway .cash');
    this.leewayCountEl = this.modal.querySelector('.line-leeway .count');

    this.streakLine = this.modal.querySelector('.line-streak');
    this.streakValEl = this.modal.querySelector('.line-streak .cash');
    this.streakCountEl = this.modal.querySelector('.line-streak .count');
    this.hustlerLine = this.modal.querySelector('.line-hustler');
    this.hustlerValEl = this.modal.querySelector('.line-hustler .cash');
    this.hustlerCountEl = this.modal.querySelector('.line-hustler .count');
    this.goldenLine = this.modal.querySelector('.line-golden');
    this.goldenValEl = this.modal.querySelector('.line-golden .cash');
    this.interestLine = this.modal.querySelector('.line-interest');
    this.interestValEl = this.modal.querySelector('.line-interest .cash');

    this.totalEl = this.modal.querySelector('.cashout-total .cash');
    this.cashFromEl = this.modal.querySelector('.cashout-cash .from');
    this.cashToEl = this.modal.querySelector('.cashout-cash .to');

    this.btn = this.modal.querySelector('.cashout-btn');
    this.btn.addEventListener('click', () => {
      sfx.cashGain();
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

    // Reset breakdown text
    this.parValEl.textContent    = '+$0';
    this.underValEl.textContent  = '+$0';
    this.leewayValEl.textContent = '+$0';
    this.streakValEl.textContent = '+$0';
    this.hustlerValEl.textContent = '+$0';
    this.goldenValEl.textContent = '+$0';
    this.interestValEl.textContent = '+$0';
    this.totalEl.textContent     = '+$0';
    this.cashFromEl.textContent  = `$${cashBefore}`;
    this.cashToEl.textContent    = `$${cashBefore}`;

    // Show/hide breakdown lines based on what applies
    const showPar     = breakdown.parCredit > 0;
    const showUnder   = breakdown.underPar > 0;
    const showLeeway  = breakdown.leeway > 0;
    const showStreak  = breakdown.streak > 0;
    const showHustler = (breakdown.hustler || 0) > 0;
    const showGolden  = (breakdown.golden || 0) > 0;
    const showInterest = breakdown.interest > 0;
    this.parLine.style.display    = showPar ? '' : 'none';
    this.underLine.style.display  = showUnder ? '' : 'none';
    this.leewayLine.style.display = showLeeway ? '' : 'none';
    this.streakLine.style.display = showStreak ? '' : 'none';
    this.hustlerLine.style.display = showHustler ? '' : 'none';
    this.goldenLine.style.display = showGolden ? '' : 'none';
    this.interestLine.style.display = showInterest ? '' : 'none';
    if (showUnder)  this.underCountEl.textContent  = `(×${score.underParCircles})`;
    if (showLeeway) this.leewayCountEl.textContent = `(×${score.leewaySaved})`;
    if (showStreak) this.streakCountEl.textContent = `×${streakCount}`;
    if (showHustler) this.hustlerCountEl.textContent = `(×${score.underParCircles})`;

    this.btn.disabled = true;
    this.btn.classList.remove('ready');

    // Render balls + counter text
    this._renderBalls(score.strokes, score.par, score.strokeLimit);
    this.strokesCountEl.textContent = `${score.strokes}/${score.strokeLimit}`;

    this.modal.classList.add('shown');
    document.body.classList.add('cashout-active');

    // ----- Animate in sequence -----
    let delay = FADE_IN_MS;
    delay = this._animateBalls(score, delay);

    // par credit
    delay += 80;
    if (showPar) {
      this._countUp(this.parValEl, 0, breakdown.parCredit, delay);
      delay += STAGGER_MS;
    }
    // under-par bonus
    if (showUnder) {
      this._countUp(this.underValEl, 0, breakdown.underPar, delay);
      delay += STAGGER_MS;
    }
    // leeway-saved bonus
    if (showLeeway) {
      this._countUp(this.leewayValEl, 0, breakdown.leeway, delay);
      delay += STAGGER_MS;
    }
    // streak
    if (showStreak) {
      this._countUp(this.streakValEl, 0, breakdown.streak, delay);
      delay += STAGGER_MS;
    }
    // hole hustler
    if (showHustler) {
      this._countUp(this.hustlerValEl, 0, breakdown.hustler, delay);
      delay += STAGGER_MS;
    }
    // golden ball (equipment bonus)
    if (showGolden) {
      this._countUp(this.goldenValEl, 0, breakdown.golden, delay);
      delay += STAGGER_MS;
    }
    // interest
    if (showInterest) {
      this._countUp(this.interestValEl, 0, breakdown.interest, delay);
      delay += STAGGER_MS;
    }

    // total
    delay += 100;
    this._countUp(this.totalEl, 0, breakdown.total, delay);
    delay += COUNT_MS;

    // cash counter
    this._timers.push(setTimeout(() => {
      this._countCash(this.cashToEl, cashBefore, cashAfter, CASH_MS);
    }, delay));
    delay += CASH_MS + 200;

    // enable button + single celebratory chime when everything settles
    this._timers.push(setTimeout(() => {
      this.btn.disabled = false;
      this.btn.classList.add('ready');
      if (cashAfter > cashBefore) sfx.cashGain();
    }, delay));
  }

  hide() {
    this.modal.classList.remove('shown');
    document.body.classList.remove('cashout-active');
    this._cancelAll();
  }

  // ----- internals -----

  _renderBalls(strokes, par, strokeLimit) {
    this.strokeBallsEl.innerHTML = '';
    // Total slots = strokeLimit OR strokes if they busted past it (defensive).
    const total = Math.max(strokeLimit, strokes);
    for (let i = 0; i < total; i++) {
      const b = document.createElement('span');
      b.className = 'ball';
      // visual divider after the par-th ball
      if (i === par - 1) b.classList.add('par-edge');
      this.strokeBallsEl.appendChild(b);
    }
  }

  _animateBalls(score, startDelay) {
    let delay = startDelay;
    const balls = Array.from(this.strokeBallsEl.querySelectorAll('.ball'));
    const { strokes, par, strokeLimit } = score;

    // Phase 1: fill in strokes one by one (green, or red if past par).
    // No per-ball SFX — sounds on this screen are reserved for actual cash
    // count-ups (see _countUp / _animate). The ball animation is purely visual.
    let count = 0;
    for (let i = 0; i < Math.min(strokes, balls.length); i++) {
      const isOver = i >= par;
      this._timers.push(setTimeout(() => {
        balls[i].classList.add(isOver ? 'over' : 'used');
        count += 1;
        this.strokesCountEl.textContent = `${count}/${strokeLimit}`;
      }, delay));
      delay += STROKE_GAP;
    }

    // Pause, then start awarding savings
    delay += 220;

    // Phase 2: glow saved-under-par circles (positions strokes..par-1).
    for (let i = strokes; i < par; i++) {
      this._timers.push(setTimeout(() => {
        balls[i].classList.add('saved-par');
      }, delay));
      delay += SAVED_GAP + 30;
    }

    // Phase 3: glow saved-leeway circles (positions max(strokes,par)..limit-1).
    for (let i = Math.max(strokes, par); i < strokeLimit; i++) {
      this._timers.push(setTimeout(() => {
        balls[i].classList.add('saved-leeway');
      }, delay));
      delay += SAVED_GAP - 20;
    }

    return delay + 80;
  }

  _countUp(el, from, to, delayMs) {
    this._timers.push(setTimeout(() => {
      this._animate(el, from, to, COUNT_MS, (v) => `+$${v}`);
    }, delayMs));
  }

  _countCash(el, from, to, durationMs) {
    this._animate(el, from, to, durationMs, (v) => `$${v}`);
  }

  // One short coin tick per $ change in the displayed value. Caps at
  // MAX_TICKS_PER_FRAME so a fast $50 climb doesn't smear into a single
  // distorted block of audio — extra dollars are absorbed silently rather
  // than fired as overlapping ticks.
  _animate(el, from, to, durationMs, fmt) {
    const start = performance.now();
    let lastValue = from;
    const isCounting = to !== from;
    const MAX_TICKS_PER_FRAME = 3;
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = Math.round(from + (to - from) * eased);
      el.textContent = fmt(value);
      if (isCounting && value !== lastValue) {
        const ticks = Math.min(MAX_TICKS_PER_FRAME, Math.abs(value - lastValue));
        for (let i = 0; i < ticks; i++) sfx.cashTick();
        lastValue = value;
      }
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
}
