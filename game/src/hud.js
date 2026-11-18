// hud.js — the HUD, minimap, menus and toasts for Solmar City.
window.G = window.G || {};
(function () {
  var G = window.G;
  var toastTimer = null;
  var minimapCtx = null;
  G.hud = {
    init: function () {
      var mm = G.el("minimap");
      minimapCtx = mm.getContext("2d");
      G.el("btn-new").addEventListener("click", function () { G.audio.unlock(); G.audio.click(); G.startNewGame(); });
      G.el("btn-continue").addEventListener("click", function () { G.audio.unlock(); G.audio.click(); G.continueGame(); });
      G.el("btn-how").addEventListener("click", function () { G.el("howto").classList.toggle("hidden"); });
      G.el("btn-resume").addEventListener("click", function () { G.resumeGame(); });
      G.el("btn-save-quit").addEventListener("click", function () { G.save.saveGame(); G.toTitle(); });
      G.el("btn-retry").addEventListener("click", function () { G.startNewGame(); });
      G.el("btn-title").addEventListener("click", function () { G.toTitle(); });
      if (!G.save.hasSave()) G.el("btn-continue").disabled = true;
    },
    show: function () { G.el("hud").classList.remove("hidden"); },
    hide: function () { G.el("hud").classList.add("hidden"); },
    toast: function (msg) {
      var t = G.el("toast");
      t.textContent = msg;
      t.style.opacity = "1";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.style.opacity = "0"; }, 3200);
    },
    setObjective: function (title, text, hint) {
      G.el("objective-title").textContent = title;
      G.el("objective-text").textContent = text;
      G.el("objective-hint").textContent = hint || "";
    },
    update: function () {
      var st = G.state, p = G.player;
      G.el("health-fill").style.width = Math.max(0, p.health) + "%";
      G.el("health-fill").style.background = p.health < 30 ? "linear-gradient(90deg,#d93a2b,#e87a6a)" : "linear-gradient(90deg,#2fd47a,#7be495)";
      G.el("cash").textContent = G.money(st.cash);
      G.el("ammo").textContent = String(st.ammo);
      G.el("clock").textContent = G.clockText(st.clockMin);
      var stars = "";
      for (var i = 0; i < 5; i++) stars += i < st.wanted ? "★" : '<span class="star-off">★</span>';
      G.el("wanted").innerHTML = stars;
      var speedo = G.el("speedo");
      if (p.inCar) {
        speedo.classList.remove("hidden");
        G.el("speed").textContent = String(Math.round(Math.abs(p.inCar.speed) * 3.6));
      } else {
        speedo.classList.add("hidden");
      }
      this.drawMinimap();
    },
    drawMinimap: function () {
      if (!minimapCtx) return;
      var c = minimapCtx, S = 190, HALF = 210;
      var toMap = function (x, z) { return [(x + HALF) / (HALF * 2) * S, (z + HALF) / (HALF * 2) * S]; };
      c.clearRect(0, 0, S, S);
      c.fillStyle = "#12333d";
      c.fillRect(0, 0, S, S);
      // Sea strip at the bottom (south).
      c.fillStyle = "#1e7fa8";
      c.fillRect(0, S * 0.93, S, S * 0.07);
      // Roads.
      c.strokeStyle = "#5a636b";
      c.lineWidth = 4;
      G.world.roads.forEach(function (r) {
        var p = toMap(r, 0)[0];
        c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.stroke();
        var q = toMap(0, r)[1];
        c.beginPath(); c.moveTo(0, q); c.lineTo(S, q); c.stroke();
      });
      var dot = function (x, z, color, r) {
        var m = toMap(x, z);
        c.fillStyle = color;
        c.beginPath(); c.arc(m[0], m[1], r, 0, Math.PI * 2); c.fill();
      };
      // Mission marker.
      var tp = G.missions.targetPos();
      if (tp) {
        var m = toMap(tp.x, tp.z);
        c.fillStyle = "#ffd166";
        c.beginPath(); c.arc(m[0], m[1], 6, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#fff"; c.lineWidth = 1.5;
        c.beginPath(); c.arc(m[0], m[1], 6, 0, Math.PI * 2); c.stroke();
      }
      // Traffic cars (grey), police (blue/red), player (white arrow).
      G.vehicles.cars.forEach(function (car) {
        if (car.driver === "player") return;
        dot(car.pos.x, car.pos.z, car.police ? "#3a6bff" : "#c8c8c8", car.police ? 4 : 3);
      });
      var p = G.player;
      var pm = toMap(p.pos.x, p.pos.z);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(pm[0], pm[1] - 7);
      c.lineTo(pm[0] + 5, pm[1] + 5);
      c.lineTo(pm[0] - 5, pm[1] + 5);
      c.closePath(); c.fill();
      c.strokeStyle = "#000"; c.lineWidth = 1; c.stroke();
      // North indicator.
      c.fillStyle = "#ffd166";
      c.font = "bold 11px sans-serif";
      c.fillText("N", S - 14, 14);
    },
    showTitle: function () {
      G.el("title-screen").classList.remove("hidden");
      G.el("pause-screen").classList.add("hidden");
      G.el("end-screen").classList.add("hidden");
      this.hide();
      G.el("btn-continue").disabled = !G.save.hasSave();
    },
    showPause: function (statsText) {
      G.el("pause-screen").classList.remove("hidden");
      G.el("pause-stats").textContent = statsText || "";
    },
    hidePause: function () { G.el("pause-screen").classList.add("hidden"); },
    showEnd: function (kind) {
      var title = G.el("end-title"), text = G.el("end-text");
      if (kind === "busted") {
        title.textContent = "BUSTED";
        text.textContent = "The Solmar PD finally got their hands on Mara Voss. The cell is small, the sentence is long — but Solmar never forgets a name.";
      } else {
        title.textContent = "MARA IS DOWN";
        text.textContent = "Solmar City keeps moving without her. The marina lights stay on, the couriers keep running — and somewhere, a new name is being made.";
      }
      G.el("end-screen").classList.remove("hidden");
    },
    hideEnd: function () { G.el("end-screen").classList.add("hidden"); }
  };
  G.onEscapePressed = function () {
    if (G.state.mode === "play") G.pauseGame();
    else if (G.state.mode === "pause") G.resumeGame();
  };
  G.onMissionKey = function () {
    if (G.state.mode === "play") G.missions.startNext();
  };
})();
