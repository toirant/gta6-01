// Solmar City — traffic cars and pedestrians moving through the city.
// Traffic follows road lines and turns at intersections; pedestrians stroll sidewalks.

import { makeRng, randRange, pick, clamp, dist2D } from './util.js';
import { Car, CAR_COLORS } from './vehicles.js';

const PED_SHIRTS = [0xe85d3d, 0x3d7fe8, 0x53c46a, 0xe8c832, 0xc25fc2, 0xeeeeee, 0x222222];
const PED_SKINS = [0xe8b48a, 0xc98d5f, 0x8a5a34, 0xf2c9a0];

/** Build a simple blocky pedestrian. */
function buildPedMesh(shirt, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirtMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.6;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pantsMat);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.body = body;
  return g;
}

export class Traffic {
  constructor(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rng = makeRng(seed ^ 0x5f3a);
    this.cars = [];   // {car, axis, dir, lane, speed, targetSpeed}
    this.peds = [];   // {mesh, x, z, heading, speed, target, alive, walkPhase, fleeing}
    this.spawnCars(14);
    this.spawnPeds(22);
  }

  spawnCars(n) {
    for (let i = 0; i < n; i++) this.addTrafficCar();
  }

  addTrafficCar() {
    const p = this.world.randomRoadPoint(this.rng);
    const axis = Math.abs(p.x % 58) < 1 ? 'z' : 'x'; // which way the road runs
    const horizontal = Math.abs(p.z) % 58 < 7 && Math.abs(p.x) > 7;
    const dir = this.rng() < 0.5 ? 1 : -1;
    const car = new Car(this.scene, p.x, p.z, 0, pick(this.rng, CAR_COLORS), false);
    car.driver = 'traffic';
    // Face along the road.
    const alongZ = Math.abs(p.x - Math.round(p.x / 58) * 58) < 7;
    car.heading = alongZ ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.mesh.rotation.y = car.heading;
    this.cars.push({ car, axis: alongZ ? 'z' : 'x', dir, speed: randRange(this.rng, 7, 11), targetSpeed: randRange(this.rng, 7, 11) });
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) this.addPed();
  }

  addPed(x, z) {
    const p = x === undefined ? this.world.randomSidewalkPoint(this.rng) : { x, z };
    const mesh = buildPedMesh(pick(this.rng, PED_SHIRTS), pick(this.rng, PED_SKINS));
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    const ped = {
      mesh, x: p.x, z: p.z,
      heading: this.rng() * Math.PI * 2,
      speed: randRange(this.rng, 1.2, 2.2),
      target: null, alive: true, walkPhase: this.rng() * 6, fleeing: 0,
    };
    ped.target = this.world.randomSidewalkPoint(this.rng);
    this.peds.push(ped);
    return ped;
  }

  /** Pedestrian hit by a car or a bullet: falls over. */
  killPed(ped) {
    if (!ped.alive) return;
    ped.alive = false;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
  }

  update(dt, playerPos, wanted) {
    // --- Traffic cars: drive along their road, turn at intersections. ---
    for (const t of this.cars) {
      const c = t.car;
      if (!c.alive) continue;
      // Slow down if the car ahead is close.
      let ahead = Infinity;
      for (const o of this.cars) {
        if (o === t || !o.car.alive) continue;
        const d = dist2D(c.x, c.z, o.car.x, o.car.z);
        if (d < ahead) ahead = d;
      }
      const want = ahead < 9 ? 0 : t.targetSpeed;
      c.speed += (want - c.speed) * Math.min(1, dt * 1.5);
      const f = c.forward;
      c.x += f.x * c.speed * dt;
      c.z += f.z * c.speed * dt;
      // At an intersection (near a crossing road line), maybe turn.
      const nearCross = this.nearIntersection(c.x, c.z);
      if (nearCross && this.rng() < dt * 0.5) {
        c.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        t.axis = t.axis === 'x' ? 'z' : 'x';
      }
      // Keep inside the city; wrap around the far edge.
      const lim = 200;
      if (Math.abs(c.x) > lim || Math.abs(c.z) > lim) {
        const p = this.world.randomRoadPoint(this.rng);
        c.x = p.x; c.z = p.z;
        c.heading = this.rng() * Math.PI * 2;
      }
      c.x = clamp(c.x, -210, 210);
      c.z = clamp(c.z, -210, 235);
      const hit = this.world.collideCircle(c.x, c.z, 2.2);
      c.x = hit.x; c.z = hit.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Wheel spin.
      const spin = (c.speed * dt) / 0.36;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
    }

    // --- Pedestrians: stroll to a sidewalk target, flee when scared. ---
    for (const p of this.peds) {
      if (!p.alive) continue;
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        p.target = this.world.randomSidewalkPoint(this.rng);
        continue;
      }
      let speed = p.speed;
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        speed = 4.5;
        // Run away from the player.
        const away = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
        p.heading = away;
      } else {
        p.heading = Math.atan2(dx, dz);
      }
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      const hit = this.world.collideCircle(p.x, p.z, 0.5);
      p.x = hit.x; p.z = hit.z;
      p.walkPhase += dt * speed * 3;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
    }
  }

  nearIntersection(x, z) {
    // Near a crossing of two road centre lines.
    const nearLine = (v) => {
      for (const line of this.world.roadLines) if (Math.abs(v - line) < 2.5) return true;
      return false;
    };
    return nearLine(x) && nearLine(z);
  }

  /** Scare nearby pedestrians (gunshot, crash). */
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.alive && dist2D(p.x, p.z, x, z) < radius) p.fleeing = 3 + Math.random() * 2;
    }
  }
}
