// combat.js — punching and pistol combat on foot, with ammo and health.
window.G = window.G || {};
(function () {
  var G = window.G;
  var tracer = null, tracerUntil = 0;
  G.combat = {
    punchCooldown: 0,
    shootCooldown: 0,
    init: function (scene) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
      tracer.visible = false;
      scene.add(tracer);
    },
    update: function (dt) {
      this.punchCooldown = Math.max(0, this.punchCooldown - dt);
      this.shootCooldown = Math.max(0, this.shootCooldown - dt);
      if (tracer && tracer.visible && G.state.time > tracerUntil) tracer.visible = false;
    },
    punch: function () {
      if (G.state.mode !== "play" || G.player.inCar) return;
      if (this.punchCooldown > 0) return;
      this.punchCooldown = 0.45;
      G.audio.punch();
      var p = G.player;
      var fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      var hx = p.pos.x + fx * 1.6, hz = p.pos.z + fz * 1.6;
      var ped = G.traffic.nearestPed(hx, hz, 2.2);
      if (ped) {
        ped.health -= 25;
        ped.scared = 3;
        G.police.addHeat(1, "assault");
        G.hud.toast("You decked a pedestrian!");
        if (ped.health <= 0) { ped.alive = false; ped.mesh.visible = false; G.police.addHeat(1, "someone is down"); }
        return;
      }
      var off = null, bd = 2.2;
      G.police.officers.forEach(function (o) {
        if (!o.alive) return;
        var d = G.dist2d(hx, hz, o.pos.x, o.pos.z);
        if (d < bd) { bd = d; off = o; }
      });
      if (off) {
        off.health -= 25;
        G.police.addHeat(1, "assaulting an officer");
        if (off.health <= 0) { off.alive = false; off.mesh.visible = false; G.police.addHeat(1, "officer down"); }
      }
    },
    shoot: function () {
      var st = G.state;
      if (st.mode !== "play" || G.player.inCar) return;
      if (this.shootCooldown > 0) return;
      if (st.ammo <= 0) { G.hud.toast("Out of ammo — find trouble another way."); this.shootCooldown = 0.3; return; }
      this.shootCooldown = 0.28;
      st.ammo -= 1;
      G.audio.gunshot();
      var p = G.player;
      var fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
      // The shot travels from Mara toward the camera's aim; hit the nearest
      // target inside a cone in front of her.
      var ox = p.pos.x, oz = p.pos.z;
      var best = null, bestScore = 1e9, bestKind = null;
      function consider(tx, tz, obj, kind) {
        var dx = tx - ox, dz = tz - oz;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 55 || dist < 0.5) return;
        var dot = (dx * fx + dz * fz) / dist;
        if (dot < 0.82) return;
        var score = dist + (1 - dot) * 30;
        if (score < bestScore) { bestScore = score; best = obj; bestKind = kind; }
      }
      G.traffic.peds.forEach(function (ped) { if (ped.alive) consider(ped.pos.x, ped.pos.z, ped, "ped"); });
      G.police.officers.forEach(function (o) { if (o.alive) consider(o.pos.x, o.pos.z, o, "officer"); });
      G.vehicles.cars.forEach(function (car) {
        if (car.driver === "player" || car === p.inCar) return;
        consider(car.pos.x, car.pos.z, car, "car");
      });
      var endX = ox + fx * 55, endZ = oz + fz * 55;
      if (best) {
        endX = best.pos ? best.pos.x : best.mesh.position.x;
        endZ = best.pos ? best.pos.z : best.mesh.position.z;
        if (bestKind === "ped") {
          best.health -= 34; best.scared = 4;
          G.police.addHeat(2, "shots fired");
          if (best.health <= 0) { best.alive = false; best.mesh.visible = false; }
        } else if (bestKind === "officer") {
          best.health -= 34;
          G.police.addHeat(2, "shooting at police");
          if (best.health <= 0) { best.alive = false; best.mesh.visible = false; }
        } else if (bestKind === "car") {
          best.health -= 25;
          if (best.health <= 0 && best.driver === "courier") { best.speed = 0; G.hud.toast("The courier's car is wrecked!"); }
        }
      }
      if (tracer) {
        var pos = tracer.geometry.attributes.position.array;
        pos[0] = ox; pos[1] = 1.5; pos[2] = oz;
        pos[3] = endX; pos[4] = 1.5; pos[5] = endZ;
        tracer.geometry.attributes.position.needsUpdate = true;
        tracer.visible = true;
        tracerUntil = G.state.time + 0.08;
      }
    }
  };
  G.tryShoot = function () { G.combat.shoot(); };
  G.onPunchKey = function () { G.combat.punch(); };
})();
