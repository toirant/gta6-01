// input.js — keyboard and mouse state for Solmar City.
window.G = window.G || {};
(function () {
  var G = window.G;
  var keys = {};
  var mouseDX = 0, mouseDY = 0, mouseDown = false;
  var dragging = false, lastX = 0, lastY = 0;
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === "Escape") G.onEscapePressed && G.onEscapePressed();
    if (e.code === "KeyM") G.onMissionKey && G.onMissionKey();
    if (e.code === "KeyF") G.onPunchKey && G.onPunchKey();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { for (var k in keys) keys[k] = false; });
  document.addEventListener("mousemove", function (e) {
    if (document.pointerLockElement) { mouseDX += e.movementX; mouseDY += e.movementY; }
    else if (dragging) { mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
  });
  document.addEventListener("mousedown", function (e) {
    mouseDown = true;
    if (e.target && e.target.tagName === "CANVAS") {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      if (G.state && G.state.mode === "play") G.tryShoot && G.tryShoot();
    }
  });
  document.addEventListener("mouseup", function () { mouseDown = false; dragging = false; });
  G.input = {
    keys: keys,
    down: function (code) { return !!keys[code]; },
    axis: function () {
      var x = 0, z = 0;
      if (keys["KeyW"] || keys["ArrowUp"]) z -= 1;
      if (keys["KeyS"] || keys["ArrowDown"]) z += 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) x -= 1;
      if (keys["KeyD"] || keys["ArrowRight"]) x += 1;
      return { x: x, z: z };
    },
    takeMouse: function () { var dx = mouseDX, dy = mouseDY; mouseDX = 0; mouseDY = 0; return { dx: dx, dy: dy }; },
    mouseDown: function () { return mouseDown; },
    lockPointer: function (canvas) {
      if (canvas && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (err) { /* pointer lock is optional */ } }
    }
  };
})();
