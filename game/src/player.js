// player.js — Mara Voss on foot: third-person movement, camera and car entry.
window.G = window.G || {};
(function () {
  var G = window.G;
  function makePersonMesh(shirt, pants, skin) {
    var g = new THREE.Group();
    var mat = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), mat(pants));
    legs.position.y = 0.4; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.85, 0.4), mat(shirt));
    torso.position.y = 1.22; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(skin));
    head.position.y = 1.95; g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0x2b1d12));
    hair.position.y = 2.0; g.add(hair);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), mat(shirt));
    armL.position.set(-0.52, 1.2, 0); g.add(armL);
    var armR = armL.clone(); armR.position.x = 0.52; g.add(armR);
    g.userData.armL = armL; g.userData.armR = armR;
    return g;
  }
  G.makePersonMesh = makePersonMesh;
  G.player = {
    mesh: null, pos: null, heading: 0, camYaw: 0, camPitch: 0.32,
    speed: 0, inCar: null, walkPhase: 0, health: 100,
    create: function (scene) {
      this.mesh = makePersonMesh(0xd94f3d, 0x2c3e50, 0xe8b98a);
      this.pos = new THREE.Vector3(0, 0, 168);
      this.heading = Math.PI;
      this.mesh.position.copy(this.pos);
      scene.add(this.mesh);
      return this.mesh;
    },
    reset: function (x, z, heading) {
      this.pos.set(x, 0, z);
      this.heading = heading === undefined ? Math.PI : heading;
      this.camYaw = this.heading;
      this.inCar = null;
      this.health = 100;
      if (this.mesh) { this.mesh.position.copy(this.pos); this.mesh.visible = true; }
    },
    update: function (dt, camera) {
      var st = G.state;
      var m = G.input.takeMouse();
      this.camYaw -= m.dx * 0.0032;
      this.camPitch = G.clamp(this.camPitch + m.dy * 0.0024, 0.08, 1.1);
      if (this.inCar) { this.updateCamera(camera, dt); return; }
      var ax = G.input.axis();
      var run = G.input.down("ShiftLeft") || G.input.down("ShiftRight");
      var maxSpeed = run ? 9.5 : 5.2;
      var moving = (ax.x !== 0 || ax.z !== 0);
      var targetSpeed = moving ? maxSpeed : 0;
      this.speed = G.lerp(this.speed, targetSpeed, 1 - Math.exp(-10 * dt));
      if (moving) {
        var fwdX = Math.sin(this.camYaw), fwdZ = Math.cos(this.camYaw);
        var rightX = Math.cos(this.camYaw), rightZ = -Math.sin(this.camYaw);
        var mx = fwdX * -ax.z + rightX * ax.x;
        var mz = fwdZ * -ax.z + rightZ * ax.x;
        var len = Math.sqrt(mx * mx + mz * mz) || 1;
        mx /= len; mz /= len;
        this.pos.x += mx * this.speed * dt;
        this.pos.z += mz * this.speed * dt;
        this.heading = G.turnToward(this.heading, Math.atan2(mx, mz), 10 * dt);
        this.walkPhase += dt * this.speed * 1.6;
      }
      G.world.collide(this.pos, 0.7);
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.heading;
      var swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
      this.mesh.userData.armL.rotation.x = swing;
      this.mesh.userData.armR.rotation.x = -swing;
      this.updateCamera(camera, dt);
      if (G.input.down("KeyE")) this.tryEnterCar();
    },
    updateCamera: function (camera, dt) {
      var anchor;
      if (this.inCar) {
        anchor = this.inCar.mesh.position;
      } else {
        anchor = this.pos;
      }
      var dist = this.inCar ? 11 : 8.5;
      var height = this.inCar ? 4.2 : 3.6;
      var cx = anchor.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
      var cz = anchor.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
      var cy = (this.inCar ? 1.2 : 1.8) + Math.sin(this.camPitch) * dist * 0.9 + height - 3;
      var tx = anchor.x, ty = (this.inCar ? 1.4 : 1.7), tz = anchor.z;
      camera.position.x = G.lerp(camera.position.x, cx, 1 - Math.exp(-14 * dt));
      camera.position.y = G.lerp(camera.position.y, Math.max(cy, 1.2), 1 - Math.exp(-14 * dt));
      camera.position.z = G.lerp(camera.position.z, cz, 1 - Math.exp(-14 * dt));
      camera.lookAt(tx, ty, tz);
    },
    tryEnterCar: function () {
      if (this.inCar) return;
      var now = G.state.time;
      if (this._lastEnter && now - this._lastEnter < 0.4) return;
      this._lastEnter = now;
      var car = G.vehicles.nearestCar(this.pos.x, this.pos.z, 4.5);
      if (!car) return;
      this.enterCar(car);
    },
    enterCar: function (car) {
      if (car.police) {
        G.hud.toast("That's a police car — the doors are locked.");
        return;
      }
      this.inCar = car;
      car.driver = "player";
      this.mesh.visible = false;
      if (!car.stolen && car.parked) {
        car.stolen = true;
        G.police.addHeat(1, "car theft");
        G.hud.toast("You took the " + car.name + ". The city noticed.");
      } else if (!car.stolen) {
        car.stolen = true;
        G.police.addHeat(1, "carjacking");
        G.hud.toast("You yanked the driver out of the " + car.name + "!");
      }
      G.audio.click();
    },
    exitCar: function () {
      if (!this.inCar) return;
      var car = this.inCar;
      car.driver = null;
      this.inCar = null;
      var sx = Math.sin(this.heading + Math.PI / 2), sz = Math.cos(this.heading + Math.PI / 2);
      this.pos.set(car.mesh.position.x + sx * 2.4, 0, car.mesh.position.z + sz * 2.4);
      this.mesh.visible = true;
      this.mesh.position.copy(this.pos);
      this._lastEnter = G.state.time;
    },
    damage: function (amount, cause) {
      if (G.state.mode !== "play") return;
      this.health = Math.max(0, this.health - amount);
      if (this.health <= 0) G.gameOver(cause || "dead");
    }
  };
})();
