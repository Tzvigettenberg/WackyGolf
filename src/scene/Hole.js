// Hole — Phase 1
//
// One simple par-3-ish hole. Tee at +Z, cup at -Z.
// Geometry built from Three.js primitives, vertex colors only,
// no textures. Cheap to render on phones.

import {
  Vector3, Mesh, Group,
  PlaneGeometry, CircleGeometry, CylinderGeometry, ConeGeometry, SphereGeometry,
  MeshLambertMaterial, MeshBasicMaterial,
} from 'three';

export const TEE_POSITION = new Vector3(0, 0, 18);
export const CUP_POSITION = new Vector3(0, 0, -18);

export function buildHole(scene) {
  const root = new Group();

  // ground (rough — darker green outside the fairway)
  const ground = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshLambertMaterial({ color: 0x3e8c47 })
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // fairway
  const fairway = new Mesh(
    new PlaneGeometry(10, 38),
    new MeshLambertMaterial({ color: 0x5fb160 })
  );
  fairway.rotation.x = -Math.PI / 2;
  fairway.position.y = 0.01;
  root.add(fairway);

  // green
  const green = new Mesh(
    new CircleGeometry(5, 32),
    new MeshLambertMaterial({ color: 0x82d27c })
  );
  green.rotation.x = -Math.PI / 2;
  green.position.set(CUP_POSITION.x, 0.02, CUP_POSITION.z);
  root.add(green);

  // tee box (light brown patch)
  const teeBox = new Mesh(
    new CircleGeometry(1.6, 16),
    new MeshLambertMaterial({ color: 0xb58a5f })
  );
  teeBox.rotation.x = -Math.PI / 2;
  teeBox.position.set(TEE_POSITION.x, 0.03, TEE_POSITION.z);
  root.add(teeBox);

  // cup — black disc just below ground level so the ball "drops in"
  const cup = new Mesh(
    new CircleGeometry(0.55, 16),
    new MeshBasicMaterial({ color: 0x111111 })
  );
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(CUP_POSITION.x, 0.03, CUP_POSITION.z);
  root.add(cup);

  // flag pole + flag
  const pole = new Mesh(
    new CylinderGeometry(0.04, 0.04, 4, 8),
    new MeshLambertMaterial({ color: 0xeeeeee })
  );
  pole.position.set(CUP_POSITION.x, 2, CUP_POSITION.z);
  root.add(pole);

  const flag = new Mesh(
    new PlaneGeometry(1.2, 0.7),
    new MeshLambertMaterial({ color: 0xff4444, side: 2 /* DoubleSide */ })
  );
  flag.position.set(CUP_POSITION.x + 0.6, 3.6, CUP_POSITION.z);
  root.add(flag);

  // decorative trees on the rough
  for (const [x, z, scale] of [
    [-9, 6, 1.0], [-12, -2, 1.2], [-10, -10, 0.9],
    [9, 5, 1.0], [12, -3, 1.1], [10, -12, 0.8],
    [-15, 14, 1.0], [15, 14, 0.9],
  ]) {
    root.add(makeTree(x, z, scale));
  }

  scene.add(root);

  return {
    root,
    teePosition: TEE_POSITION.clone(),
    cupPosition: CUP_POSITION.clone(),
  };
}

function makeTree(x, z, scale = 1) {
  const g = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.25 * scale, 0.35 * scale, 1.6 * scale, 6),
    new MeshLambertMaterial({ color: 0x6b4423 })
  );
  trunk.position.y = 0.8 * scale;
  g.add(trunk);

  const leaves = new Mesh(
    new ConeGeometry(1.1 * scale, 2.4 * scale, 7),
    new MeshLambertMaterial({ color: 0x2d6a3e })
  );
  leaves.position.y = (0.8 + 1.2) * scale;
  g.add(leaves);

  g.position.set(x, 0, z);
  return g;
}

/** Build the visible ball + its blob shadow.  Returns { mesh, shadow }. */
export function buildBall() {
  const mesh = new Mesh(
    new SphereGeometry(0.4, 16, 12),
    new MeshLambertMaterial({ color: 0xffffff })
  );

  const shadow = new Mesh(
    new CircleGeometry(0.45, 16),
    new MeshBasicMaterial({ color: 0x000000, opacity: 0.25, transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;

  return { mesh, shadow };
}
