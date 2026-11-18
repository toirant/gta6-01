// Solmar City — keyboard and mouse input, with pointer-drag camera orbit.
// Written fresh for this game; no library code.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last poll (edge-triggered)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // left button edge
    this.rightClicked = false;
    this.dragging = false;
    this.pointerLocked = false;
    this.canvas = canvas;
    this.onPause = null;
    this.onAnyKey = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.onPause) this.onPause();
      }
      if (this.onAnyKey) this.onAnyKey();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.dragging = true;
      if (e.button === 0) this.mouseClicked = true;
      if (e.button === 2) this.rightClicked = true;
      if (this.onAnyKey) this.onAnyKey();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
  }

  down(code) { return this.keys.has(code); }
  /** True once for the frame the key went down. */
  hit(code) { return this.pressed.has(code); }

  /** Ask the browser to lock the pointer (called from a user gesture). */
  lockPointer() {
    try { this.canvas.requestPointerLock(); } catch (err) { /* pointer lock is optional */ }
  }

  /** Movement axes: forward/strafe in -1..1, from WASD or arrows. */
  axes() {
    let f = 0, s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  }

  /** Consume per-frame edge state after the game loop reads it. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseClicked = false;
    this.rightClicked = false;
  }
}
