// Top-down hole minimap — Phase 2
//
// Canvas2D, ~140px square, top-right corner. Shows:
//   - rough / fairway / green / cup / tee
//   - live ball position
//   - predicted landing-rest ring during aim (cyan, matches the 3D ring)
//
// Cheap to draw — pure 2D rect/arc primitives. Redraws every frame.

const SIZE = 144;            // CSS px
const PAD = 6;               // inner padding inside the canvas

export class Minimap {
  constructor({ teePos, cupPos, fairwayRect, greenRadius, bounds }) {
    this.teePos = { x: teePos.x, z: teePos.z };
    this.cupPos = { x: cupPos.x, z: cupPos.z };
    this.fairwayRect = fairwayRect;       // { cx, cz, w, h }
    this.greenRadius = greenRadius;
    this.bounds = bounds || { minX: -22, maxX: 22, minZ: -22, maxZ: 22 };

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.style.cssText = `
      position: fixed;
      top: calc(env(safe-area-inset-top, 12px) + 36px);
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

    this.ballX = teePos.x;
    this.ballZ = teePos.z;
    this.targetX = null;
    this.targetZ = null;
    this.trajectory = null;   // array of { x, z } samples in world coords
  }

  setBall(x, z)            { this.ballX = x; this.ballZ = z; }
  setTarget(x, z)          { this.targetX = x; this.targetZ = z; }
  clearTarget()            { this.targetX = null; this.targetZ = null; }
  setTrajectory(samples)   { this.trajectory = samples; }
  clearTrajectory()        { this.trajectory = null; }

  // map world XZ to canvas px
  _tx(wx) {
    const { minX, maxX } = this.bounds;
    return PAD + ((wx - minX) / (maxX - minX)) * (SIZE - 2 * PAD);
  }
  // World -Z (cup) is "downrange" / "up" on the minimap. Canvas Y grows downward,
  // so smaller world Z must map to smaller pixel Y. No flip needed.
  _tz(wz) {
    const { minZ, maxZ } = this.bounds;
    return PAD + ((wz - minZ) / (maxZ - minZ)) * (SIZE - 2 * PAD);
  }

  draw() {
    const ctx = this.ctx;

    // background — rough
    ctx.fillStyle = '#3e8c47';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // fairway
    const fw = this.fairwayRect;
    ctx.fillStyle = '#5fb160';
    const fwLeft  = this._tx(fw.cx - fw.w / 2);
    const fwRight = this._tx(fw.cx + fw.w / 2);
    const fwTop   = this._tz(fw.cz + fw.h / 2);
    const fwBot   = this._tz(fw.cz - fw.h / 2);
    ctx.fillRect(fwLeft, fwTop, fwRight - fwLeft, fwBot - fwTop);

    // green
    const greenPxRadius = this._scaleX(this.greenRadius);
    ctx.fillStyle = '#82d27c';
    ctx.beginPath();
    ctx.arc(this._tx(this.cupPos.x), this._tz(this.cupPos.z), greenPxRadius, 0, Math.PI * 2);
    ctx.fill();

    // tee box
    ctx.fillStyle = '#b58a5f';
    const teeSize = 7;
    ctx.fillRect(this._tx(this.teePos.x) - teeSize / 2, this._tz(this.teePos.z) - teeSize / 2, teeSize, teeSize);

    // cup
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(this._tx(this.cupPos.x), this._tz(this.cupPos.z), 3, 0, Math.PI * 2);
    ctx.fill();
    // tiny flag triangle next to cup
    ctx.fillStyle = '#ff4444';
    const cupCx = this._tx(this.cupPos.x);
    const cupCz = this._tz(this.cupPos.z);
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

    // trajectory dotted line (during aim)
    if (this.trajectory && this.trajectory.length > 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      // draw every other sample as a small dot
      for (let i = 0; i < this.trajectory.length; i += 2) {
        const s = this.trajectory[i];
        ctx.beginPath();
        ctx.arc(this._tx(s.x), this._tz(s.z), 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // predicted target (during aim)
    if (this.targetX !== null) {
      ctx.strokeStyle = '#00e5ff';
      ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
      ctx.lineWidth = 2;
      const r = 6;
      ctx.beginPath();
      ctx.arc(this._tx(this.targetX), this._tz(this.targetZ), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // ball
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this._tx(this.ballX), this._tz(this.ballZ), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }

  _scaleX(worldUnits) {
    const { minX, maxX } = this.bounds;
    return (worldUnits / (maxX - minX)) * (SIZE - 2 * PAD);
  }
}
