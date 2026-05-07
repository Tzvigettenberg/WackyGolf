// Hole — Phase 3.4
//
// Builds Three.js geometry for a hole template. Returns a `surfaces` object
// that BallPhysics + Minimap both consume so they always agree on what's
// fairway / green / sand. Disposal cleans up everything in the hole's group.
//
// Ground and distant hills are now built once at scene-level (in main.js)
// because they're identical across holes — no point disposing/rebuilding.

import {
  Mesh, Group, InstancedMesh, Object3D,
  PlaneGeometry, CircleGeometry, CylinderGeometry, ConeGeometry, SphereGeometry,
  MeshLambertMaterial, MeshBasicMaterial,
  Quaternion, Vector3,
} from 'three';

const TREELINE_COUNT = 60;     // perimeter trees per hole
const TREELINE_RING_SCALE = 1.25;
const TREELINE_SPREAD = 0.5;   // 0..1, how much trees scatter outward from the ring

/** Build a hole's geometry from a template. */
export function buildHole(scene, template) {
  const root = new Group();

  // fairway segments
  for (const r of template.fairway) {
    const fw = new Mesh(
      new PlaneGeometry(r.w, r.h),
      new MeshLambertMaterial({ color: 0x5fb160 })
    );
    fw.rotation.x = -Math.PI / 2;
    fw.position.set(r.cx, 0.01, r.cz);
    root.add(fw);
  }

  // green
  const greenMesh = new Mesh(
    new CircleGeometry(template.green.radius, 32),
    new MeshLambertMaterial({ color: 0x82d27c })
  );
  greenMesh.rotation.x = -Math.PI / 2;
  greenMesh.position.set(template.green.cx, 0.02, template.green.cz);
  root.add(greenMesh);

  // tee box
  const teeBox = new Mesh(
    new CircleGeometry(1.6, 16),
    new MeshLambertMaterial({ color: 0xb58a5f })
  );
  teeBox.rotation.x = -Math.PI / 2;
  teeBox.position.set(template.teePosition.x, 0.03, template.teePosition.z);
  root.add(teeBox);

  // cup
  const cup = new Mesh(
    new CircleGeometry(0.55, 16),
    new MeshBasicMaterial({ color: 0x111111 })
  );
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(template.cupPosition.x, 0.03, template.cupPosition.z);
  root.add(cup);

  // flag pole + flag
  const pole = new Mesh(
    new CylinderGeometry(0.04, 0.04, 4, 8),
    new MeshLambertMaterial({ color: 0xeeeeee })
  );
  pole.position.set(template.cupPosition.x, 2, template.cupPosition.z);
  root.add(pole);

  const flag = new Mesh(
    new PlaneGeometry(1.2, 0.7),
    new MeshLambertMaterial({ color: 0xff4444, side: 2 })
  );
  flag.position.set(template.cupPosition.x + 0.6, 3.6, template.cupPosition.z);
  root.add(flag);

  // water hazards (rendered just below fairway height so fairway/green can sit on top)
  if (template.water) {
    for (const w of template.water) {
      const waterMat = new MeshLambertMaterial({ color: 0x2a8acc });
      const geom = w.type === 'circle'
        ? new CircleGeometry(w.radius, 32)
        : new PlaneGeometry(w.w, w.h);
      const water = new Mesh(geom, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(w.cx, 0.005, w.cz);
      root.add(water);
    }
  }

  // bunkers
  if (template.bunkers) {
    for (const b of template.bunkers) {
      const bunker = new Mesh(
        new CircleGeometry(b.radius, 24),
        new MeshLambertMaterial({ color: 0xe0c98c })
      );
      bunker.rotation.x = -Math.PI / 2;
      bunker.position.set(b.cx, 0.015, b.cz);
      root.add(bunker);
    }
  }

  // course-internal trees (tee-area, in-play hazards)
  if (template.trees) {
    for (const [x, z, scale] of template.trees) {
      root.add(makeTree(x, z, scale));
    }
  }

  // perimeter treeline (instanced — basically free perf-wise)
  const treeline = buildTreeline(template.bounds, TREELINE_COUNT);
  root.add(treeline.trunks);
  root.add(treeline.leaves);

  scene.add(root);

  return {
    root,
    id: template.id,
    teePosition: template.teePosition.clone(),
    cupPosition: template.cupPosition.clone(),
    bounds: template.bounds,
    par: template.par,
    name: template.name,
    surfaces: {
      fairwayRects: template.fairway,
      green: { cx: template.green.cx, cz: template.green.cz, radius: template.green.radius },
      bunkers: template.bunkers || [],
      water: template.water || [],
    },
  };
}

/** Remove a hole's geometry from the scene and dispose its GPU buffers. */
export function disposeHole(scene, hole) {
  if (!hole) return;
  scene.remove(hole.root);
  hole.root.traverse((obj) => {
    if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
      else if (obj.material.dispose) obj.material.dispose();
    }
  });
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

/** Ring of trees around the perimeter. Two InstancedMeshes (trunks + leaves) → 2 draw calls regardless of count. */
function buildTreeline(bounds, count) {
  const trunkGeom = new CylinderGeometry(0.3, 0.4, 1.6, 6);
  const leavesGeom = new ConeGeometry(1.2, 2.6, 7);
  const trunkMat = new MeshLambertMaterial({ color: 0x6b4423 });
  const leavesMat = new MeshLambertMaterial({ color: 0x2d6a3e });

  const trunks = new InstancedMesh(trunkGeom, trunkMat, count);
  const leaves = new InstancedMesh(leavesGeom, leavesMat, count);

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2;
  const ringRadius = Math.max(halfX, halfZ) * TREELINE_RING_SCALE;

  const dummy = new Object3D();
  const q = new Quaternion();
  const pos = new Vector3();
  const sc = new Vector3();

  for (let i = 0; i < count; i++) {
    // ring layout with random scatter outward
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const dist = ringRadius + Math.random() * (ringRadius * TREELINE_SPREAD);
    const x = cx + Math.cos(angle) * dist;
    const z = cz + Math.sin(angle) * dist;
    const s = 0.85 + Math.random() * 0.7;
    q.setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI * 2);

    pos.set(x, 0.8 * s, z);
    sc.set(s, s, s);
    dummy.matrix.compose(pos, q, sc);
    trunks.setMatrixAt(i, dummy.matrix);

    pos.set(x, 2.0 * s, z);
    dummy.matrix.compose(pos, q, sc);
    leaves.setMatrixAt(i, dummy.matrix);
  }

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  return { trunks, leaves };
}

/** Build the visible ball + its blob shadow. Survives across holes. */
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

/** Build the global ground plane. Called once at boot. */
export function buildSceneBackdrop(scene) {
  // huge ground plane (covers any hole bounds)
  const ground = new Mesh(
    new PlaneGeometry(800, 800),
    new MeshLambertMaterial({ color: 0x3e8c47 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // (Distant hills removed — they were drifting into play areas. The
  // perimeter treeline per hole gives enough sense of surroundings.)
}
