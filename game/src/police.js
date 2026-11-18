// Solmar City — the wanted system: heat, stars, police cars and officers.
// The Solmar PD responds to crimes, chases, and gives up when you lay low.

import { clamp, dist2D, angleDiff } from './util.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.heat = 0;                 // 0..100
    this.cars = [];                // pursuing police Cars
    this.officers = [];            // on-foot officers {mesh,x,z,heading,cooldown}
    this.lastCrimeAt = -999;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.sirenTimer = 0;
    this.onBusted = null;
  }

  get stars() {
    if (this.heat >= 85) return 5;
    if (this.heat >= 65) return 4;
    if (this.heat >= 45) return 3;
    if (this.heat >= 25) return 2;
    if (this.heat > 0) return 1;
    return 0;
  }

  addHeat(amount, game) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.lastCrimeAt = game.time;
  }

  /** Spawn a police car ahead of the player, on a nearby road. */
  spawnCarNear(px, pz, dist) {
    const a = this.rng() * Math.PI * 2;
    const d = dist !== undefined ? dist : 55 + this.rng() * 30;
    let x = px + Math.sin(a) * d;
    let z = pz + Math.cos(a) * d;
    x = clamp(x, -190, 190); z = clamp(z, -190, 210);
    const car = new Car(this.scene, x, z, Math.atan2(px - x, pz - z), 0x111111, true);
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(px, pz) {
    const a = this.rng() * Math.PI * 2;
    const x = clamp(px + Math.sin(a) * 18, -200, 200);
    const z = clamp(pz + Math.cos(a) * 18, -200, 220);
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), navy);
    body.position.y = 1.1; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
    head.position.y = 1.68;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), navy);
    cap.position.y = 1.9;
    g.add(cap);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.officers.push({ mesh: g, x, z, heading: 0, cooldown: 0, alive: true });
  }

  removeOfficer(o) {
    this.scene.remove(o.mesh);
    this.officers = this.officers.filter((x) => x !== o);
  }

  update(dt, game) {
    const player = game.player;
    const px = player.x, pz = player.z;
    const time = game.time;
    const stars = this.stars;

    // Wanted decays when the player has been quiet and no police is close.
    let nearestPolice = Infinity;
    for (const c of this.cars) nearestPolice = Math.min(nearestPolice, dist2D(px, pz, c.x, c.z));
    for (const o of this.officers) nearestPolice = Math.min(nearestPolice, dist2D(px, pz, o.x, o.z));
    if (stars > 0 && time - this.lastCrimeAt > 12 && nearestPolice > 55) {
      this.heat = Math.max(0, this.heat - 3.5 * dt);
    }

    // Keep the pursuit sized to the wanted level.
    const wantCars = Math.min(stars, 4);
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnCarNear(px, pz);
      this.spawnTimer = 4;
    }
    if (stars === 0) {
      // Stand down: police cars drive off and despawn far away.
      for (const c of [...this.cars]) {
        if (dist2D(px, pz, c.x, c.z) > 90) {
          c.remove();
          this.cars = this.cars.filter((x) => x !== c);
        }
      }
      for (const o of [...this.officers]) this.removeOfficer(o);
    }
    if (stars >= 2 && this.officers.length < stars - 1 && this.spawnTimer <= 0 && !player.inCar) {
      this.spawnOfficerNear(px, pz);
      this.spawnTimer = 5;
    }

    // Siren wail every couple of seconds while wanted.
    this.sirenTimer -= dt;
    if (stars > 0 && this.sirenTimer <= 0) {
      game.audio.sirenBlip();
      this.sirenTimer = 2.2;
    }

    // Police cars chase: steer toward the player, ram on contact.
    for (const c of this.cars) {
      const d = dist2D(px, pz, c.x, c.z);
      const wantHeading = Math.atan2(px - c.x, pz - c.z);
      const steer = clamp(angleDiff(c.heading, wantHeading) * 1.6, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      c.drive(dt, throttle, steer);
      const hit = this.world.collideCircle(c.x, c.z, 2.2);
      c.x = hit.x; c.z = hit.z;
      c.mesh.position.set(c.x, 0, c.z);
      // Ram the player's car or the player.
      if (player.inCar) {
        const pd = dist2D(c.x, c.z, player.inCar.x, player.inCar.z);
        if (pd < 4.2) {
          player.inCar.damage(12 * dt);
          player.inCar.speed *= 0.96;
          game.shake(0.25);
          game.audio.crash();
        }
      } else if (d < 3.2) {
        // Caught on foot: busted after a short grapple.
        this.bustedTimer += dt;
        player.hurt(6 * dt);
        if (this.bustedTimer > 1.6 && this.onBusted) this.onBusted();
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
      // Flash the light bar.
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(
          Math.floor(time * 4) % 2 === 0 ? 0xff2a2a : 0x2a5bff
        );
      }
    }

    // Officers chase on foot and punch.
    for (const o of [...this.officers]) {
      if (!o.alive) continue;
      o.cooldown = Math.max(0, o.cooldown - dt);
      const d = dist2D(px, pz, o.x, o.z);
      if (player.inCar || d > 120) { this.removeOfficer(o); continue; }
      o.heading = Math.atan2(px - o.x, pz - o.z);
      const speed = d > 2 ? 6.5 : 0;
      o.x += Math.sin(o.heading) * speed * dt;
      o.z += Math.cos(o.heading) * speed * dt;
      const hit = this.world.collideCircle(o.x, o.z, 0.5);
      o.x = hit.x; o.z = hit.z;
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
      if (d < 1.6 && o.cooldown <= 0) {
        player.hurt(8);
        game.shake(0.4);
        game.audio.punch();
        o.cooldown = 0.9;
      }
    }
  }
}
