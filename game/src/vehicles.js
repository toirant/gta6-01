// Solmar City — cars: the model builder and arcade driving physics.
// One car is a group of boxes; driving is speed + steering with drift and skid.

import { clamp, damp, angleLerp } from './util.js';

export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222226, 0x8a5fc2, 0xe07b28];

/** Build a simple boxy car. `police` gives it a black-and-white cruiser look. */
export function buildCarMesh(color, police) {
  const g = new THREE.Group();
  const bodyColor = police ? 0x1c1e22 : color;
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (police) {
    const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.34, 2.4), white);
    doors.position.set(0, 0.62, -0.1);
    g.add(doors);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.3), barMat);
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  g.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    g.userData.wheels.push(w);
  }
  // Headlights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), lightMat);
    l.position.set(sx, 0.6, 2.21);
    g.add(l);
  }
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, police) {
    this.scene = scene;
    this.mesh = buildCarMesh(color, police);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;          // signed, units per second
    this.steer = 0;          // -1..1
    this.police = !!police;
    this.driver = null;      // 'player' | 'traffic' | 'police' | null (parked)
    this.alive = true;
    this.health = 100;
    this.skidding = false;
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  /** Arcade driving step: throttle -1..1, steer -1..1. */
  drive(dt, throttle, steerInput) {
    const maxFwd = this.police ? 34 : 30;
    const maxRev = 12;
    const accel = 22;
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) this.speed += accel * throttle * dt * 0.9;
    else this.speed = damp(this.speed, 0, 1.2, dt);
    // Rolling drag and speed caps.
    this.speed -= this.speed * 0.25 * dt;
    this.speed = clamp(this.speed, -maxRev, maxFwd);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;

    this.steer = damp(this.steer, steerInput, 8, dt);
    const turnRate = this.steer * 1.9 * clamp(Math.abs(this.speed) / 8, 0, 1) * Math.sign(this.speed || 1);
    this.heading += turnRate * dt;
    this.skidding = Math.abs(this.steer) > 0.7 && Math.abs(this.speed) > 16;

    const f = this.forward;
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Lean into turns, wheels spin.
    this.mesh.rotation.z = -this.steer * 0.05 * clamp(Math.abs(this.speed) / 20, 0, 1);
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.rotation.z = 0.12; // wrecked tilt
    }
  }

  remove() { this.scene.remove(this.mesh); }
}
