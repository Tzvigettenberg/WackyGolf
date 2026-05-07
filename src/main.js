// Wacky Golf — Phase 1
//
// Goal: drag-back swing, custom ball physics, ball-into-cup detection,
// follow camera. No clubs, no shop, no scoring beyond a stroke counter.

import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Fog,
  AmbientLight, DirectionalLight,
} from 'three';

import { buildHole, buildBall, TEE_POSITION, CUP_POSITION } from './scene/Hole.js';
import { FollowCamera } from './scene/FollowCamera.js';
import { BallPhysics, BALL_RADIUS } from './physics/BallPhysics.js';
import { SwingController } from './input/SwingController.js';
import { Bag } from './gameplay/Club.js';
import { ClubSelector } from './ui/ClubSelector.js';
import { Minimap } from './ui/Minimap.js';
import { PowerMeter } from './ui/PowerMeter.js';
import { RotateControls } from './ui/RotateControls.js';

// ----- Three.js setup -----
const scene = new Scene();
scene.background = new Color(0x87CEEB);
scene.fog = new Fog(0x87CEEB, 35, 90);

const camera = new PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);

const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new AmbientLight(0xffffff, 0.55));
const sun = new DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 14, 6);
scene.add(sun);

// ----- hole + ball + camera -----
const hole = buildHole(scene);
const { mesh: ballMesh, shadow: ballShadow } = buildBall();
scene.add(ballMesh);
scene.add(ballShadow);

const physics = new BallPhysics({
  teePosition: TEE_POSITION,
  cupPosition: CUP_POSITION,
});
ballMesh.position.copy(physics.position);

const followCamera = new FollowCamera(camera);
followCamera.snap(physics.position);

// ----- HUD -----
const strokeEl = document.getElementById('stroke');
const overlayEl = document.getElementById('overlay');
let strokes = 0;
const updateStrokeUI = () => {
  if (strokeEl) strokeEl.textContent = `Strokes: ${strokes}`;
};
updateStrokeUI();

const showOverlay = (text, ms = 1800) => {
  if (!overlayEl) return;
  overlayEl.textContent = text;
  overlayEl.style.opacity = '1';
  setTimeout(() => { overlayEl.style.opacity = '0'; }, ms);
};

// ----- bag, club selector, minimap, power meter, rotate buttons -----
const bag = new Bag('driver');
const clubSelector = new ClubSelector(bag);

const minimap = new Minimap({
  teePos: TEE_POSITION,
  cupPos: CUP_POSITION,
  fairwayRect: { cx: 0, cz: 0, w: 10, h: 38 },
  greenRadius: 5,
  bounds: { minX: -22, maxX: 22, minZ: -22, maxZ: 22 },
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
    strokes += 1;
    updateStrokeUI();
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

// ----- holed-out flow -----
physics.onHoled = () => {
  const word = strokes === 1 ? 'HOLE IN ONE!' : `HOLED IN ${strokes}`;
  showOverlay(word, 2000);
  // reset for another go after a short pause
  setTimeout(() => {
    physics.reset();
    ballMesh.position.copy(physics.position);
    strokes = 0;
    updateStrokeUI();
    followCamera.snap(physics.position);
  }, 2200);
};

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

  // visuals
  ballMesh.position.copy(physics.position);
  // blob shadow follows ball X/Z, sticks to ground
  ballShadow.position.set(physics.position.x, 0.04, physics.position.z);
  // shadow shrinks as ball flies higher
  const heightAboveGround = Math.max(0, physics.position.y - BALL_RADIUS);
  const shadowScale = Math.max(0.4, 1 - heightAboveGround * 0.05);
  ballShadow.scale.setScalar(shadowScale);
  ballShadow.material.opacity = 0.28 * shadowScale;

  followCamera.update(physics.position);

  // minimap update
  minimap.setBall(physics.position.x, physics.position.z);
  minimap.draw();

  renderer.render(scene, camera);
}
frame();

console.log('[wackygolf] Phase 1 ready. UA:', navigator.userAgent);
