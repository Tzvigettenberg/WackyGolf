// Confetti — Phase 4q
//
// DOM-based particle shower for celebratory moments (hole-in-one,
// course complete). Creates a fixed-position container once at boot
// and stamps absolute-positioned spans on burst().
//
// Each piece carries its own `--x / --drift / --rot / --size / --color
// / --delay / --duration` CSS variables so the SAME keyframe animation
// drives every variation — keeps the bundle/animation cost tiny while
// still feeling chaotic.
//
// Pieces clean themselves up via a setTimeout after their animation
// finishes, so there's no long-running render cost between bursts.

const CONFETTI_COLORS = [
  '#ffd86b', '#ff5544', '#7fd6ff', '#66e0a3', '#c79cff', '#ffb84a', '#ffffff',
];

export class Confetti {
  constructor() {
    this.layer = document.createElement('div');
    this.layer.id = 'confetti-layer';
    document.body.appendChild(this.layer);
  }

  /**
   * Spit out `count` confetti pieces from the top of the viewport. Pieces
   * fall, drift sideways, and tumble before fading out. Safe to call
   * multiple times — they stack.
   */
  burst({ count = 70 } = {}) {
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const left     = Math.random() * 100;             // vw start
      const drift    = (Math.random() - 0.5) * 60;      // vw lateral travel
      const delay    = Math.random() * 0.25;            // s
      const duration = 1.6 + Math.random() * 1.4;       // s
      const rot      = Math.random() * 720 - 360;       // deg of tumble
      const size     = 6 + Math.random() * 6;           // px
      const color    = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.cssText =
        `--x:${left}vw;` +
        `--drift:${drift}vw;` +
        `--rot:${rot}deg;` +
        `--size:${size}px;` +
        `--color:${color};` +
        `--delay:${delay}s;` +
        `--duration:${duration}s;`;
      this.layer.appendChild(piece);
      setTimeout(() => piece.remove(), (delay + duration) * 1000 + 80);
    }
  }
}
