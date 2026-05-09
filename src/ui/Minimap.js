// Top-down hole minimap — Phase 3.2
//
// Canvas2D, ~144 px square, top-right corner. Shows the current hole's
// rough/fairway/green/cup, the live ball position, and the predicted
// trajectory (dotted) + landing rest (cyan ring) during aim.
//
// Hole layout is hot-swappable via setLayout() so we can change holes
// mid-run.

const SIZE = 144;
const PAD = 6;

export class Minimap {
  constructor(layout) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 12px);
      right: 12px;
      width: ${SIZE}px;
      height: ${SIZE}px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      pointer-events: none;
      background: #2c6f3a;
    `;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);

    document.body.appendChild(this.canvas);

    this.ballX = 0;
    this.ballZ = 0;
    this.targetX = null;
    this.targetZ = null;
    this.trajectory = null;
    // Range Finder item — when true, draw 50/100/150 yd rings centered on ball.
    this.showRangeRings = false;
    // Wind state — drawn as a small arrow in the top-left corner so the
    // player sees direction in the spatial top-down context, not just on
    // the floating wind chip. Speed gates rendering: ~0 = no arrow.
    this.windAngle = 0;
    this.windSpeed = 0;

    this.setLayout(layout);
  }

  setRangeRings(show) { this.showRangeRings = !!show; }
  setWind(angle, speed) {
    this.windAngle = angle || 0;
    this.windSpeed = speed || 0;
  }

  /** Swap the hole layout (called when a new hole is loaded). */
  setLayout(layout) {
    this.teePos      = { x: layout.teePos.x, z: layout.teePos.z };
    this.cupPos      = { x: layout.cupPos.x, z: layout.cupPos.z };
    this.fairwayRects = layout.fairwayRects;
    this.greenCenter = layout.greenCenter || { x: this.cupPos.x, z: this.cupPos.z };
    this.greenRadius = layout.greenRadius;
    this.bunkers    = layout.bunkers || [];
    this.water       = layout.water || [];
    this.bounds      = layout.bounds || { minX: -22, maxX: 22, minZ: -22, maxZ: 22 };
    // initialize ball at tee for any hole start
    this.ballX = this.teePos.x;
    this.ballZ = this.teePos.z;
  }

  setBall(x, z)         { this.ballX = x; this.ballZ = z; }
  setTarget(x, z)       { this.targetX = x; this.targetZ = z; }
  clearTarget()         { this.targetX = null; this.targetZ = null; }
  setTrajectory(samp)   { this.trajectory = samp; }
  clearTrajectory()     { this.trajectory = null; }

  // world XZ → canvas px
  _tx(wx) {
    const { minX, maxX } = this.bounds;
    return PAD + ((wx - minX) / (maxX - minX)) * (SIZE - 2 * PAD);
  }
  _tz(wz) {
    const { minZ, maxZ } = this.bounds;
    return PAD + ((wz - minZ) / (maxZ - minZ)) * (SIZE - 2 * PAD);
  }
  _scaleX(worldUnits) {
    const { minX, maxX } = this.bounds;
    return (worldUnits / (maxX - minX)) * (SIZE - 2 * PAD);
  }

  draw() {
    const ctx = this.ctx;

    // bg = rough
    ctx.fillStyle = '#3e8c47';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // water hazards (draw BEFORE fairway so fairway islands visually sit on top of water)
    if (this.water && this.water.length) {
      ctx.fillStyle = '#2a8acc';
      for (const w of this.water) {
        if (w.type === 'circle') {
          ctx.beginPath();
          ctx.arc(this._tx(w.cx), this._tz(w.cz), this._scaleX(w.radius), 0, Math.PI * 2);
          ctx.fill();
        } else {
          const left = this._tx(w.cx - w.w / 2);
          const right = this._tx(w.cx + w.w / 2);
          const top = this._tz(w.cz - w.h / 2);
          const bot = this._tz(w.cz + w.h / 2);
          ctx.fillRect(left, top, right - left, bot - top);
        }
      }
    }

    // fairway segments
    ctx.fillStyle = '#5fb160';
    for (const r of this.fairwayRects) {
      const left = this._tx(r.cx - r.w / 2);
      const right = this._tx(r.cx + r.w / 2);
      // smaller world Z (toward cup) is at the TOP of the canvas
      const top = this._tz(r.cz - r.h / 2);
      const bot = this._tz(r.cz + r.h / 2);
      ctx.fillRect(left, top, right - left, bot - top);
    }

    // bunkers
    if (this.bunkers && this.bunkers.length) {
      ctx.fillStyle = '#e0c98c';
      for (const b of this.bunkers) {
        ctx.beginPath();
        ctx.arc(this._tx(b.cx), this._tz(b.cz), this._scaleX(b.radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // green
    ctx.fillStyle = '#82d27c';
    ctx.beginPath();
    ctx.arc(
      this._tx(this.greenCenter.x), this._tz(this.greenCenter.z),
      this._scaleX(this.greenRadius), 0, Math.PI * 2
    );
    ctx.fill();

    // tee box
    ctx.fillStyle = '#b58a5f';
    const teeSize = 7;
    ctx.fillRect(this._tx(this.teePos.x) - teeSize / 2, this._tz(this.teePos.z) - teeSize / 2, teeSize, teeSize);

    // cup + flag
    const cupCx = this._tx(this.cupPos.x);
    const cupCz = this._tz(this.cupPos.z);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cupCx, cupCz, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(cupCx + 1, cupCz - 8);
    ctx.lineTo(cupCx + 8, cupCz - 6);
    ctx.lineTo(cupCx + 1, cupCz - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cupCx + 0.5, cupCz - 9);
    ctx.lineTo(cupCx + 0.5, cupCz);
    ctx.stroke();

    // Range Finder rings — drawn under the trajectory so they don't clutter
    // the dotted path. Centered on the live ball position.
    if (this.showRangeRings) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const ballPx = this._tx(this.ballX);
      const ballPy = this._tz(this.ballZ);
      for (const yards of [50, 100, 150]) {
        ctx.beginPath();
        ctx.arc(ballPx, ballPy, this._scaleX(yards), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // trajectory dots
    if (this.trajectory && this.trajectory.length > 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      for (let i = 0; i < this.trajectory.length; i += 2) {
        const s = this.trajectory[i];
        ctx.beginPath();
        ctx.arc(this._tx(s.x), this._tz(s.z), 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // predicted target ring (red so it pops against the green minimap)
    if (this.targetX !== null) {
      ctx.strokeStyle = '#ff3344';
      ctx.fillStyle = 'rgba(255, 51, 68, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this._tx(this.targetX), this._tz(this.targetZ), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // ball
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this._tx(this.ballX), this._tz(this.ballZ), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // wind arrow — top-left corner, points in wind direction. Drawn last
    // so it's never occluded by hole geometry.
    if (this.windSpeed > 0.05) {
      const cx = 16, cy = 16;
      // World angle 0 = +X (east). Canvas y axis is inverted vs world Z,
      // but our top-down map keeps world Z = canvas Y, so wind direction
      // (cos, sin) maps directly to canvas (x, y).
      const dx = Math.cos(this.windAngle);
      const dy = Math.sin(this.windAngle);
      const len = 9;
      const tipX = cx + dx * len;
      const tipY = cy + dy * len;
      const tailX = cx - dx * len * 0.5;
      const tailY = cy - dy * len * 0.5;
      // soft round backplate
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      // shaft
      ctx.strokeStyle = '#ff5544';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // arrowhead — small triangle at tip, perpendicular to direction
      const headLen = 5;
      const perpX = -dy, perpY = dx;
      ctx.fillStyle = '#ff5544';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - dx * headLen + perpX * headLen * 0.5,
                 tipY - dy * headLen + perpY * headLen * 0.5);
      ctx.lineTo(tipX - dx * headLen - perpX * headLen * 0.5,
                 tipY - dy * headLen - perpY * headLen * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // border
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }
}
