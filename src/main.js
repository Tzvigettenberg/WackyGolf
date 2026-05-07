// Wacky Golf — Phase 0 entry point
// Goal: prove Three.js renders on both iOS Safari and Chrome Android,
// and confirm the low-poly stylized look direction.

import * as THREE from 'three';

// ------------------------------ scene setup ------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // sky blue
scene.fog = new THREE.Fog(0x87CEEB, 25, 60);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  120
);
camera.position.set(0, 6, 14);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ------------------------------ lighting ------------------------------

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(8, 14, 6);
scene.add(sun);

// ------------------------------ ground ------------------------------

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshLambertMaterial({ color: 0x4caf50 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// darker green "fairway" patch + light "green" patch, just to hint at composition
const fairway = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 24),
  new THREE.MeshLambertMaterial({ color: 0x66bb6a })
);
fairway.rotation.x = -Math.PI / 2;
fairway.position.set(0, 0.01, 0);
scene.add(fairway);

const green = new THREE.Mesh(
  new THREE.CircleGeometry(3, 24),
  new THREE.MeshLambertMaterial({ color: 0x81c784 })
);
green.rotation.x = -Math.PI / 2;
green.position.set(0, 0.02, -10);
scene.add(green);

// ------------------------------ ball ------------------------------

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 16, 12),
  new THREE.MeshLambertMaterial({ color: 0xffffff })
);
ball.position.set(0, 0.4, 8);
scene.add(ball);

// blob shadow under the ball (cheap alternative to real-time shadow mapping)
const ballShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.45, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.25, transparent: true })
);
ballShadow.rotation.x = -Math.PI / 2;
ballShadow.position.set(0, 0.03, 8);
scene.add(ballShadow);

// ------------------------------ flag ------------------------------

const pole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.04, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0xeeeeee })
);
pole.position.set(0, 2, -10);
scene.add(pole);

const flag = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 0.7),
  new THREE.MeshLambertMaterial({ color: 0xff4444, side: THREE.DoubleSide })
);
flag.position.set(0.6, 3.6, -10);
scene.add(flag);

// ------------------------------ trees ------------------------------

function makeTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 1.6 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 0.8 * scale;
  group.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.1 * scale, 2.4 * scale, 7),
    new THREE.MeshLambertMaterial({ color: 0x2d6a3e })
  );
  leaves.position.y = (0.8 + 1.2) * scale;
  group.add(leaves);

  group.position.set(x, 0, z);
  scene.add(group);
}

makeTree(-7, 4, 1.0);
makeTree(7, 0, 1.2);
makeTree(-9, -3, 0.9);
makeTree(8, -6, 1.1);
makeTree(-5, -7, 1.0);
makeTree(6, 6, 0.8);

// ------------------------------ resize handling ------------------------------

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// ------------------------------ animation loop ------------------------------

let t = 0;
function animate() {
  requestAnimationFrame(animate);
  t += 0.004;

  // slow camera orbit so we can confirm rendering + frame pacing on both browsers
  const radius = 16;
  camera.position.x = Math.sin(t) * radius;
  camera.position.z = Math.cos(t) * radius + 2;
  camera.position.y = 5.5 + Math.sin(t * 0.7) * 0.7;
  camera.lookAt(0, 1, -2);

  // gentle ball bob just for life
  ball.position.y = 0.4 + Math.abs(Math.sin(t * 4)) * 0.08;

  renderer.render(scene, camera);
}
animate();

// quick log so we can confirm the entry point ran in remote devtools
console.log('[wackygolf] Phase 0 scene up. UA:', navigator.userAgent);
