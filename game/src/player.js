// Solmar City — the player on foot: movement, third-person camera, car entry.
// Mara Voss, a courier-turned-wheelwoman, built from boxes like everyone else.

import { clamp, damp, angleLerp, angleDiff, dist2D } from './util.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2f2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b48a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x24304a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1210 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), jacket);
  body.position.y = 1.1;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.38), hair);
  hairM.position.y = 1.9;
  g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), pants);
  legL.position.set(-0.15, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
  armL.position.set(-0.4, 1.1, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  g.userData = { legL, legR, armL, armR, body, head };
  return g;
}

export class Player {
  constructor(scene, world, x, z) {
    this.scene = scene;
    this.world = world;
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = 0;       // facing
    this.camYaw = 0;        // camera orbit
    this.camPitch = 0.32;
    this.camDist = 9;
    this.speed = 0;
    this.health = 100;
    this.inCar = null;      // Car instance or null
    this.walkPhase = 0;
    this.aiming = false;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.ammo = 24;
    this.dead = false;
  }

  get pos() { return { x: this.x, z: this.z }; }

  /** Third-person camera: orbit with mouse drag, sit behind the player or the car. */
  updateCamera(camera, dt, input) {
    this.camYaw -= input.mouseDX * 0.004;
    this.camPitch = clamp(this.camPitch + input.mouseDY * 0.003, -0.15, 1.1);
    const target = this.inCar
      ? { x: this.inCar.x, z: this.inCar.z, y: 1.6 }
      : { x: this.x, z: this.z, y: 1.6 };
    const dist = this.inCar ? 10.5 : this.camDist;
    const cx = target.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = target.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = target.y + Math.sin(this.camPitch) * dist + 1.2;
    camera.position.x = damp(camera.position.x, cx, 10, dt);
    camera.position.y = damp(camera.position.y, Math.max(cy, 1.2), 10, dt);
    camera.position.z = damp(camera.position.z, cz, 10, dt);
    camera.lookAt(target.x, target.y, target.z);
  }

  /** On-foot movement step. Returns nothing; reads input axes relative to camera. */
  updateOnFoot(dt, input) {
    if (this.inCar || this.dead) return;
    const axes = input.axes();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const maxSpeed = sprint ? 9.5 : 5.8;
    const wantX = Math.sin(this.camYaw) * axes.f - Math.cos(this.camYaw) * axes.s;
    const wantZ = Math.cos(this.camYaw) * axes.f + Math.sin(this.camYaw) * axes.s;
    const moving = Math.hypot(wantX, wantZ) > 0.1;
    if (moving) {
      const len = Math.hypot(wantX, wantZ);
      const tx = (wantX / len) * maxSpeed;
      const tz = (wantZ / len) * maxSpeed;
      this.x += tx * dt;
      this.z += tz * dt;
      this.heading = angleLerp(this.heading, Math.atan2(tx, tz), Math.min(1, dt * 12));
      this.speed = maxSpeed;
      this.walkPhase += dt * maxSpeed * 1.6;
    } else {
      this.speed = 0;
    }
    const hit = this.world.collideCircle(this.x, this.z, 0.55);
    this.x = hit.x; this.z = hit.z;
    this.x = clamp(this.x, -215, 215);
    this.z = clamp(this.z, -215, 245);
    // Walk-cycle animation.
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
  }

  /** Find the nearest car the player can enter (within 4 units). */
  nearestCar(cars) {
    let best = null, bestD = 4.5;
    for (const c of cars) {
      if (!c.alive) continue;
      const d = dist2D(this.x, this.z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  enterCar(car) {
    this.inCar = car;
    car.driver = 'player';
    this.mesh.visible = false;
    this.camYaw = car.heading; // camera looks along the car's nose
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    car.driver = null;
    car.speed = 0;
    this.inCar = null;
    // Step out to the car's left.
    this.x = car.x - Math.cos(car.heading) * 2.2;
    this.z = car.z + Math.sin(car.heading) * 2.2;
    const hit = this.world.collideCircle(this.x, this.z, 0.55);
    this.x = hit.x; this.z = hit.z;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.camYaw = car.heading;
  }

  hurt(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  /** Where the player is looking (for shooting): camera forward on the XZ plane. */
  aimDirection() {
    return { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
  }
}
