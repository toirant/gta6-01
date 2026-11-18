// missions.js — the three story jobs of Solmar City, with markers, payouts and payoffs.
window.G = window.G || {};
(function () {
  var G = window.G;
  var MISSION_DEFS = [
    {
      id: 1, name: "Harbor Handoff", pay: 500,
      intro: "Rico needs a package moved off the marina before the tide turns. Grab it, then run it to his garage.",
      stages: [
        { text: "Pick up the package at Solmar Marina", hint: "Follow the yellow marker to the docks", target: "marina", radius: 7 },
        { text: "Deliver the package to Rico's Garage", hint: "Drive it — the streets are faster than your feet", target: "garage", radius: 8 }
      ]
    },
    {
      id: 2, name: "Courier Chase", pay: 800,
      intro: "A rival courier lifted Rico's briefcase and is running it across town in a Sunset Coupe. Run him down, take the case, bring it to the depot.",
      stages: [
        { text: "Chase down the courier's Sunset Coupe", hint: "Get close and ram him, or shoot out his nerve — he stops when scared", target: "courier", radius: 6 },
        { text: "Grab the briefcase and take it to the Courier Depot", hint: "Watch for patrols — the case is hot", target: "depot", radius: 7 }
      ]
    },
    {
      id: 3, name: "Dragnet Escape", pay: 1200,
      intro: "The Solmar PD has had enough of Mara Voss. A dragnet is closing in — survive it and reach the safehouse.",
      stages: [
        { text: "Survive the dragnet — stay alive for 90 seconds", hint: "Keep moving. A car helps. The safehouse opens when the timer ends", target: "survive", radius: 0, seconds: 90 },
        { text: "Reach the Safehouse", hint: "The dragnet is thinning — go now", target: "safehouse", radius: 8 }
      ]
    }
  ];
  G.missions = {
    defs: MISSION_DEFS,
    current: null,
    markerMesh: null,
    courierCar: null,
    ensureMarker: function () {
      if (this.markerMesh) return this.markerMesh;
      var geo = new THREE.CylinderGeometry(0.4, 3.2, 14, 12, 1, true);
      var mat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      this.markerMesh = new THREE.Mesh(geo, mat);
      this.markerMesh.position.y = 7;
      G.scene.add(this.markerMesh);
      return this.markerMesh;
    },
    startNext: function () {
      var st = G.state;
      if (this.current) { G.hud.toast("A job is already running — finish it first."); return; }
      var done = st.missionsDone || 0;
      if (done >= MISSION_DEFS.length) { G.hud.toast("All three jobs are done. Solmar is yours, Mara."); return; }
      var def = MISSION_DEFS[done];
      this.current = { def: def, stage: 0, timer: 0, hasPackage: false };
      G.hud.toast("JOB " + def.id + ": " + def.name + " — " + G.money(def.pay));
      G.hud.setObjective(def.name, def.stages[0].text, def.stages[0].hint);
      G.audio.pickup();
      if (def.id === 2) this.spawnCourier();
      if (def.id === 3) { G.police.addHeat(3, "dragnet"); }
      this.ensureMarker();
    },
    spawnCourier: function () {
      var p = G.player;
      var car = G.vehicles.create(G.scene, G.vehicles.defs[2], p.pos.x + 40, p.pos.z - 30, Math.PI / 2, { driver: "courier" });
      car.speed = 14;
      car.courier = true;
      car.health = 100;
      this.courierCar = car;
      G.hud.toast("There he goes — the Sunset Coupe, heading east!");
    },
    targetPos: function () {
      if (!this.current) return null;
      var stage = this.current.def.stages[this.current.stage];
      if (!stage) return null;
      if (stage.target === "courier" && this.courierCar) return this.courierCar.pos;
      if (stage.target === "survive") return null;
      var m = G.world.markers[stage.target];
      return m ? { x: m.x, z: m.z } : null;
    },
    update: function (dt) {
      if (!this.current) { if (this.markerMesh) this.markerMesh.visible = false; return; }
      var cur = this.current, stage = cur.def.stages[cur.stage];
      var p = G.player;
      if (this.markerMesh) {
        var tp = this.targetPos();
        if (tp) {
          this.markerMesh.visible = true;
          this.markerMesh.position.x = tp.x;
          this.markerMesh.position.z = tp.z;
          this.markerMesh.rotation.y += dt * 1.5;
          this.markerMesh.position.y = 7 + Math.sin(G.state.time * 2) * 0.8;
        } else {
          this.markerMesh.visible = false;
        }
      }
      // Courier AI: flee from the player along the roads.
      if (this.courierCar && stage.target === "courier") {
        var car = this.courierCar;
        var d = G.dist2d(car.pos.x, car.pos.z, p.pos.x, p.pos.z);
        var fleeHeading = G.angleTo(p.pos.x, p.pos.z, car.pos.x, car.pos.z);
        car.heading = G.turnToward(car.heading, fleeHeading, 1.8 * dt);
        car.speed = G.lerp(car.speed, d < 12 ? 30 : 16, dt);
        G.vehicles.updateTrafficCar(car, dt);
        if (d < 6) this.advanceStage();
      }
      if (stage.target === "survive") {
        cur.timer += dt;
        var left = Math.max(0, Math.ceil(stage.seconds - cur.timer));
        G.hud.setObjective(cur.def.name, "Survive the dragnet — " + left + "s left", "Keep moving. A car helps.");
        if (cur.timer >= stage.seconds) {
          G.state.wanted = Math.max(0, G.state.wanted - 1);
          this.advanceStage();
        }
        return;
      }
      if (stage.target && stage.target !== "courier") {
        var m = G.world.markers[stage.target];
        var dd = G.dist2d(p.pos.x, p.pos.z, m.x, m.z);
        if (dd < stage.radius) this.advanceStage();
      }
    },
    advanceStage: function () {
      var cur = this.current;
      if (!cur) return;
      cur.stage++;
      G.audio.pickup();
      if (cur.stage >= cur.def.stages.length) { this.complete(); return; }
      var stage = cur.def.stages[cur.stage];
      G.hud.setObjective(cur.def.name, stage.text, stage.hint);
      G.hud.toast("Next: " + stage.text);
    },
    complete: function () {
      var cur = this.current;
      var st = G.state;
      st.cash += cur.def.pay;
      st.missionsDone = (st.missionsDone || 0) + 1;
      G.hud.toast("JOB DONE — " + cur.def.name + " paid " + G.money(cur.def.pay) + "!");
      G.audio.cash();
      G.save.saveGame();
      if (st.missionsDone >= MISSION_DEFS.length) {
        G.hud.setObjective("Solmar City", "All three jobs done. Solmar is yours, Mara.", "Free roam — cause trouble or lay low.");
        G.hud.toast("STORY COMPLETE — Mara Voss runs Solmar now.");
      } else {
        G.hud.setObjective("Solmar City", "Job done. Press M when you're ready for the next one.", "");
      }
      if (this.courierCar) { this.courierCar.courier = false; this.courierCar = null; }
      this.current = null;
    },
    abort: function () {
      if (this.courierCar) { this.courierCar.courier = false; this.courierCar = null; }
      this.current = null;
      if (this.markerMesh) this.markerMesh.visible = false;
    }
  };
})();
