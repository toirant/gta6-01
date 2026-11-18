// shots.js — deterministic staging for the four screenshots (?shot=title|drive|chase|mission).
// The hook only arranges the scene; every pixel comes from the game's own renderer.
window.G = window.G || {};
(function () {
  var G = window.G;
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  G.shots = {
    name: param("shot"),
    apply: function () {
      var name = this.name;
      if (!name) return false;
      var p = G.player, st = G.state;
      st.mode = "play";
      G.hud.hideEnd(); G.hud.hidePause();
      G.el("title-screen").classList.add("hidden");
      G.hud.show();
      if (name === "title") {
        st.mode = "title";
        G.hud.hide();
        G.el("title-screen").classList.remove("hidden");
        p.reset(0, 150, Math.PI);
        p.camYaw = Math.PI;
        window.__shotReady = true;
        return true;
      }
      if (name === "drive") {
        var car = G.vehicles.cars.filter(function (c) { return c.parked; })[2] || G.vehicles.cars[0];
        p.reset(car.pos.x + 3, car.pos.z, car.heading);
        p.enterCar(car);
        car.speed = 18;
        p.camYaw = car.heading;
        G.shots.cruise = true;
        G.hud.setObjective("Solmar City", "Cruise the boulevard — press M to take a job", "E exits the car");
        window.__shotReady = true;
        return true;
      }
      if (name === "chase") {
        var car2 = G.vehicles.cars.filter(function (c) { return c.parked; })[4] || G.vehicles.cars[0];
        p.reset(car2.pos.x + 3, car2.pos.z, car2.heading);
        p.enterCar(car2);
        car2.speed = 22;
        st.wanted = 3;
        G.shots.cruise = true;
        G.audio.setSiren(true);
        G.police.spawnCar(); G.police.spawnCar();
        // Stage the patrol cars just behind the player so the chase reads in frame.
        G.police.cars.forEach(function (c, i) {
          var fx = Math.sin(car2.heading), fz = Math.cos(car2.heading);
          var side = i === 0 ? -4 : 4;
          c.pos.set(car2.pos.x - fx * 15 - fz * side, 0, car2.pos.z - fz * 15 + fx * side);
          c.heading = car2.heading;
          c.speed = 20;
          c.mesh.position.copy(c.pos);
        });
        G.hud.setObjective("Dragnet", "Lose the patrol cars — wanted level 3", "Lay low to cool the heat");
        window.__shotReady = true;
        return true;
      }
      if (name === "mission") {
        p.reset(0, 168, Math.PI);
        p.camYaw = Math.PI;
        G.missions.startNext();
        st.cash = 750;
        window.__shotReady = true;
        return true;
      }
      return false;
    }
  };
})();
