// The battle simulation. It has no DOM or canvas code, so test/sim.mjs can run it headless.
import { TOWERS, ENEMIES, BOSSES } from "./data.js";
import { GRASS } from "./level.js";
import { buildCost, upgradeCost, towerStats, MAX_LEVEL } from "./stats.js";

export const TARGET_MODES = ["first", "last", "strong", "close"];
const SPEEDS = { arrow: 10, shell: 6.5, frost: 7.5, venom: 7 };

export class Battle {
  // run is mutated directly (lives) so a leak is saved even if the page is closed mid-battle.
  constructor(field, plan, mods, run, hooks = {}) {
    this.field = field;
    this.plan = plan;
    this.mods = mods;
    this.run = run;
    this.hooks = hooks;
    this.gold = mods.g.startGold;
    this.wave = 0;
    this.queue = [];
    this.waveLeft = [];
    this.time = 0;
    this.towers = [];
    this.enemies = [];
    this.shots = [];
    this.fx = [];
    this.occupied = new Map();
    this.wardLeft = mods.g.ward;
    this.livesLost = 0;
    this.kills = 0;
    this.state = "build";
    this.nextId = 1;
    const p = field.path;
    this.cum = [0];
    for (let i = 1; i < p.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
    this.length = this.cum[this.cum.length - 1];
  }

  get waveCount() { return this.plan.waves.length; }
  get canSend() { return this.wave < this.waveCount && !this.queue.length && this.state !== "won" && this.state !== "lost"; }

  posAt(dist, hint = 0) {
    const p = this.field.path, c = this.cum;
    let i = Math.max(0, Math.min(hint, c.length - 2));
    while (i < c.length - 2 && dist > c[i + 1]) i++;
    while (i > 0 && dist < c[i]) i--;
    const f = Math.max(0, Math.min(1, (dist - c[i]) / (c[i + 1] - c[i])));
    return { x: p[i].x + (p[i + 1].x - p[i].x) * f, y: p[i].y + (p[i + 1].y - p[i].y) * f, seg: i };
  }

  canBuild(tx, ty) {
    const f = this.field;
    return tx >= 0 && ty >= 0 && tx < f.w && ty < f.h && f.tiles[ty * f.w + tx] === GRASS && !this.occupied.has(ty * f.w + tx);
  }

  towerAt(tx, ty) { return this.occupied.get(ty * this.field.w + tx) || null; }
  costOf(type) { return buildCost(type, this.mods); }
  upgradeCostOf(t) { return t.level >= MAX_LEVEL ? Infinity : upgradeCost(t.type, t.level, this.mods); }
  sellValue(t) { return Math.floor(t.spent * this.mods.g.sell); }

  build(type, tx, ty) {
    const cost = this.costOf(type);
    if (!this.canBuild(tx, ty) || this.gold < cost) return null;
    this.gold -= cost;
    const t = {
      id: this.nextId++, type, tx, ty, x: tx + 0.5, y: ty + 0.5, level: 1, cd: 0, angle: -Math.PI / 2, spent: cost,
      target: TOWERS[type].target || "first", stats: towerStats(type, 1, this.mods),
    };
    this.towers.push(t);
    this.occupied.set(ty * this.field.w + tx, t);
    return t;
  }

  upgrade(t) {
    const cost = this.upgradeCostOf(t);
    if (this.gold < cost) return false;
    this.gold -= cost;
    t.spent += cost;
    t.level++;
    t.stats = towerStats(t.type, t.level, this.mods);
    this.fx.push({ kind: "ring", x: t.x, y: t.y, r: 0.7, color: "#ffe08a", t: 0, life: 0.4 });
    return true;
  }

  sell(t) {
    this.gold += this.sellValue(t);
    this.towers = this.towers.filter(o => o !== t);
    this.occupied.delete(t.ty * this.field.w + t.tx);
  }

  sendWave() {
    if (!this.canSend) return false;
    if (this.enemies.length) {
      const bonus = 15 * this.mods.g.early;
      this.gold += bonus;
      this.text(this.field.path[1].x, this.field.path[1].y, `+${bonus} early`, "#ffd56b");
    }
    const w = this.wave++;
    const spawns = this.plan.waves[w];
    for (const s of spawns) this.queue.push({ ...s, at: this.time + s.t, wave: w });
    this.queue.sort((a, b) => a.at - b.at);
    this.waveLeft[w] = spawns.length;
    this.state = "fight";
    return true;
  }

  spawn(s, dist = 0) {
    const { hpScale, goldScale } = this.plan;
    let e;
    if (s.boss) {
      const b = BOSSES.find(x => x.id === s.boss);
      const hp = b.hp * Math.pow(hpScale, 0.9);
      e = {
        type: b.id, name: b.name, hp, maxHp: hp, speed: b.speed, armor: b.armor || 0, gold: b.gold, color: b.color,
        size: b.size, boss: true, leak: 10, heals: b.heals || 0, spawns: b.spawns, spawnEvery: b.spawnEvery,
        spawnCd: b.spawnEvery || 0,
      };
    } else {
      const d = ENEMIES[s.type];
      const hp = d.hp * hpScale * (s.elite ? 3.5 : 1);
      e = {
        type: s.type, name: d.name, hp, maxHp: hp, speed: d.speed * (s.elite ? 0.9 : 1), armor: (d.armor || 0) * (s.elite ? 1.5 : 1),
        gold: Math.round(d.gold * goldScale * (s.elite ? 3 : 1)), color: d.color, size: d.size * (s.elite ? 1.3 : 1),
        flying: !!d.flying, elite: !!s.elite, leak: s.elite ? 3 : d.leak || 1, heals: d.heals || 0, split: d.split || 0,
      };
    }
    Object.assign(e, {
      id: this.nextId++, wave: s.wave, dist, seg: 0, slow: 0, slowT: 0, poison: 0, poisonT: 0, contagion: false,
      burn: 0, burnT: 0, healCd: 1, flash: 0, dead: false,
    });
    const p = this.posAt(dist);
    e.x = p.x; e.y = p.y; e.seg = p.seg;
    this.enemies.push(e);
    return e;
  }

  update(dt) {
    if (this.state === "won" || this.state === "lost") return;
    this.time += dt;
    while (this.queue.length && this.queue[0].at <= this.time) this.spawn(this.queue.shift());
    for (const e of this.enemies) this.updateEnemy(e, dt);
    for (const t of this.towers) this.updateTower(t, dt);
    for (const s of this.shots) this.updateShot(s, dt);
    this.shots = this.shots.filter(s => !s.done);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);
    if (this.state === "fight" && !this.queue.length && !this.enemies.length) {
      this.state = this.wave >= this.waveCount ? "won" : "build";
      if (this.state === "won") this.hooks.onWin?.();
    }
  }

