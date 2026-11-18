// main.js — Solmar City boot, game loop and state machine.
window.G = window.G || {};
(function () {
  var G = window.G;
  G.state = {
    mode: "title", time: 0, clockMin: 8 * 60,
    cash: 250, ammo: 24, wanted: 0, missionsDone: 0
  };
  var renderer, scene, camera, clock;
  var lastSave = 0;
  function boot() {
    var root = G.el("game-root");
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    root.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    G.scene = scene;
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    camera.position.set(0, 8, 185);
    G.world.build(scene);
    G.player.create(scene);
    G.vehicles.spawnParked(scene);
    G.traffic.spawn(scene);
    G.combat.init(scene);
    G.missions.ensureMarker();
    G.hud.init();
    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    renderer.domElement.addEventListener("click", function () {
      if (G.state.mode === "play") G.input.lockPointer(renderer.domElement);
    });
    clock = new THREE.Clock();
    G.hud.showTitle();
    window.__gameReady = true;
    // A screenshot staging hook runs after the first frame.
    requestAnimationFrame(function () {
      if (G.shots.name) G.shots.apply();
      renderer.setAnimationLoop(tick);
    });
  }
  function tick() {
    var dt = Math.min(clock.getDelta(), 0.1);
    var st = G.state;
    if (st.mode === "play") {
      st.time += dt;
      st.clockMin = (st.clockMin + dt * 1.2) % (24 * 60);
      if (G.player.inCar) G.vehicles.updatePlayerCar(dt, camera);
      else G.player.update(dt, camera);
      G.traffic.update(dt);
      G.police.update(dt);
      G.missions.update(dt);
      G.combat.update(dt);
      G.hud.update();
      if (st.time - lastSave > 20) { lastSave = st.time; G.save.saveGame(); }
    } else if (st.mode === "title") {
      // Slow cinematic orbit over the marina while the title is up.
      st.time += dt;
      var a = st.time * 0.05;
      camera.position.set(Math.sin(a) * 60, 26, 150 + Math.cos(a) * 40);
      camera.lookAt(0, 4, 120);
      G.traffic.update(dt);
    }
    renderer.render(scene, camera);
  }
  G.startNewGame = function () {
    G.save.clearSave();
    G.state.cash = 250; G.state.ammo = 24; G.state.wanted = 0; G.state.missionsDone = 0;
    G.state.clockMin = 8 * 60; G.state.time = 0;
    G.police.clearAll();
    G.missions.abort();
    G.player.reset(0, 168, Math.PI);
    G.player.health = 100;
    G.state.mode = "play";
    G.el("title-screen").classList.add("hidden");
    G.el("end-screen").classList.add("hidden");
    G.hud.hidePause();
    G.hud.show();
    G.hud.setObjective("Solmar City", "Mara's first day — press M to take the Harbor Handoff job", "The marina is south, down the boulevard");
    G.audio.unlock();
    G.audio.startMusic();
    G.hud.toast("Welcome to Solmar City, Mara.");
  };
  G.continueGame = function () {
    var data = G.save.loadGame();
    if (!data) { G.startNewGame(); return; }
    G.state.cash = data.cash; G.state.ammo = data.ammo;
    G.state.missionsDone = data.missionsDone || 0;
    G.state.clockMin = data.clockMin || 8 * 60;
    G.state.wanted = 0;
    G.police.clearAll();
    G.missions.abort();
    G.player.reset(data.x || 0, data.z || 168, data.heading || Math.PI);
    G.player.health = data.health || 100;
    G.state.mode = "play";
    G.el("title-screen").classList.add("hidden");
    G.el("end-screen").classList.add("hidden");
    G.hud.show();
    G.hud.setObjective("Solmar City", "Back on the streets — press M for the next job", "");
    G.audio.unlock();
    G.audio.startMusic();
    G.hud.toast("Welcome back, Mara.");
  };
  G.pauseGame = function () {
    if (G.state.mode !== "play") return;
    G.state.mode = "pause";
    G.audio.setEngine(false, 0);
    G.hud.showPause("Cash " + G.money(G.state.cash) + " · Jobs done " + (G.state.missionsDone || 0) + " of 3 · " + G.clockText(G.state.clockMin));
  };
  G.resumeGame = function () {
    if (G.state.mode !== "pause") return;
    G.state.mode = "play";
    G.hud.hidePause();
    clock.getDelta();
  };
  G.toTitle = function () {
    G.state.mode = "title";
    G.audio.setEngine(false, 0);
    G.audio.setSiren(false);
    G.audio.stopMusic();
    G.police.clearAll();
    G.missions.abort();
    if (G.player.inCar) G.player.exitCar();
    G.player.reset(0, 168, Math.PI);
    G.hud.hideEnd();
    G.hud.hidePause();
    G.hud.showTitle();
  };
  G.gameOver = function (kind) {
    if (G.state.mode !== "play") return;
    G.state.mode = kind === "busted" ? "busted" : "dead";
    G.audio.setEngine(false, 0);
    G.audio.setSiren(false);
    G.audio.busted();
    G.save.clearSave();
    G.hud.showEnd(kind);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
