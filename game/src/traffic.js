// traffic.js — ambient traffic cars and pedestrians moving through Solmar City.
window.G = window.G || {};
(function () {
  var G = window.G;
  var PED_SHIRTS = [0xe8e6d0, 0x5fa8a8, 0xd9a05f, 0x9a7fb8, 0x7fb87a, 0xc25e6e];
  G.traffic = {
    peds: [],
    spawn: function (scene) {
      var roads = G.world.roads;
      var self = this;
      for (var i = 0; i < 10; i++) {
        var road = roads[G.randInt(0, roads.length - 1)];
        var along = G.rand(-190, 190);
        var horizontal = Math.random() < 0.5;
        var x = horizontal ? along : road;
        var z = horizontal ? road : along;
        var car = G.vehicles.create(scene, G.pick(G.vehicles.defs), x, z, horizontal ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI), { driver: "traffic" });
        car.speed = G.rand(7, 12);
        car.traffic = true;
      }
      for (var j = 0; j < 16; j++) {
        var pr = roads[G.randInt(0, roads.length - 1)];
        var pa = G.rand(-190, 190);
        var horiz = Math.random() < 0.5;
        var px = horiz ? pa : pr + (Math.random() < 0.5 ? 8 : -8);
        var pz = horiz ? pr + (Math.random() < 0.5 ? 8 : -8) : pa;
        var mesh = G.makePersonMesh(G.pick(PED_SHIRTS), G.pick([0x2c3e50, 0x5c4a3a, 0x3a3a3a]), G.pick([0xe8b98a, 0xc98a5f, 0x8a5f3a]));
        mesh.position.set(px, 0, pz);
        scene.add(mesh);
        this.peds.push({
          mesh: mesh, pos: new THREE.Vector3(px, 0, pz),
          heading: G.rand(0, Math.PI * 2), speed: G.rand(1.2, 2.2),
          phase: G.rand(0, 6), alive: true, scared: 0, health: 50
        });
      }
    },
    update: function (dt) {
      var p = G.player;
      // Traffic cars keep rolling; the ones the player drives are handled elsewhere.
      G.vehicles.cars.forEach(function (car) {
        if (!car.traffic) return;
        if (car.driver === "player") return;
        // Slow down if the player's car is right ahead.
        var ahead = false;
        if (p.inCar) {
          var d = G.dist2d(car.pos.x, car.pos.z, p.inCar.pos.x, p.inCar.pos.z);
          if (d < 9) ahead = true;
        }
        var target = ahead ? 0 : G.rand(0, 0); // base speed stored below
        if (car._baseSpeed === undefined) car._baseSpeed = car.speed;
        car.speed = G.lerp(car.speed, ahead ? 0 : car._baseSpeed, 1 - Math.exp(-3 * dt));
        G.vehicles.updateTrafficCar(car, dt);
      });
      // Pedestrians wander the sidewalks; they flee from the player when scared.
      this.peds.forEach(function (ped) {
        if (!ped.alive) return;
        var dPlayer = G.dist2d(ped.pos.x, ped.pos.z, p.pos.x, p.pos.z);
        if (dPlayer < 6 && (p.inCar || G.state.time - (ped._lastScare || 0) > 1)) ped.scared = 2.5;
        var speed = ped.speed * (ped.scared > 0 ? 3.2 : 1);
        if (ped.scared > 0) {
          ped.scared -= dt;
          ped.heading = G.angleTo(p.pos.x, p.pos.z, ped.pos.x, ped.pos.z);
        } else if (Math.random() < dt * 0.08) {
          ped.heading += G.rand(-1.2, 1.2);
        }
        ped.pos.x += Math.sin(ped.heading) * speed * dt;
        ped.pos.z += Math.cos(ped.heading) * speed * dt;
        if (Math.abs(ped.pos.x) > 205 || Math.abs(ped.pos.z) > 260) ped.heading += Math.PI;
        G.world.collide(ped.pos, 0.6);
        ped.mesh.position.copy(ped.pos);
        ped.mesh.rotation.y = ped.heading;
        ped.phase += dt * speed * 2.4;
        var swing = Math.sin(ped.phase) * 0.5;
        ped.mesh.userData.armL.rotation.x = swing;
        ped.mesh.userData.armR.rotation.x = -swing;
      });
    },
    nearestPed: function (x, z, maxDist) {
      var best = null, bd = maxDist;
      this.peds.forEach(function (ped) {
        if (!ped.alive) return;
        var d = G.dist2d(x, z, ped.pos.x, ped.pos.z);
        if (d < bd) { bd = d; best = ped; }
      });
      return best;
    }
  };
})();
