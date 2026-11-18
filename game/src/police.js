// police.js — the wanted system: stars, patrol cars and officers who chase and arrest.
window.G = window.G || {};
(function () {
  var G = window.G;
  G.police = {
    cars: [],
    officers: [],
    calmTimer: 0,
    addHeat: function (stars, reason) {
      var st = G.state;
      if (st.mode !== "play") return;
      st.wanted = G.clamp(st.wanted + stars, 0, 5);
      this.calmTimer = 0;
      if (st.wanted > 0) G.audio.setSiren(true);
      G.hud.toast(reason ? ("Wanted level " + st.wanted + " — " + reason) : ("Wanted level " + st.wanted));
    },
    update: function (dt) {
      var st = G.state;
      var p = G.player;
      // Wanted decays when the player lays low: no crime, no police nearby.
      if (st.wanted > 0) {
        this.calmTimer += dt;
        var nearest = 999;
        this.cars.forEach(function (c) { nearest = Math.min(nearest, G.dist2d(c.pos.x, c.pos.z, p.pos.x, p.pos.z)); });
        this.officers.forEach(function (o) { if (o.alive) nearest = Math.min(nearest, G.dist2d(o.pos.x, o.pos.z, p.pos.x, p.pos.z)); });
        if (this.calmTimer > 14 && nearest > 55) {
          st.wanted -= 1;
          this.calmTimer = 0;
          G.hud.toast(st.wanted > 0 ? "Heat dying down… wanted level " + st.wanted : "You lost them. The heat is off.");
          if (st.wanted <= 0) G.audio.setSiren(false);
        }
      }
      // Keep enough patrol cars for the wanted level.
      var want = st.wanted >= 4 ? 3 : st.wanted >= 2 ? 2 : st.wanted >= 1 ? 1 : 0;
      while (this.cars.length < want) this.spawnCar();
      while (this.cars.length > want && this.cars.length > 0) this.removeCar(this.cars[this.cars.length - 1]);
      // Chase behaviour.
      var self = this;
      this.cars.forEach(function (car) { self.updateChaseCar(car, dt); });
      this.officers.forEach(function (off) { self.updateOfficer(off, dt); });
      // Officers on foot appear when the player is on foot and wanted.
      if (st.wanted >= 1 && !p.inCar && this.officers.filter(function (o) { return o.alive; }).length < Math.min(st.wanted, 3)) {
        this.spawnOfficer();
      }
    },
    spawnCar: function () {
      var p = G.player;
      var a = G.rand(0, Math.PI * 2);
      var x = G.clamp(p.pos.x + Math.sin(a) * 55, -200, 200);
      var z = G.clamp(p.pos.z + Math.cos(a) * 55, -200, 200);
      var car = G.vehicles.create(G.scene, G.vehicles.defs[0], x, z, G.angleTo(x, z, p.pos.x, p.pos.z), { police: true, driver: "police" });
      car.speed = 0;
      this.cars.push(car);
      return car;
    },
    removeCar: function (car) {
      var i = this.cars.indexOf(car);
      if (i >= 0) this.cars.splice(i, 1);
      var vi = G.vehicles.cars.indexOf(car);
      if (vi >= 0) G.vehicles.cars.splice(vi, 1);
      if (G.scene) G.scene.remove(car.mesh);
    },
    updateChaseCar: function (car, dt) {
      var p = G.player;
      var targetHeading = G.angleTo(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
      var topSpeed = 26 + G.state.wanted * 3.5;
      car.heading = G.turnToward(car.heading, targetHeading, 2.6 * dt);
      car.speed = G.lerp(car.speed, topSpeed, 1 - Math.exp(-1.4 * dt));
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      if (G.world.collide(car.pos, 1.6)) car.speed *= 0.5;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      if (car.mesh.userData.lightBar) car.mesh.userData.lightBar.material.color.setHex(Math.floor(G.state.time * 4) % 2 ? 0xff2222 : 0x2244ff);
      // Ram the player's car.
      if (p.inCar) {
        var d = G.dist2d(car.pos.x, car.pos.z, p.inCar.pos.x, p.inCar.pos.z);
        if (d < 3.4) {
          p.inCar.speed *= 0.55;
          car.speed *= 0.4;
          if (Math.random() < dt * 3) { G.audio.crash(); p.damage(2, "rammed"); }
        }
      } else {
        var d2 = G.dist2d(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
        if (d2 < 3.2 && Math.abs(car.speed) > 4) p.damage(6 * dt * 3, "hit by a patrol car");
      }
    },
    spawnOfficer: function () {
      var p = G.player;
      var a = G.rand(0, Math.PI * 2);
      var x = G.clamp(p.pos.x + Math.sin(a) * 22, -200, 200);
      var z = G.clamp(p.pos.z + Math.cos(a) * 22, -200, 200);
      var mesh = G.makePersonMesh(0x1e2a32, 0x1e2a32, 0xc98a5f);
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      var off = { mesh: mesh, pos: new THREE.Vector3(x, 0, z), heading: 0, speed: 0, alive: true, health: 60, attackCd: 0, phase: 0 };
      this.officers.push(off);
      return off;
    },
    updateOfficer: function (off, dt) {
      if (!off.alive) return;
      var p = G.player;
      var d = G.dist2d(off.pos.x, off.pos.z, p.pos.x, p.pos.z);
      if (p.inCar || G.state.wanted <= 0) {
        // Officer gives up the chase and jogs back toward the road.
        off.speed = G.lerp(off.speed, 0, dt * 2);
        return;
      }
      off.heading = G.turnToward(off.heading, G.angleTo(off.pos.x, off.pos.z, p.pos.x, p.pos.z), 6 * dt);
      off.speed = d > 2.2 ? 6.4 : 0;
      off.pos.x += Math.sin(off.heading) * off.speed * dt;
      off.pos.z += Math.cos(off.heading) * off.speed * dt;
      G.world.collide(off.pos, 0.6);
      off.mesh.position.copy(off.pos);
      off.mesh.rotation.y = off.heading;
      off.phase += dt * off.speed * 2;
      off.mesh.userData.armL.rotation.x = Math.sin(off.phase) * 0.6;
      off.mesh.userData.armR.rotation.x = -Math.sin(off.phase) * 0.6;
      off.attackCd -= dt;
      if (d < 2.4 && off.attackCd <= 0) {
        off.attackCd = 0.9;
        p.damage(8, "arrested");
        G.audio.punch();
        G.hud.toast("An officer is beating you down!");
        if (p.health <= 35) {
          // Busted when health is nearly gone and an officer is on top of you.
          if (d < 2.0 && p.health <= 12) G.gameOver("busted");
        }
      }
    },
    clearAll: function () {
      var self = this;
      this.cars.slice().forEach(function (c) { self.removeCar(c); });
      this.officers.forEach(function (o) { if (G.scene) G.scene.remove(o.mesh); });
      this.officers = [];
      G.audio.setSiren(false);
    }
  };
})();
