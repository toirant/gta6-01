// Solmar City — missions and story: three jobs for Mara Voss.
// Each mission is a list of steps; reaching a marker (or a timed goal) advances it.
// Markers are a floating beacon plus a minimap blip and a HUD objective line.

import { dist2D } from './util.js';
import { CITY_HALF } from './world.js';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'The Pickup',
    intro: 'Dario needs a package off the marina pier. Grab it, then bring it to the garage on Coral Row. Keep it quiet.',
    reward: 500,
    steps: [
      { kind: 'goto', label: 'Go to the marina pier', x: -52, z: CITY_HALF + 55, radius: 6 },
      { kind: 'collect', label: 'Press E to pick up the package', x: -52, z: CITY_HALF + 55, radius: 6 },
      { kind: 'goto', label: 'Deliver the package to the garage', x: 0, z: -29, radius: 6 },
      { kind: 'collect', label: 'Press E to deliver the package', x: 0, z: -29, radius: 6 },
    ],
  },
  {
    id: 'courier',
    title: 'Courier Chase',
    intro: 'A courier is carrying Dario\'s ledger across town in a yellow cab. Cut him off, take the case, and get it to the hideout.',
    reward: 800,
    steps: [
      { kind: 'chase', label: 'Chase the courier cab and get close', radius: 7, hold: 2.5 },
      { kind: 'goto', label: 'Take the case to the hideout', x: 87, z: 58, radius: 6 },
      { kind: 'collect', label: 'Press E to stash the case', x: 87, z: 58, radius: 6 },
    ],
  },
  {
    id: 'dragnet',
    title: 'The Dragnet',
    intro: 'The Solmar PD knows your face now. Lose the heat, then slip back to the hideout. Don\'t get busted.',
    reward: 1200,
    steps: [
      { kind: 'escape', label: 'Lose the wanted level', radius: 0 },
      { kind: 'goto', label: 'Reach the hideout', x: 87, z: 58, radius: 6 },
      { kind: 'collect', label: 'Press E to lay low', x: 87, z: 58, radius: 6 },
    ],
  },
];

export class MissionManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.activeIndex = 0;   // index into MISSIONS, or -1 when all done
    this.stepIndex = 0;
    this.done = [];         // completed mission ids
    this.chaseCar = null;   // the courier cab for mission 2
    this.holdTimer = 0;
    this.beacon = this.makeBeacon();
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.marker = null;     // {x, z} of the current objective
    this.escaped = false;
  }

  makeBeacon() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 30;
    g.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd94d })
    );
    diamond.position.y = 8;
    g.add(diamond);
    g.userData.diamond = diamond;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.25, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd94d })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    return g;
  }

  get active() { return this.activeIndex >= 0 ? MISSIONS[this.activeIndex] : null; }
  get step() { return this.active ? this.active.steps[this.stepIndex] : null; }
  get allDone() { return this.activeIndex < 0; }

  objectiveText() {
    if (this.allDone) return 'All jobs done — Solmar is yours. Free roam!';
    const m = this.active;
    const s = this.step;
    return `${m.title}: ${s.label}`;
  }

  startMission(i) {
    this.activeIndex = i;
    this.stepIndex = 0;
    this.holdTimer = 0;
    this.escaped = false;
    const m = this.active;
    this.game.toast(m.title, m.intro);
    if (m.id === 'courier') this.spawnCourier();
    if (m.id === 'dragnet') this.game.police.addHeat(70, this.game);
    this.updateMarker();
  }

  spawnCourier() {
    this.game.startCourierCar();
  }

  updateMarker() {
    const s = this.step;
    if (!s) { this.beacon.visible = false; this.marker = null; return; }
    if (s.kind === 'chase') {
      this.marker = null; // follows the courier car
      this.beacon.visible = false;
      return;
    }
    if (s.kind === 'escape') {
      this.marker = null;
      this.beacon.visible = false;
      return;
    }
    this.marker = { x: s.x, z: s.z };
    this.beacon.position.set(s.x, 0, s.z);
    this.beacon.visible = true;
  }

  advance() {
    const m = this.active;
    this.stepIndex++;
    if (this.stepIndex >= m.steps.length) {
      this.done.push(m.id);
      this.game.addCash(m.reward, m.title);
      this.game.audio.missionDone();
      this.game.toast('Job complete', `${m.title} — earned $${m.reward}.`);
      this.game.saveGame();
      const next = this.activeIndex + 1;
      if (next < MISSIONS.length) {
        this.startMission(next);
      } else {
        this.activeIndex = -1;
        this.beacon.visible = false;
        this.marker = null;
        this.game.toast('Solmar City', 'Every job is done. The city is yours — free roam.');
      }
      return;
    }
    this.updateMarker();
  }

  /** Called when the player presses E near a marker. */
  tryInteract() {
    const s = this.step;
    if (!s || s.kind !== 'collect') return false;
    const p = this.game.player;
    if (dist2D(p.x, p.z, s.x, s.z) < s.radius + 1) {
      this.game.audio.pickup();
      this.advance();
      return true;
    }
    return false;
  }

  update(dt, time) {
    // Spin the beacon diamond.
    if (this.beacon.visible) {
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.diamond.position.y = 8 + Math.sin(time * 2) * 0.6;
    }
    const s = this.step;
    if (!s) return;
    const p = this.game.player;
    if (s.kind === 'goto') {
      if (dist2D(p.x, p.z, s.x, s.z) < s.radius) {
        // Arriving at a goto step moves to the collect step automatically.
        this.stepIndex++;
        this.updateMarker();
      }
    } else if (s.kind === 'chase') {
      const cab = this.game.courierCar;
      if (!cab) return;
      const d = dist2D(p.x, p.z, cab.x, cab.z);
      if (d < s.radius) {
        this.holdTimer += dt;
        if (this.holdTimer >= (s.hold || 2)) {
          // Grabbed the case.
          this.game.audio.pickup();
          this.game.toast('Case grabbed', 'Now get it to the hideout.');
          if (cab) cab.driver = null;
          this.game.courierCar = null;
          this.advance();
        }
      } else {
        this.holdTimer = Math.max(0, this.holdTimer - dt);
      }
    } else if (s.kind === 'escape') {
      if (this.game.police.stars === 0) {
        this.advance();
      }
    }
  }
}
