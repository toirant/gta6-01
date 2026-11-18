// save.js — localStorage save and continue for Solmar City.
window.G = window.G || {};
(function () {
  var G = window.G;
  var KEY = "solmar-city-save-v1";
  G.save = {
    hasSave: function () {
      try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
    },
    saveGame: function () {
      var st = G.state, p = G.player;
      if (!st || st.mode === "title") return false;
      var data = {
        cash: st.cash, ammo: st.ammo, health: p.health,
        missionsDone: st.missionsDone || 0,
        clockMin: st.clockMin,
        x: p.pos.x, z: p.pos.z, heading: p.heading,
        wanted: 0
      };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    loadGame: function () {
      try {
        var raw = window.localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clearSave: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
    }
  };
})();
