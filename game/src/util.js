// util.js — small math and helper functions shared by every Solmar City module.
window.G = window.G || {};
(function () {
  var G = window.G;
  G.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  G.randInt = function (lo, hi) { return Math.floor(G.rand(lo, hi + 1)); };
  G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  G.dist2d = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  G.angleTo = function (ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); };
  G.wrapAngle = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  G.turnToward = function (cur, target, maxStep) {
    var d = G.wrapAngle(target - cur);
    if (d > maxStep) d = maxStep; else if (d < -maxStep) d = -maxStep;
    return cur + d;
  };
  G.money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  G.clockText = function (minutes) {
    var h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  };
  G.el = function (id) { return document.getElementById(id); };
  // Circle (x,z,r) pushed out of an axis-aligned box collider.
  G.resolveCircleVsBox = function (pos, r, box) {
    var cx = G.clamp(pos.x, box.minX, box.maxX);
    var cz = G.clamp(pos.z, box.minZ, box.maxZ);
    var dx = pos.x - cx, dz = pos.z - cz;
    var d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 0.0001) {
      var d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
    } else {
      var pushL = pos.x - (box.minX - r), pushR = (box.maxX + r) - pos.x;
      var pushT = pos.z - (box.minZ - r), pushB = (box.maxZ + r) - pos.z;
      var m = Math.min(pushL, pushR, pushT, pushB);
      if (m === pushL) pos.x = box.minX - r; else if (m === pushR) pos.x = box.maxX + r;
      else if (m === pushT) pos.z = box.minZ - r; else pos.z = box.maxZ + r;
    }
    return true;
  };
})();
