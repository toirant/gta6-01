// Solmar City — combat on foot: fists and a pistol with ammo.
// Hitscan shooting with a tracer line, muzzle flash and hit particles.

import { dist2D } from './util.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracer = null;
    this.tracerLife = 0;
    this.particles = []; // {mesh, vx, vy, vz, life}
    this.muzzle = null;
    this.muzzleLife = 0;
  }

  /** A short-lived line from the muzzle to the hit point. */
  showTracer(from, to) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.scene.add(this.tracer);
    this.tracerLife = 0.08;
  }

  showMuzzle(x, y, z) {
    if (this.muzzle) this.scene.remove(this.muzzle);
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd94d })
    );
    this.muzzle.position.set(x, y, z);
    this.scene.add(this.muzzle);
    this.muzzleLife = 0.05;
  }

  /** Burst of small cubes that fly out and fade. */
  burst(x, y, z, color, n) {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mat);
      m.position.set(x, y, z);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 2,
        vz: (Math.random() - 0.5) * 8,
        life: 0.5 + Math.random() * 0.3,
      });
    }
  }

  dust(x, y, z) { this.burst(x, y, z, 0xcbb98f, 4); }

  update(dt) {
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0 && this.tracer) {
        this.scene.remove(this.tracer);
        this.tracer.geometry.dispose();
        this.tracer = null;
      }
    }
    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      if (this.muzzleLife <= 0 && this.muzzle) {
        this.scene.remove(this.muzzle);
        this.muzzle = null;
      }
    }
    for (const p of [...this.particles]) {
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles = this.particles.filter((q) => q !== p);
        continue;
      }
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.05) p.mesh.position.y = 0.05;
      p.mesh.scale.setScalar(Math.max(0.05, p.life));
    }
  }

  /**
   * Fire the pistol from the player toward the camera aim direction.
   * Returns 'hit' | 'miss' | 'noammo'.
   */
  shoot(game) {
    const player = game.player;
    if (player.ammo <= 0) return 'noammo';
    if (player.shootCooldown > 0) return 'wait';
    player.shootCooldown = 0.28;
    player.ammo -= 1;
    const dir = player.aimDirection();
    const ox = player.x, oz = player.z, oy = 1.5;
    const range = 60;
    let hitAt = null, hitKind = null, hitObj = null;
    // Nearest pedestrian / officer / police car along the aim ray.
    const targets = [];
    for (const p of game.traffic.peds) if (p.alive) targets.push({ x: p.x, z: p.z, r: 1.0, kind: 'ped', obj: p });
    for (const o of game.police.officers) if (o.alive) targets.push({ x: o.x, z: o.z, r: 1.0, kind: 'officer', obj: o });
    for (const c of game.police.cars) targets.push({ x: c.x, z: c.z, r: 2.4, kind: 'policecar', obj: c });
    for (const t of game.traffic.cars) targets.push({ x: t.car.x, z: t.car.z, r: 2.4, kind: 'car', obj: t.car });
    let bestT = range;
    for (const t of targets) {
      const rx = t.x - ox, rz = t.z - oz;
      const along = rx * dir.x + rz * dir.z;
      if (along < 0 || along > range) continue;
      const perp = Math.abs(rx * dir.z - rz * dir.x);
      if (perp < t.r && along < bestT) {
        bestT = along; hitAt = { x: ox + dir.x * along, y: oy, z: oz + dir.z * along };
        hitKind = t.kind; hitObj = t.obj;
      }
    }
    const end = hitAt || { x: ox + dir.x * range, y: oy, z: oz + dir.z * range };
    this.showTracer({ x: ox, y: oy, z: oz }, end);
    this.showMuzzle(ox + dir.x * 1.2, oy, oz + dir.z * 1.2);
    game.audio.gunshot();
    game.shake(0.15);
    game.traffic.scare(ox, oz, 40);
    if (!hitAt) return 'miss';

    this.burst(end.x, end.y, end.z, 0xff5a3c, 8);
    if (hitKind === 'ped') {
      game.traffic.killPed(hitObj);
      game.police.addHeat(20, game);
      game.addCash(20, 'ped down');
    } else if (hitKind === 'officer') {
      hitObj.alive = false;
      hitObj.mesh.rotation.x = -Math.PI / 2;
      hitObj.mesh.position.y = 0.3;
      game.police.addHeat(30, game);
    } else if (hitKind === 'policecar' || hitKind === 'car') {
      hitObj.damage(34);
      if (!hitObj.alive) {
        this.burst(hitObj.x, 1, hitObj.z, 0xff8a3c, 14);
        game.audio.crash();
      }
      game.police.addHeat(15, game);
    }
    return 'hit';
  }

  /** A close-range punch: hits the nearest ped or officer in front. */
  punch(game) {
    const player = game.player;
    if (player.punchCooldown > 0) return false;
    player.punchCooldown = 0.45;
    const dir = player.aimDirection();
    const px = player.x + dir.x * 1.2, pz = player.z + dir.z * 1.2;
    game.audio.punch();
    let hit = false;
    for (const p of game.traffic.peds) {
      if (p.alive && dist2D(px, pz, p.x, p.z) < 1.4) {
        game.traffic.killPed(p);
        game.police.addHeat(15, game);
        game.addCash(15, 'ped down');
        this.burst(p.x, 1.2, p.z, 0xffe9a8, 6);
        hit = true;
      }
    }
    for (const o of game.police.officers) {
      if (o.alive && dist2D(px, pz, o.x, o.z) < 1.4) {
        o.alive = false;
        o.mesh.rotation.x = -Math.PI / 2;
        o.mesh.position.y = 0.3;
        game.police.addHeat(20, game);
        this.burst(o.x, 1.2, o.z, 0xffe9a8, 6);
        hit = true;
      }
    }
    if (!hit) game.traffic.scare(player.x, player.z, 12);
    return hit;
  }
}
