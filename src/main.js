// Wacky Golf — Phase 1
//
// Goal: drag-back swing, custom ball physics, ball-into-cup detection,
// follow camera. No clubs, no shop, no scoring beyond a stroke counter.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Fog,
  AmbientLight, DirectionalLight, Vector3,
} from 'three';

import { buildHole, disposeHole, buildBall, buildSceneBackdrop } from './scene/Hole.js';
import { FollowCamera } from './scene/FollowCamera.js';
import { BallPhysics, BALL_RADIUS } from './physics/BallPhysics.js';
import { SwingController } from './input/SwingController.js';
import { Bag } from './gameplay/Club.js';
import { ClubSelector } from './ui/ClubSelector.js';
import { Minimap } from './ui/Minimap.js';
import { PowerMeter } from './ui/PowerMeter.js';
import { RotateControls } from './ui/RotateControls.js';
import { Run } from './core/Run.js';
import { templateForHole, holeMetaFromTemplate } from './content/holes.js';
import { Collection } from './ui/Collection.js';

// ----- Three.js setup -----
const scene = new Scene();
scene.background = new Color(0x87CEEB);
scene.fog = new Fog(0x87CEEB, 60, 180);

const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new AmbientLight(0xffffff, 0.55));
const sun = new DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 14, 6);
scene.add(sun);

// ----- backdrop (built once: ground + distant hills) -----
buildSceneBackdrop(scene);

// ----- hole + ball + camera -----
// Initial hole geometry comes from the template for hole #1.
let currentHole = buildHole(scene, templateForHole(1));

const { mesh: ballMesh, shadow: ballShadow } = buildBall();
scene.add(ballMesh);
scene.add(ballShadow);

const physics = new BallPhysics({
  teePosition: currentHole.teePosition,
  cupPosition: currentHole.cupPosition,
});
physics.surfaces = currentHole.surfaces;
ballMesh.position.copy(physics.position);

const followCamera = new FollowCamera(camera);
followCamera.snap(physics.position);

// ----- run state + HUD -----
const run = new Run();

const holeEl = document.getElementById('stat-hole');
const strokesEl = document.getElementById('stat-strokes');
const cashEl = document.getElementById('stat-cash');
const banner = document.getElementById('score-banner');
const bannerName = banner.querySelector('.banner-name');
const bannerCash = banner.querySelector('.banner-cash');
const runOverEl = document.getElementById('run-over');
const runOverHolesEl = document.getElementById('run-over-holes');
const runOverCashEl = document.getElementById('run-over-cash');
const playAgainBtn = document.getElementById('play-again-btn');
const distEl = document.getElementById('shot-distance');

// Distance counter state — set on each swing, cleared on hole change / new run.
let shotStartPos = null;       // Vector3 where the current shot began
let distanceFadeTimer = null;  // setTimeout id for fade-out after ball stops

function startDistanceCounter() {
  if (distanceFadeTimer) { clearTimeout(distanceFadeTimer); distanceFadeTimer = null; }
  shotStartPos = physics.position.clone();
  distEl.textContent = '0 YD';
  distEl.style.opacity = '1';
}
function freezeAndFadeDistance() {
  // hold the final number for ~1.4s then fade out
  if (distanceFadeTimer) clearTimeout(distanceFadeTimer);
  distanceFadeTimer = setTimeout(() => {
    distEl.style.opacity = '0';
    shotStartPos = null;
    distanceFadeTimer = null;
  }, 1400);
}
function clearDistanceImmediate() {
  if (distanceFadeTimer) { clearTimeout(distanceFadeTimer); distanceFadeTimer = null; }
  shotStartPos = null;
  distEl.style.opacity = '0';
}

function updateHUD() {
  const name = (currentHole && currentHole.name) ? ` · ${currentHole.name.toUpperCase()}` : '';
  holeEl.textContent = `HOLE ${run.holeNumber}${name} · PAR ${run.holeMeta.par}`;
  strokesEl.textContent = `STROKE ${run.strokes}/${run.holeMeta.strokeLimit}`;
  strokesEl.classList.toggle('warning', run.strokesLeft === 2);
  strokesEl.classList.toggle('last-chance', run.strokesLeft === 1);
  cashEl.textContent = `$${run.cash}`;
}

function showScoreBanner(name, cash) {
  bannerName.textContent = name;
  bannerCash.textContent = cash > 0 ? `+$${cash}` : '';
  banner.style.opacity = '1';
  setTimeout(() => { banner.style.opacity = '0'; }, 1700);
}

function showRunOver() {
  runOverHolesEl.textContent = `Holes played: ${run.holeNumber - 1}`;
  runOverCashEl.textContent = `Total cash: $${run.cash}`;
  runOverEl.classList.add('shown');
}
function hideRunOver() {
  runOverEl.classList.remove('shown');
}

run.onChange(() => {
  updateHUD();
});
updateHUD();

// ----- collection (hole library) -----
const collection = new Collection();
// the first hole is loaded directly in the boot section, so discover it now
collection.discoverHole(currentHole.id);

// ----- bag, club selector, minimap, power meter, rotate buttons -----
const bag = new Bag('driver');
const clubSelector = new ClubSelector(bag);

const minimap = new Minimap({
  teePos: currentHole.teePosition,
  cupPos: currentHole.cupPosition,
  fairwayRects: currentHole.surfaces.fairwayRects,
  greenCenter: { x: currentHole.surfaces.green.cx, z: currentHole.surfaces.green.cz },
  greenRadius: currentHole.surfaces.green.radius,
  bunkers: currentHole.surfaces.bunkers,
  water: currentHole.surfaces.water,
  bounds: currentHole.bounds,
});

const powerMeter = new PowerMeter();
const rotateControls = new RotateControls(followCamera);

