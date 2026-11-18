// Solmar City — the city: roads, blocks, buildings, palms, marina and sky.
// A sun-soaked coastal city generated from a seed, all original geometry.

import { makeRng, randRange, pick, clamp } from './util.js';

export const PITCH = 58;      // distance between road centre lines
export const ROAD_W = 14;     // road width
export const GRID_N = 3;      // road lines at -3..3 in each axis
export const CITY_HALF = GRID_N * PITCH + ROAD_W; // ~188

const PALETTE = [0xe8b48a, 0xd9a06b, 0xf2c9a0, 0xc98d7a, 0xe5c07a, 0xb8c4c9, 0xd77a5e, 0x9fb8a4];

/** Make a canvas texture of lit windows for building faces. */
function windowTexture(baseColor, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.28;
      g.fillStyle = lit ? '#ffe9a8' : 'rgba(20,30,50,0.55)';
      g.fillRect(8 + x * 19, 10 + y * 17, 12, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt texture with a dashed centre line, repeated along the road. */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2b2e33';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  g.fillStyle = '#e8d24a';
  g.fillRect(30, 6, 4, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = [];   // {minX,maxX,minZ,maxZ}
    this.buildings = [];   // {x,z,w,d,h} for the minimap
    this.roadLines = [];   // x or z positions of road centre lines
    this.blockCenters = [];
    this.water = null;
    this.sun = null;
    this.build();
  }

  build() {
    const rng = this.rng;
    const scene = this.scene;

    // Sky, fog, lights — warm late-afternoon sun over the coast.
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0x9cc3e0, 220, 620);
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe3b0, 1.9);
    sun.position.set(140, 190, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260;
    sc.far = 600;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // Base ground: dry grass / dirt.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x9aa06b })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads: one plane per grid line, asphalt with dashed centre.
    const roadTex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const roadLen = CITY_HALF * 2 + 60;
    for (let i = -GRID_N; i <= GRID_N; i++) {
      const pos = i * PITCH;
      this.roadLines.push(pos);
      for (const horizontal of [false, true]) {
        const tex = roadTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(roadLen / 16, 1);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_W), mat);
        road.rotation.x = -Math.PI / 2;
        if (horizontal) road.rotation.z = Math.PI / 2;
        road.position.set(horizontal ? 0 : pos, 0.02, horizontal ? pos : 0);
        road.receiveShadow = true;
        scene.add(road);
      }
    }

    // Block slabs (sidewalks) and buildings.
    const winTexes = PALETTE.slice(0, 4).map((c) => windowTexture('#' + c.toString(16).padStart(6, '0'), rng));
    const slabMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = -GRID_N; bx < GRID_N; bx++) {
      for (let bz = -GRID_N; bz < GRID_N; bz++) {
        const cx = (bx + 0.5) * PITCH;
        const cz = (bz + 0.5) * PITCH;
        this.blockCenters.push({ x: cx, z: cz });
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(PITCH - ROAD_W + 4, PITCH - ROAD_W + 4), slabMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.05, cz);
        slab.receiveShadow = true;
        scene.add(slab);

        // The central block holds Solmar Tower, the city's landmark.
        if (bx === 0 && bz === 0) {
          this.addBuilding(cx, cz, 26, 64, 26, 0x7fb2d9, winTexes, true);
          continue;
        }
        const n = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const w = randRange(rng, 12, 20), d = randRange(rng, 12, 20);
          const ox = randRange(rng, -9, 9), oz = randRange(rng, -9, 9);
          const h = randRange(rng, 8, 34);
          const color = pick(rng, PALETTE);
          this.addBuilding(cx + ox, cz + oz, w, h, d, color, winTexes, false);
        }
      }
    }

    // Palms and lamps along the roads.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let i = -GRID_N; i <= GRID_N; i++) {
      for (let j = -GRID_N; j < GRID_N; j++) {
        const x = i * PITCH + ROAD_W / 2 + 2;
        const z = (j + 0.5) * PITCH;
        if (rng() < 0.55) this.addPalm(x, z, trunkMat, leafMat);
        if (rng() < 0.5) this.addLamp(-x, z, lampMat, lampGlowMat);
      }
    }

    // Marina and beach on the south edge: sand, water, a pier.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 60),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, CITY_HALF + 34);
    sand.receiveShadow = true;
    scene.add(sand);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 300),
      new THREE.MeshLambertMaterial({ color: 0x2e7fa8 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.01, CITY_HALF + 210);
    scene.add(water);
    this.water = water;
    // Pier planks.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), pierMat);
    pier.position.set(-40, 0.5, CITY_HALF + 60);
    pier.castShadow = true;
    scene.add(pier);
    this.colliders.push({ minX: -45, maxX: -35, minZ: CITY_HALF + 30, maxZ: CITY_HALF + 90 });
  }

  addBuilding(x, z, w, h, d, color, winTexes, landmark) {
    const tex = winTexes[Math.floor(Math.random() * winTexes.length)];
    // The window texture already carries the building's colour; keep the
    // material white so it is not tinted twice (which turns facades muddy).
    const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.buildings.push({ x, z, w, d, h });
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    // Rooftop box on taller buildings.
    if (h > 20) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.3, 2.5, d * 0.3),
        new THREE.MeshLambertMaterial({ color: 0x6b6f75 })
      );
      roof.position.set(x, h + 1.2, z);
      roof.castShadow = true;
      this.scene.add(roof);
    }
    return m;
  }

  addPalm(x, z, trunkMat, leafMat) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), leafMat);
    crown.position.set(x, 7.6, z);
    crown.scale.y = 0.6;
    crown.castShadow = true;
    this.scene.add(crown);
    this.colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
  }

  addLamp(x, z, poleMat, glowMat) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
    pole.position.set(x, 3, z);
    this.scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), glowMat);
    bulb.position.set(x, 6.1, z);
    this.scene.add(bulb);
  }

  /** True when the point is on a road (within the asphalt). */
  isRoad(x, z) {
    const half = ROAD_W / 2 + 1;
    for (const line of this.roadLines) {
      if (Math.abs(x - line) < half || Math.abs(z - line) < half) return true;
    }
    return false;
  }

  /** Push a circle (x,z,r) out of every building collider; returns corrected x,z. */
  collideCircle(x, z, r) {
    for (const c of this.colliders) {
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r;
          else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  randomRoadPoint(rng) {
    const line = this.roadLines[Math.floor(rng() * this.roadLines.length)];
    const along = (rng() * 2 - 1) * (CITY_HALF - 20);
    if (rng() < 0.5) return { x: line + (rng() < 0.5 ? -3.5 : 3.5), z: along };
    return { x: along, z: line + (rng() < 0.5 ? -3.5 : 3.5) };
  }

  randomSidewalkPoint(rng) {
    const b = this.blockCenters[Math.floor(rng() * this.blockCenters.length)];
    const edge = Math.floor(rng() * 4);
    const off = (rng() * 2 - 1) * (PITCH / 2 - ROAD_W / 2 - 2);
    const m = PITCH / 2 - 2;
    if (edge === 0) return { x: b.x + off, z: b.z - m };
    if (edge === 1) return { x: b.x + off, z: b.z + m };
    if (edge === 2) return { x: b.x - m, z: b.z + off };
    return { x: b.x + m, z: b.z + off };
  }

  update(dt, time) {
    // Gentle water shimmer.
    if (this.water) this.water.position.y = 0.01 + Math.sin(time * 0.8) * 0.05;
  }
}
