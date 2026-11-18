// Solmar City — the game itself: boot, loop, modes, driving, stealing, saving.
// Mara Voss, courier for hire, takes three jobs across one long afternoon in Solmar.

import { makeRng, clamp, dist2D, randRange, pick } from './util.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { World, CITY_HALF } from './world.js';
import { Car, CAR_COLORS } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { saveGameData, loadGameData, hasSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = Number(params.get('seed') || 7);
    this.shot = params.get('shot') || null;
    this.rng = makeRng(this.seed);
    this.time = 0;
    this.clockMinutes = 9 * 60; // 09:00, a sun-soaked morning
    this.cash = 250;
    this.mode = 'title'; // title | playing | paused | over
    this.overReason = '';
    this.titleOrbit = false;
    this.shakeAmt = 0;
    this.shotFrames = 0;
    this.shotReadyAfter = 0;
    this.courierCar = null;
    this.parkedCars = [];
    this.shotAutodrive = false;
    this.frameEma = 0;
    this.framesSeen = 0;
    this.degraded = false;

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 40, 90);

    // Systems.
    this.input = new Input(this.renderer.domElement);
    this.audio = new AudioEngine();
    this.world = new World(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.world, this.seed);
    this.player = new Player(this.scene, this.world, 0, -40);
    this.police = new Police(this.scene, this.world, this.rng);
    this.police.onBusted = () => this.endGame('busted');
    this.combat = new Combat(this.scene);
    this.missions = new MissionManager(this.scene, this);
    this.hud = new Hud(this);
    this.spawnParkedCars();

    // Input wiring.
    this.input.onPause = () => {
      if (this.mode === 'playing') this.setMode('paused');
      else if (this.mode === 'paused') this.setMode('playing');
    };
    this.input.onAnyKey = () => this.audio.ensure();

    // Menus.
    document.getElementById('btn-new').addEventListener('click', () => {
      this.audio.ensure();
      clearSave();
      this.startNewGame();
      this.setMode('playing');
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      this.audio.ensure();
      this.loadFromSave();
      this.setMode('playing');
    });
    document.getElementById('btn-resume').addEventListener('click', () => this.setMode('playing'));
    document.getElementById('btn-quit-title').addEventListener('click', () => {
      this.saveGame();
      this.setMode('title');
    });
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.respawn();
      this.setMode('playing');
    });
    document.getElementById('btn-title-after-over').addEventListener('click', () => this.setMode('title'));
    document.getElementById('btn-mute').addEventListener('click', (e) => {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      e.target.textContent = this.audio.muted ? '🔇 Muted' : '🔊 Sound';
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Debug / automation handle.
    window.__game = this;
    window.__shotReady = false;

    if (this.shot) {
      applyShot(this, this.shot);
    } else {
      this.refreshTitle();
    }
    this.lastNow = performance.now();
    this.loop();
  }

  // ------------------------------------------------------------ setup

  spawnParkedCars() {
    const spots = [
      [29, 58, 0], [-29, -58, Math.PI], [58, -29, Math.PI / 2], [-58, 29, -Math.PI / 2],
      [87, 0, Math.PI], [0, 87, 0], [-87, -58, Math.PI / 2], [116, 29, -Math.PI / 2],
      [145, 58, 0], [-145, -58, Math.PI],
    ];
    for (const [x, z, h] of spots) {
      const car = new Car(this.scene, x, z, h, pick(this.rng, CAR_COLORS), false);
      car.driver = null;
      this.parkedCars.push(car);
    }
  }

  /** A parked car placed by a screenshot stage (or a mission). */
  spawnParkedCar(x, z, heading, color) {
    const car = new Car(this.scene, x, z, heading, color, false);
    car.driver = null;
    this.parkedCars.push(car);
    return car;
  }

  /** The yellow courier cab for mission 2, driving a loop around the blocks. */
  startCourierCar() {
    const p = this.world.randomRoadPoint(this.rng);
    const cab = new Car(this.scene, p.x, p.z, 0, 0xe8c832, false);
    cab.driver = 'courier';
    this.courierCar = cab;
    this.traffic.cars.push({ car: cab, axis: 'z', dir: 1, speed: 14, targetSpeed: 15 });
  }

  allCars() {
    return [
      ...this.parkedCars,
      ...this.traffic.cars.map((t) => t.car),
      ...this.police.cars,
    ];
  }

  // ------------------------------------------------------------ modes

  setMode(mode) {
    this.mode = mode;
    document.getElementById('screen-title').classList.toggle('hidden', mode !== 'title');
    document.getElementById('screen-pause').classList.toggle('hidden', mode !== 'paused');
    document.getElementById('screen-over').classList.toggle('hidden', mode !== 'over');
    document.getElementById('hud').classList.toggle('hidden', mode !== 'playing');
    if (mode === 'title') this.refreshTitle();
    if (mode === 'playing') {
      this.audio.ensure();
      this.audio.startMusic();
      if (document.pointerLockElement !== this.renderer.domElement) {
        // Pointer lock is optional; drag-orbit works without it.
      }
    }
    if (mode === 'paused' || mode === 'over' || mode === 'title') {
      this.audio.setEngine(0, false);
    }
  }

  refreshTitle() {
    const cont = document.getElementById('btn-continue');
    cont.style.display = hasSave() ? 'inline-block' : 'none';
    const save = loadGameData();
    document.getElementById('title-save').textContent = save
      ? `Saved game: ${save.cash ? '$' + save.cash : ''} · ${save.done ? save.done.length : 0} job(s) done`
      : 'No saved game yet — start a new one.';
  }

  startNewGame() {
    this.cash = 250;
    this.clockMinutes = 9 * 60;
    this.player.health = 100;
    this.player.ammo = 24;
    this.player.x = 0; this.player.z = -40;
    this.player.heading = 0;
    this.player.camYaw = 0;
    this.player.dead = false;
    if (this.player.inCar) this.player.exitCar();
    this.police.heat = 0;
    this.missions.done = [];
    this.missions.activeIndex = 0;
    this.missions.stepIndex = 0;
    this.missions.startMission(0);
    this.saveGame();
    this.toast('Solmar City', 'Welcome to Solmar. Dario is waiting — follow the gold marker.');
  }

  loadFromSave() {
    const s = loadGameData();
    if (!s) { this.startNewGame(); return; }
    this.cash = s.cash ?? 250;
    this.clockMinutes = s.clockMinutes ?? 9 * 60;
    this.player.health = s.health ?? 100;
    this.player.ammo = s.ammo ?? 24;
    this.player.x = s.x ?? 0;
    this.player.z = s.z ?? -40;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.missions.done = s.done || [];
    this.missions.activeIndex = s.activeIndex ?? 0;
    this.missions.stepIndex = s.stepIndex ?? 0;
    if (this.missions.allDone) {
      this.missions.beacon.visible = false;
    } else {
      this.missions.updateMarker();
      this.toast(this.missions.active.title, this.missions.active.intro);
    }
  }

  saveGame() {
    saveGameData({
      cash: this.cash,
      clockMinutes: this.clockMinutes,
      health: this.player.health,
      ammo: this.player.ammo,
      x: this.player.x,
      z: this.player.z,
      done: this.missions.done,
      activeIndex: this.missions.activeIndex,
      stepIndex: this.missions.stepIndex,
    });
  }

  respawn() {
    this.player.health = 100;
    this.player.dead = false;
    this.player.x = 87; this.player.z = 58; // the hideout, on Coral Row
    this.player.mesh.position.set(87, 0, 58);
    if (this.player.inCar) this.player.exitCar();
    this.police.heat = 0;
    this.cash = Math.floor(this.cash / 2);
    this.toast('Back on your feet', 'The hideout patched you up. Half your cash went to the fixer.');
  }

  endGame(reason) {
    this.overReason = reason;
    this.setMode('over');
    const title = reason === 'busted' ? 'BUSTED' : 'WASTED';
    const body = reason === 'busted'
      ? 'The Solmar PD caught up with Mara. The job is not over — try again.'
      : 'Mara is down. The city keeps moving — try again.';
    document.getElementById('over-title').textContent = title;
    document.getElementById('over-body').textContent = body;
    this.audio.setEngine(0, false);
  }

  // ------------------------------------------------------------ helpers

  toast(title, body, seconds) { this.hud.toast(title, body, seconds); }

  addCash(amount, why) {
    this.cash += amount;
    this.audio.cash();
    this.toast('+$' + amount, why || 'Cash');
  }

  shake(amount) { this.shakeAmt = Math.max(this.shakeAmt, amount); }

  // ------------------------------------------------------------ loop

  /** Drop shadows and pixel ratio on slow machines so the game stays playable. */
  degradeQuality() {
    if (this.degraded) return;
    this.degraded = true;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }

  loop() {
    const step = () => {
      const now = performance.now();
      const rawDt = (now - this.lastNow) / 1000;
      const dt = Math.min(0.05, rawDt);
      this.lastNow = now;
      // Adaptive quality: if frames stay slow, drop the expensive shadows.
      this.framesSeen++;
      this.frameEma = this.framesSeen === 1 ? rawDt : this.frameEma * 0.9 + rawDt * 0.1;
      if (this.framesSeen > 40 && this.frameEma > 0.09) this.degradeQuality();
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.shot) {
        this.shotFrames++;
        if (this.shotFrames >= (this.shotReadyAfter || 60)) window.__shotReady = true;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  update(dt) {
    this.time += dt;
    this.world.update(dt, this.time);
    this.combat.update(dt);

    if (this.mode === 'title') {
      // Ambient city life behind the title screen.
      this.traffic.update(dt, this.player.pos, 0);
      if (this.titleOrbit) {
        const a = this.time * 0.05;
        this.camera.position.set(Math.sin(a) * 120, 55, Math.cos(a) * 120);
        this.camera.lookAt(0, 20, 0);
      }
      this.input.endFrame();
      return;
    }
    if (this.mode !== 'playing') {
      this.input.endFrame();
      return;
    }

    const input = this.input;
    const player = this.player;
    this.clockMinutes += dt; // one game minute per real second

    // --- Entering / exiting cars and mission interaction (E). ---
    if (input.hit('KeyE')) {
      if (player.inCar) {
        player.exitCar();
        this.audio.door();
      } else if (this.missions.tryInteract()) {
        // handled inside
      } else {
        const car = player.nearestCar(this.allCars().filter((c) => Math.abs(c.speed) < 3));
        if (car) {
          const wasTraffic = car.driver === 'traffic';
          player.enterCar(car);
          this.audio.door();
          if (wasTraffic) {
            this.police.addHeat(25, this);
            this.toast('Car stolen', 'Someone saw that. The PD is on its way.');
          }
        }
      }
    }

    // --- Driving. ---
    if (player.inCar) {
      const car = player.inCar;
      const axes = input.axes();
      // Staged screenshots roll the car forward on their own.
      const throttle = this.shotAutodrive ? 0.7 : axes.f;
      const steer = this.shotAutodrive ? 0 : -axes.s;
      const brake = !this.shotAutodrive && input.down('Space') ? -1 : 0;
      car.drive(dt, brake !== 0 ? brake : throttle, steer);
      if (car.skidding && Math.random() < dt * 8) {
        this.combat.dust(car.x, 0.2, car.z);
        this.audio.skid();
      }
      // Building collision.
      const hit = this.world.collideCircle(car.x, car.z, 2.2);
      if (hit.x !== car.x || hit.z !== car.z) {
        if (Math.abs(car.speed) > 8) {
          this.audio.crash();
          this.shake(0.3);
          car.damage(8);
          this.combat.burst(car.x, 1, car.z, 0xff8a3c, 6);
        }
        car.x = hit.x; car.z = hit.z;
        car.speed *= 0.4;
      }
      car.x = clamp(car.x, -215, 215);
      car.z = clamp(car.z, -215, 245);
      // Hit a pedestrian while driving?
      for (const ped of this.traffic.peds) {
        if (!ped.alive) continue;
        if (dist2D(car.x, car.z, ped.x, ped.z) < 2.4 && Math.abs(car.speed) > 4) {
          this.traffic.killPed(ped);
          this.police.addHeat(15, this);
          this.audio.crash();
          this.shake(0.4);
          this.addCash(10, 'Ped down');
        }
      }
      // Ram traffic cars.
      for (const t of this.traffic.cars) {
        const o = t.car;
        if (o === car || !o.alive) continue;
        const d = dist2D(car.x, car.z, o.x, o.z);
        if (d < 4.4) {
          const push = (4.4 - d) / 2;
          const nx = (o.x - car.x) / (d || 1), nz = (o.z - car.z) / (d || 1);
          o.x += nx * push; o.z += nz * push;
          car.x -= nx * push * 0.4; car.z -= nz * push * 0.4;
          if (Math.abs(car.speed) > 10) {
            o.damage(10);
            this.audio.crash();
            this.shake(0.25);
          }
        }
      }
      this.audio.setEngine(Math.abs(car.speed) / 30, true);
      if (!car.alive) {
        // Wrecked: bail out.
        this.toast('Wrecked', 'The car is finished. Get out and run.');
        player.exitCar();
      }
    } else {
      this.audio.setEngine(0, false);
      player.updateOnFoot(dt, input);
      // Traffic car runs the player over?
      for (const t of this.traffic.cars) {
        const o = t.car;
        if (!o.alive) continue;
        if (dist2D(player.x, player.z, o.x, o.z) < 2.2 && Math.abs(o.speed) > 3) {
          player.hurt(14);
          this.audio.crash();
          this.shake(0.5);
          o.speed *= 0.3;
          if (player.dead) this.endGame('wasted');
        }
      }
    }

    // --- Combat input. ---
    if (!player.inCar && !player.dead) {
      if (input.mouseClicked) this.combat.shoot(this);
      if (input.hit('KeyF')) this.combat.punch(this);
      if (input.hit('KeyR')) {
        // Reload: buy ammo with cash, $5 a bullet, up to 48.
        const want = Math.min(48 - player.ammo, Math.floor(this.cash / 5));
        if (want > 0) {
          player.ammo += want;
          this.cash -= want * 5;
          this.audio.pickup();
          this.toast('Ammo restocked', `+${want} bullets — $${want * 5}.`);
        }
      }
    }

    // --- Systems. ---
    this.traffic.update(dt, player.pos, this.police.stars);
    this.police.update(dt, this);
    this.missions.update(dt, this.time);
    player.updateCamera(this.camera, dt, input);
    if (this.shakeAmt > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.4);
    }
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      this.endGame('wasted');
    }
    this.hud.update(dt);
    input.endFrame();

    // Autosave every ~20 seconds of play.
    this.saveTimer = (this.saveTimer || 0) + dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      this.saveGame();
    }
  }
}

new Game();
