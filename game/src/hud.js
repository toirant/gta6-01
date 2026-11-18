// Solmar City — the HUD: health, cash, wanted stars, objective, clock, minimap.
// The minimap is a 2D canvas drawn every frame from the live world state.

import { clockText, cashText } from './util.js';
import { CITY_HALF } from './world.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['health-fill', 'health-num', 'cash', 'stars', 'objective', 'clock', 'ammo', 'speed', 'toast', 'toast-title', 'toast-body', 'prompt', 'mission-list']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = 0;
  }

  toast(title, body, seconds) {
    this.el['toast-title'].textContent = title;
    this.el['toast-body'].textContent = body;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds || 5;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    this.el['health-fill'].style.width = p.health + '%';
    this.el['health-num'].textContent = Math.ceil(p.health);
    this.el['health-fill'].classList.toggle('low', p.health < 30);
    this.el.cash.textContent = cashText(g.cash);
    this.el.stars.textContent = '★'.repeat(g.police.stars) + '☆'.repeat(5 - g.police.stars);
    this.el.stars.classList.toggle('hot', g.police.stars > 0);
    this.el.objective.textContent = g.missions.objectiveText();
    this.el.clock.textContent = clockText(g.clockMinutes);
    this.el.ammo.textContent = p.inCar ? '—' : `Ammo ${p.ammo}`;
    const speed = p.inCar ? Math.abs(p.inCar.speed) * 2.2 : Math.abs(p.speed) * 2.2;
    this.el.speed.textContent = Math.round(speed) + ' mph';
    // Mission list.
    const list = g.missions.done.map((id) => `<div class="done">✓ ${id}</div>`).join('');
    const current = g.missions.active ? `<div class="current">▶ ${g.missions.active.title}</div>` : '';
    const upcoming = g.missions.allDone ? '' : '';
    this.el['mission-list'].innerHTML = list + current + upcoming;

    // Context prompt (E to enter car / pick up).
    let prompt = '';
    if (!p.inCar) {
      const car = p.nearestCar(g.allCars());
      if (car) prompt = car.driver === 'traffic' ? 'E — Steal car' : 'E — Enter car';
      else if (g.missions.step && g.missions.step.kind === 'collect') {
        const s = g.missions.step;
        const d = Math.hypot(p.x - s.x, p.z - s.z);
        if (d < s.radius + 1) prompt = 'E — ' + s.label.replace(/^Press E to /, '');
      }
    } else {
      prompt = 'E — Exit car';
    }
    this.el.prompt.textContent = prompt;
    this.el.prompt.style.display = prompt ? 'block' : 'none';

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.mapCtx;
    const S = this.map.width; // 190
    const half = CITY_HALF + 40;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 20, 28, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (const line of g.world.roadLines) {
      const [ax] = toMap(line, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
      const [, bz] = toMap(0, line);
      ctx.beginPath(); ctx.moveTo(0, bz); ctx.lineTo(S, bz); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8a94a0';
    for (const b of g.world.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      const [x2, y2] = toMap(b.x + b.w / 2, b.z + b.d / 2);
      ctx.fillRect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y));
    }
    // Water at the bottom.
    const [, wy] = toMap(0, CITY_HALF + 10);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, wy, S, S - wy);
    // Mission marker.
    const marker = g.missions.marker || (g.missions.step && g.missions.step.kind === 'chase' && g.courierCar
      ? { x: g.courierCar.x, z: g.courierCar.z } : null);
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my);
      ctx.closePath(); ctx.fill();
    }
    // Traffic cars.
    ctx.fillStyle = '#cfd6dd';
    for (const t of g.traffic.cars) {
      const [x, y] = toMap(t.car.x, t.car.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police.
    ctx.fillStyle = '#ff4d4d';
    for (const c of g.police.cars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(g.player.x, g.player.z);
    const heading = g.player.inCar ? g.player.inCar.heading : g.player.heading;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
