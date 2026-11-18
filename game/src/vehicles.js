// vehicles.js — car factory and driving physics for Solmar City.
window.G = window.G || {};
(function () {
  var G = window.G;
  var CAR_DEFS = [
    { name: "Solmar Sprint", color: 0xd94f3d, speed: 34, accel: 16 },
    { name: "Palm Cruiser", color: 0x2f7fb8, speed: 30, accel: 13 },
    { name: "Sunset Coupe", color: 0xe8a13d, speed: 38, accel: 18 },
    { name: "Harbor Van", color: 0x7a8a7a, speed: 26, accel: 11 },
    { name: "Marina GT", color: 0x8a4fd9, speed: 40, accel: 19 },
    { name: "Beach Buggy", color: 0x2f9e5f, speed: 28, accel: 14 }
  ];
  function buildCarMesh(color, police) {
    var g = new THREE.Group();
    var mat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), mat(police ? 0x1e2a32 : color));
    body.position.y = 0.65; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.2), mat(police ? 0xf2f2f2 : 0x222a30));
    cabin.position.set(0, 1.28, -0.25); g.add(cabin);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 4.42), mat(police ? 0xffffff : 0x111111));
    stripe.position.y = 0.85; g.add(stripe);
    if (police) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      bar.position.set(0, 1.68, -0.25); g.add(bar);
      g.userData.lightBar = bar;
    }
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
    var wheelMat = mat(0x14181c);
    [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.38, p[1]);
      g.add(w);
    });
    var head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    head.position.set(0, 0.7, 2.22); g.add(head);
    return g;
  }
  G.vehicles = {
    defs: CAR_DEFS,
    cars: [],
    create: function (scene, def, x, z, heading, opts) {
      opts = opts || {};
      var car = {
        def: def, name: def.name, mesh: buildCarMesh(def.color, opts.police),
        pos: new THREE.Vector3(x, 0, z), heading: heading || 0,
        speed: 0, driver: opts.driver || null, parked: !!opts.parked,
        stolen: false, police: !!opts.police, health: 100,
        wheelSpin: 0
      };
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      scene.add(car.mesh);
      this.cars.push(car);
      return car;
    },
    spawnParked: function (scene) {
      var spots = [
        [6, -54, 0], [-6, 54, Math.PI], [66, -6, Math.PI / 2], [-66, 6, -Math.PI / 2],
        [126, 54, 0], [-126, -54, Math.PI], [6, 126, 0], [186, -6, Math.PI / 2],
        [-186, 66, -Math.PI / 2], [54, 186, Math.PI], [-54, -126, 0], [186, 126, Math.PI]
      ];
      var self = this;
      spots.forEach(function (s, i) {
        self.create(scene, CAR_DEFS[i % CAR_DEFS.length], s[0], s[1], s[2], { parked: true });
      });
    },
    nearestCar: function (x, z, maxDist) {
      var best = null, bd = maxDist;
      this.cars.forEach(function (c) {
        var d = G.dist2d(x, z, c.mesh.position.x, c.mesh.position.z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    },
    updatePlayerCar: function (dt, camera) {
      var p = G.player, car = p.inCar;
      if (!car) return;
      var m = G.input.takeMouse();
      p.camYaw -= m.dx * 0.0032;
      p.camPitch = G.clamp(p.camPitch + m.dy * 0.0024, 0.08, 1.1);
      var ax = G.input.axis();
      if (G.shots && G.shots.cruise) ax = { x: 0, z: -1 };
      var target = 0;
      if (ax.z < 0) target = car.def.speed;
      else if (ax.z > 0) target = -car.def.speed * 0.45;
      var accel = car.def.accel;
      if (ax.z === 0) {
        car.speed = G.lerp(car.speed, 0, 1 - Math.exp(-1.6 * dt));
      } else {
        car.speed = G.lerp(car.speed, target, 1 - Math.exp(-accel / car.def.speed * 2.2 * dt));
      }
      var steer = 0;
      if (Math.abs(car.speed) > 0.5) {
        steer = ax.x * (car.speed >= 0 ? 1 : -1) * G.clamp(Math.abs(car.speed) / 12, 0.35, 1);
        car.heading += steer * 1.55 * dt;
      }
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      if (G.world.collide(car.pos, 1.6)) {
        if (Math.abs(car.speed) > 8) { G.audio.crash(); G.hud.toast("Crash!"); }
        car.speed *= 0.4;
      }
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
      p.pos.copy(car.pos);
      p.heading = car.heading;
      p.camYaw = G.turnToward(p.camYaw, car.heading, 6 * dt);
      if (G.input.down("KeyE")) {
        var now = G.state.time;
        if (!p._lastExit || now - p._lastExit > 0.4) { p._lastExit = now; p.exitCar(); }
      }
      G.audio.setEngine(true, Math.abs(car.speed) / car.def.speed);
      p.updateCamera(camera, dt);
    },
    updateTrafficCar: function (car, dt) {
      // Simple road-following: move forward, wrap at city edge, nudge around obstacles.
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      if (Math.abs(car.pos.x) > 205 || Math.abs(car.pos.z) > 205) {
        car.heading += Math.PI;
        car.pos.x = G.clamp(car.pos.x, -200, 200);
        car.pos.z = G.clamp(car.pos.z, -200, 200);
      }
      G.world.collide(car.pos, 1.6);
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;
    }
  };
})();