  updateEnemy(e, dt) {
    if (e.dead) return;
    const g = this.mods.g;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.poisonT > 0) { e.poisonT -= dt; this.damage(e, e.poison * dt, { dot: true }); }
    if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burn * dt, { dot: true }); }
    if (e.dead) return;
    if (e.heals) {
      e.healCd -= dt;
      if (e.healCd <= 0) {
        e.healCd = 1;
        const r = e.boss ? 2.5 : 1.5;
        for (const o of this.enemies) {
          if (!o.dead && o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= r * r) o.hp = Math.min(o.maxHp, o.hp + e.heals);
        }
        this.fx.push({ kind: "ring", x: e.x, y: e.y, r, color: "#9ff5c8", t: 0, life: 0.5 });
      }
    }
    if (e.spawns) {
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = e.spawnEvery;
        this.waveLeft[e.wave]++;
        this.spawn({ type: e.spawns, wave: e.wave }, Math.max(0, e.dist - 0.3));
      }
    }
    const slow = e.slowT > 0 ? e.slow * (e.boss ? 0.5 : 1) : 0;
    e.dist += e.speed * g.enemySpeed * (1 - slow) * dt;
    if (e.dist >= this.length) return this.leak(e);
    const p = this.posAt(e.dist, e.seg);
    e.x = p.x; e.y = p.y; e.seg = p.seg;
  }

  leak(e) {
    e.dead = true;
    let lives = e.leak;
    const end = this.field.path[this.field.path.length - 2];
    if (this.wardLeft > 0) {
      this.wardLeft--;
      lives = 0;
      this.text(end.x, end.y, "warded", "#9fd0ff");
    } else {
      this.text(end.x, end.y, `-${lives} ♥`, "#ff6b6b");
    }
    this.run.lives = Math.max(0, this.run.lives - lives);
    this.livesLost += lives;
    this.gone(e);
    this.hooks.onLeak?.();
    if (this.run.lives <= 0) { this.state = "lost"; this.hooks.onLose?.(); }
  }

  damage(e, amount, opts = {}) {
    if (e.dead) return;
    const g = this.mods.g;
    let d = amount;
    if (e.slowT > 0) d *= g.slowedDmg;
    if (e.elite || e.boss) d *= g.eliteDmg;
    if (!opts.dot && g.crit && Math.random() < g.crit) d *= 2;
    if (!opts.dot && !opts.pierce) d = Math.max(d * 0.2, d - e.armor);
    e.hp -= d;
    if (!opts.dot) e.flash = 0.08;
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    this.kills++;
    const gold = e.gold + this.mods.g.killGold;
    this.gold += gold;
    this.fx.push({ kind: "pop", x: e.x, y: e.y, r: e.size, color: e.color, t: 0, life: 0.35 });
    this.text(e.x, e.y - 0.2, `+${gold}`, "#ffd56b");
    if (e.split) {
      for (let i = 0; i < e.split; i++) {
        const c = this.spawn({ type: "slimelet", wave: e.wave }, Math.max(0, e.dist - 0.25 * i));
        if (e.elite) { c.hp = c.maxHp *= 2; }
      }
      this.waveLeft[e.wave] += e.split;
    }
    if (e.contagion && e.poisonT > 0) {
      for (const o of this.enemies) {
        if (!o.dead && o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 <= 1.44) {
          o.poison = Math.max(o.poison, e.poison);
          o.poisonT = Math.max(o.poisonT, 3);
          o.contagion = true;
        }
      }
      this.fx.push({ kind: "ring", x: e.x, y: e.y, r: 1.2, color: "#8fd14f", t: 0, life: 0.4 });
    }
    this.gone(e);
  }

  // Bookkeeping when an enemy leaves the field either way: pays out once a wave is fully dealt with.
  gone(e) {
    if (--this.waveLeft[e.wave] > 0) return;
    const g = this.mods.g;
    let pay = 20 + 5 * e.wave;
    for (const t of this.towers) if (t.type === "bank") pay += t.stats.income;
    if (g.interest) pay += Math.min(40, Math.floor(this.gold * 0.1));
    this.gold += pay;
    this.hooks.onWaveCleared?.(e.wave, pay);
  }

  text(x, y, str, color) {
    this.fx.push({ kind: "text", x, y, str, color, t: 0, life: 0.9 });
  }

  inRange(t, e) {
    const s = t.stats;
    if (e.dead || (e.flying && !s.air)) return false;
    const d2 = (e.x - t.x) ** 2 + (e.y - t.y) ** 2;
    return d2 <= s.range * s.range && d2 >= s.minRange * s.minRange && e.dist > 0.3;
  }

  pickTarget(t, exclude) {
    let best = null, score = -Infinity;
    for (const e of this.enemies) {
      if (e === exclude || !this.inRange(t, e)) continue;
      const sc = t.target === "first" ? e.dist : t.target === "last" ? -e.dist : t.target === "strong" ? e.hp + e.dist * 0.01
        : -((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
      if (sc > score) { score = sc; best = e; }
    }
    return best;
  }

  updateTower(t, dt) {
    if (t.type === "bank") return;
    const s = t.stats;
    t.cd -= dt;
    if (t.cd > 0) return;
    if (s.aura) {
      let hit = false;
      for (const e of this.enemies) {
        if (!this.inRange(t, e)) continue;
        hit = true;
        e.burn = Math.max(e.burn, s.burn);
        e.burnT = s.burnTime;
        this.damage(e, s.dmg);
      }
      if (hit) { t.cd = s.interval; this.fx.push({ kind: "flame", x: t.x, y: t.y, r: s.range, t: 0, life: 0.3 }); }
      return;
    }
    const e = this.pickTarget(t);
    if (!e) return;
    t.cd = s.interval;
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
    switch (t.type) {
      case "arrow":
        this.fire(t, "arrow", e);
        if (s.volley) { const e2 = this.pickTarget(t, e); this.fire(t, "arrow", e2 || e); }
        break;
      case "cannon": this.fire(t, "shell", e); break;
      case "frost": this.fire(t, "frost", e); break;
      case "poison": this.fire(t, "venom", e); break;
      case "tesla": this.zap(t, e); break;
      case "sniper": {
        const head = s.headshot && Math.random() < 0.25;
        this.fx.push({ kind: "line", x: t.x, y: t.y, x2: e.x, y2: e.y, color: head ? "#ff4d4d" : "#ffe7c2", w: 0.06, t: 0, life: 0.15 });
        this.damage(e, s.dmg * (head ? 3 : 1));
        if (head && e.dead) this.text(e.x, e.y - 0.5, "headshot!", "#ff8080");
        break;
      }
      case "mortar": {
        const flight = 1.1;
        const p = this.posAt(e.dist + e.speed * this.mods.g.enemySpeed * (e.slowT > 0 ? 1 - e.slow : 1) * flight, e.seg);
        this.shots.push({ kind: "mortar", x: t.x, y: t.y, sx: t.x, sy: t.y, tx: p.x, ty: p.y, t: 0, flight, tower: t, done: false });
        break;
      }
    }
  }

  fire(t, kind, e) {
    this.shots.push({ kind, x: t.x, y: t.y, target: e, tx: e.x, ty: e.y, tower: t, stats: t.stats, done: false });
  }

  zap(t, first) {
    const s = t.stats;
    const hit = new Set();
    let e = first, from = { x: t.x, y: t.y }, dmg = s.dmg;
    const pts = [from];
    for (let i = 0; i <= s.chains && e; i++) {
      hit.add(e);
      pts.push({ x: e.x, y: e.y });
      this.damage(e, dmg);
      dmg *= 0.85;
      let next = null, bd = 1.8 * 1.8;
      for (const o of this.enemies) {
        if (o.dead || hit.has(o)) continue;
        const d2 = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
        if (d2 < bd) { bd = d2; next = o; }
      }
      e = next;
    }
    this.fx.push({ kind: "zap", pts, t: 0, life: 0.18 });
  }

  updateShot(sh, dt) {
    if (sh.kind === "mortar") {
      sh.t += dt;
      const f = Math.min(1, sh.t / sh.flight);
      sh.x = sh.sx + (sh.tx - sh.sx) * f;
      sh.y = sh.sy + (sh.ty - sh.sy) * f;
      sh.h = Math.sin(f * Math.PI) * 1.6;
      if (f >= 1) {
        sh.done = true;
        const s = sh.tower.stats;
        this.blast(sh.tx, sh.ty, s.splash, s.dmg, false, s);
        if (s.cluster) {
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.5;
            this.blast(sh.tx + Math.cos(a) * r, sh.ty + Math.sin(a) * r, s.splash * 0.6, s.dmg * 0.5, false, s);
          }
        }
      }
      return;
    }
    if (sh.target && !sh.target.dead) { sh.tx = sh.target.x; sh.ty = sh.target.y; }
    const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy);
    const step = SPEEDS[sh.kind] * dt;
    sh.angle = Math.atan2(dy, dx);
    if (d > step + 0.05) { sh.x += dx / d * step; sh.y += dy / d * step; return; }
    sh.done = true;
    const s = sh.stats, e = sh.target;
    if (sh.kind === "arrow") { if (!e.dead) this.damage(e, s.dmg); return; }
    if (sh.kind === "venom") {
      if (e.dead) return;
      e.poison = Math.max(e.poison, s.poison);
      e.poisonT = s.poisonTime;
      if (s.contagion) e.contagion = true;
      this.damage(e, s.dmg, { pierce: true });
      return;
    }
    this.blast(sh.tx, sh.ty, s.splash, s.dmg, sh.kind === "frost", s);
  }

  blast(x, y, r, dmg, air, s) {
    for (const e of this.enemies) {
      if (e.dead || (e.flying && !air)) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > (r + e.size) ** 2) continue;
      if (s.slow) { e.slow = Math.max(e.slowT > 0 ? e.slow : 0, s.slow); e.slowT = Math.max(e.slowT, s.slowTime); }
      this.damage(e, dmg);
    }
    this.fx.push({ kind: s.slow ? "frostburst" : "boom", x, y, r, t: 0, life: 0.3 });
  }
}