// ----- swing controller -----
const swing = new SwingController({
  ball: physics,
  scene,
  camera,
  canvas: renderer.domElement,
  bag,
  onShotFired: () => {
    run.onShot();
    startDistanceCounter();
  },
  onAim: (target) => {
    if (target) {
      minimap.setTarget(target.x, target.z);
      minimap.setTrajectory(target.samples);
      powerMeter.set(target.power);
    } else {
      minimap.clearTarget();
      minimap.clearTrajectory();
      powerMeter.set(null);
    }
  },
});
swing.setSurfaces(currentHole.surfaces);

// ----- hole loading -----
function loadCurrentHole() {
  const template = templateForHole(run.holeNumber);

  // tear down old geometry, build new
  disposeHole(scene, currentHole);
  currentHole = buildHole(scene, template);

  // push to physics + predictor
  physics.setHole(currentHole.teePosition, currentHole.cupPosition, currentHole.surfaces);
  swing.setSurfaces(currentHole.surfaces);

  // push to minimap
  minimap.setLayout({
    teePos: currentHole.teePosition,
    cupPos: currentHole.cupPosition,
    fairwayRects: currentHole.surfaces.fairwayRects,
    greenCenter: { x: currentHole.surfaces.green.cx, z: currentHole.surfaces.green.cz },
    greenRadius: currentHole.surfaces.green.radius,
    bunkers: currentHole.surfaces.bunkers,
    water: currentHole.surfaces.water,
    bounds: currentHole.bounds,
  });

  // snap visuals
  ballMesh.position.copy(physics.position);
  followCamera.targetYaw = 0;
  followCamera.snap(physics.position);

  // tell Run the par/limit for this hole
  run.startHole(holeMetaFromTemplate(template));
  swing.setEnabled(true);

  // unlock this hole in the collection
  collection.discoverHole(currentHole.id);
}

// Seed the first hole's meta now that everything is constructed
run.holeMeta = holeMetaFromTemplate(templateForHole(1));
updateHUD();

// ----- holed-out + bust flow -----
function advanceToNextHole() {
  clearDistanceImmediate();
  // bump hole number first, then load that hole's geometry + meta
  run.nextHole(holeMetaFromTemplate(templateForHole(run.holeNumber + 1)));
  loadCurrentHole();
}

physics.onHoled = () => {
  const result = run.onHoled();
  if (!result) return;
  swing.setEnabled(false);
  showScoreBanner(result.name, result.cash);
  freezeAndFadeDistance();
  setTimeout(advanceToNextHole, 1900);
};

physics.onCameToRest = () => {
  if (physics.isHoled) return;
  if (physics.isInWater) {
    handleWaterPenalty();
    return;
  }
  freezeAndFadeDistance();
  if (run.checkBustOnRest()) {
    swing.setEnabled(false);
    showRunOver();
  }
};

function handleWaterPenalty() {
  // +1 penalty stroke
  run.onShot();
  swing.setEnabled(false);
  showScoreBanner('SPLASH! +1 STROKE', 0);

  setTimeout(() => {
    physics.isInWater = false;
    physics.position.copy(physics.lastShotStart);
    physics.previousPosition.copy(physics.position);
    physics.velocity.set(0, 0, 0);
    physics.isAtRest = true;
    ballMesh.position.copy(physics.position);
    // also a penalty might push us past stroke limit → check bust
    if (run.checkBustOnRest()) {
      showRunOver();
    } else {
      swing.setEnabled(true);
    }
  }, 1400);
}

playAgainBtn.addEventListener('click', () => {
  clearDistanceImmediate();
  hideRunOver();
  run.resetRun(holeMetaFromTemplate(templateForHole(1)));
  loadCurrentHole();
});

// ----- resize handling -----
function handleResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// ----- main loop -----
// Fixed-timestep physics (1/60s) so the predictor and the actual sim
// produce identical trajectories. Accumulator absorbs frame-rate variation.
const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastT = performance.now();

// Interpolated render position — keeps the ball/camera/minimap visually
// smooth on devices that render at higher Hz than the physics step rate.
const renderPos = new Vector3();

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  if (dt > 0.25) dt = 0.25;   // cap accumulator after a tab pause
  lastT = now;

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    physics.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  // alpha is "how far through the next physics step we are" (0..1)
  const alpha = Math.max(0, Math.min(1, accumulator / FIXED_DT));
  renderPos.lerpVectors(physics.previousPosition, physics.position, alpha);

  // visuals — ball/shadow render at interpolated position
  ballMesh.position.copy(renderPos);
  ballShadow.position.set(renderPos.x, 0.04, renderPos.z);
  const heightAboveGround = Math.max(0, renderPos.y - BALL_RADIUS);
  const shadowScale = Math.max(0.4, 1 - heightAboveGround * 0.05);
  ballShadow.scale.setScalar(shadowScale);
  ballShadow.material.opacity = 0.28 * shadowScale;

  // smooth the visible landing marker each frame
  swing.tick();

  // distance counter — straight-line yards from where this shot started
  if (shotStartPos) {
    const dx = renderPos.x - shotStartPos.x;
    const dz = renderPos.z - shotStartPos.z;
    distEl.textContent = `${Math.round(Math.hypot(dx, dz))} YD`;
  }

  followCamera.update(renderPos);

  // rotate buttons only visible when ball is at rest AND not mid-drag —
  // hidden during the swing pull-back so they don't visually overlap the power meter
  rotateControls.setVisible(physics.isAtRest && !physics.isHoled && !swing.isAiming);

  // minimap update — also use interpolated XZ
  minimap.setBall(renderPos.x, renderPos.z);
  minimap.draw();

  renderer.render(scene, camera);
}
frame();

console.log('[wackygolf] Phase 1 ready. UA:', navigator.userAgent);
