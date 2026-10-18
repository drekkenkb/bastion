// Canvas drawing for a battle. Coordinates are in tiles; the context is scaled so one unit is one tile.
import { TOWERS } from "./data.js";
import { GRASS, PATH, ROCK } from "./level.js";

export function drawBackground(field, scale, dpr) {
  const c = document.createElement("canvas");
  c.width = Math.round(field.w * scale * dpr);
  c.height = Math.round(field.h * scale * dpr);
  const g = c.getContext("2d");
  g.scale(scale * dpr, scale * dpr);
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < field.h; y++) {
    for (let x = 0; x < field.w; x++) {
      const t = field.tiles[y * field.w + x];
      g.fillStyle = t === PATH ? "#b89a6a" : (x + y) % 2 ? "#3d5a3a" : "#41603e";
      g.fillRect(x, y, 1.01, 1.01);
      if (t !== PATH) {
        g.fillStyle = "rgba(255,255,255,0.05)";
        for (let i = 0; i < 3; i++) g.fillRect(x + rand() * 0.9, y + rand() * 0.9, 0.06, 0.12);
      }
    }
  }
  // Soften the path with a darker border and a few pebbles.
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = "rgba(60,40,20,0.35)";
  g.lineWidth = 0.92;
  tracePath(g, field.path);
  g.stroke();
  g.strokeStyle = "#c7aa78";
  g.lineWidth = 0.8;
  tracePath(g, field.path);
  g.stroke();
  g.fillStyle = "rgba(90,70,40,0.35)";
  for (const p of field.path) {
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.arc(p.x + (rand() - 0.5) * 0.6, p.y + (rand() - 0.5) * 0.6, 0.03 + rand() * 0.03, 0, 7);
      g.fill();
    }
  }
  for (let y = 0; y < field.h; y++) {
    for (let x = 0; x < field.w; x++) {
      if (field.tiles[y * field.w + x] !== ROCK) continue;
      g.fillStyle = "#5d6066";
      g.beginPath();
      g.ellipse(x + 0.5, y + 0.56, 0.36, 0.28, 0, 0, 7);
      g.fill();
      g.fillStyle = "#7b7f86";
      g.beginPath();
      g.ellipse(x + 0.45, y + 0.48, 0.26, 0.18, -0.3, 0, 7);
      g.fill();
    }
  }
  // Spawn portal and the gate at the end.
  const a = field.path[1], b = field.path[field.path.length - 2];
  g.fillStyle = "rgba(150,60,200,0.5)";
  g.beginPath(); g.arc(a.x, a.y, 0.42, 0, 7); g.fill();
  g.fillStyle = "rgba(40,10,60,0.8)";
  g.beginPath(); g.arc(a.x, a.y, 0.28, 0, 7); g.fill();
  g.fillStyle = "#6b6f78";
  g.fillRect(b.x - 0.42, b.y - 0.42, 0.84, 0.84);
  g.fillStyle = "#8a8f99";
  for (let i = 0; i < 3; i++) g.fillRect(b.x - 0.42 + i * 0.33, b.y - 0.5, 0.18, 0.14);
  g.fillStyle = "#3a2a1a";
  g.beginPath(); g.arc(b.x, b.y + 0.1, 0.2, Math.PI, 0); g.lineTo(b.x + 0.2, b.y + 0.42); g.lineTo(b.x - 0.2, b.y + 0.42); g.fill();
  return c;
}

function tracePath(g, path) {
  g.beginPath();
  g.moveTo(path[0].x, path[0].y);
  for (const p of path) g.lineTo(p.x, p.y);
}

// Draws a tower centred on (0,0) with radius about 0.4.
export function drawTower(g, type, level, angle, time = 0) {
  const def = TOWERS[type];
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath(); g.ellipse(0.04, 0.08, 0.4, 0.36, 0, 0, 7); g.fill();
  g.fillStyle = "#4a4f5a";
  roundRect(g, -0.38, -0.38, 0.76, 0.76, 0.14);
  g.fill();
  g.fillStyle = "#5f6573";
  roundRect(g, -0.32, -0.32, 0.64, 0.64, 0.1);
  g.fill();
  g.fillStyle = def.color;
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 0.04;
  const turret = (len, wid) => {
    g.save();
    g.rotate(angle);
    g.fillStyle = "#2c2f36";
    g.fillRect(0, -wid / 2, len, wid);
    g.restore();
    g.fillStyle = def.color;
    g.beginPath(); g.arc(0, 0, 0.22, 0, 7); g.fill(); g.stroke();
  };
  switch (type) {
    case "arrow":
      g.save(); g.rotate(angle);
      g.strokeStyle = "#6b4a2a"; g.lineWidth = 0.06;
      g.beginPath(); g.arc(0.02, 0, 0.26, -1.2, 1.2); g.stroke();
      g.strokeStyle = "#ddd"; g.lineWidth = 0.02;
      g.beginPath(); g.moveTo(0.1, -0.24); g.lineTo(0.1, 0.24); g.stroke();
      g.restore();
      g.fillStyle = def.color; g.beginPath(); g.arc(0, 0, 0.14, 0, 7); g.fill();
      break;
    case "cannon": turret(0.38, 0.16); break;
    case "sniper": turret(0.46, 0.07); break;
    case "flame": turret(0.3, 0.14); break;
    case "poison": {
      turret(0.3, 0.1);
      g.fillStyle = "#cfffa0"; g.beginPath(); g.arc(0, 0, 0.09, 0, 7); g.fill();
      break;
    }
    case "frost": {
      g.save(); g.rotate(time * 0.5);
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.lineTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26); }
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = "#e8fbff"; g.beginPath(); g.arc(0, 0, 0.09, 0, 7); g.fill();
      break;
    }
    case "tesla": {
      g.beginPath(); g.arc(0, 0, 0.24, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = "#3a2a5a"; g.lineWidth = 0.035;
      for (let r = 0.08; r < 0.22; r += 0.06) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
      g.fillStyle = `rgba(230,210,255,${0.7 + 0.3 * Math.sin(time * 8)})`;
      g.beginPath(); g.arc(0, 0, 0.08, 0, 7); g.fill();
      break;
    }
    case "mortar": {
      g.beginPath(); g.arc(0, 0, 0.26, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#2c2f36"; g.beginPath(); g.arc(0, 0, 0.14, 0, 7); g.fill();
      break;
    }
    case "bank": {
      g.beginPath(); g.arc(0, 0, 0.25, 0, 7); g.fill(); g.stroke();
      g.save(); g.scale(0.01, 0.01);
      g.fillStyle = "#8a6a10"; g.font = "bold 32px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("$", 0, 2);
      g.restore();
      break;
    }
  }
  // Level pips along the bottom edge.
  for (let i = 0; i < level; i++) {
    g.fillStyle = "#ffd56b";
    g.beginPath(); g.arc(-0.16 + i * 0.16, 0.3, 0.05, 0, 7); g.fill();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const iconCache = new Map();
export function towerIcon(type) {
  if (iconCache.has(type)) return iconCache.get(type);
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  g.translate(48, 48);
  g.scale(100, 100);
  drawTower(g, type, 0, -Math.PI / 4);
  const url = c.toDataURL();
  iconCache.set(type, url);
  return url;
}

function drawEnemy(g, e, time) {
  const r = e.size;
  if (e.flying) {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath(); g.ellipse(e.x + 0.1, e.y + 0.3, r * 0.9, r * 0.4, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath(); g.ellipse(e.x, e.y + r * 0.7, r * 0.9, r * 0.35, 0, 0, 7); g.fill();
  }
  const y = e.flying ? e.y - 0.12 + Math.sin(time * 6 + e.id) * 0.04 : e.y;
  if (e.flying) {
    const flap = Math.sin(time * 14 + e.id) * 0.5;
    g.fillStyle = "#4a5a8a";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(e.x, y);
      g.lineTo(e.x + s * r * 2.1, y - r * (0.5 + flap));
      g.lineTo(e.x + s * r * 1.4, y + r * 0.4);
      g.closePath(); g.fill();
    }
  }
  if (e.boss) {
    g.fillStyle = "#ffd56b";
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.35;
      g.lineTo(e.x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0);
      g.lineTo(e.x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
    }
    g.fill();
  }
  g.fillStyle = e.flash > 0 ? "#ffffff" : e.color;
  g.strokeStyle = e.elite ? "#ffd56b" : "rgba(0,0,0,0.55)";
  g.lineWidth = e.elite ? 0.07 : 0.04;
  g.beginPath();
  if (e.type === "tank" || e.type === "juggernaut") roundRect(g, e.x - r, y - r, r * 2, r * 2, r * 0.35);
  else if (e.type === "splitter" || e.type === "slimelet") g.ellipse(e.x, y + r * 0.15, r, r * 0.8, 0, 0, 7);
  else if (e.type === "runner") { g.moveTo(e.x + r * 1.2, y); g.lineTo(e.x - r * 0.8, y - r); g.lineTo(e.x - r * 0.8, y + r); g.closePath(); }
  else g.arc(e.x, y, r, 0, 7);
  g.fill(); g.stroke();
  g.fillStyle = "#1a1a1a";
  g.beginPath(); g.arc(e.x - r * 0.3, y - r * 0.15, r * 0.14, 0, 7); g.arc(e.x + r * 0.3, y - r * 0.15, r * 0.14, 0, 7); g.fill();
  if (e.slowT > 0) {
    g.strokeStyle = "rgba(150,220,255,0.8)"; g.lineWidth = 0.04;
    g.beginPath(); g.arc(e.x, y, r + 0.06, 0, 7); g.stroke();
  }
  if (e.poisonT > 0) {
    g.fillStyle = "#9be05a";
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + i * 2.1;
      g.beginPath(); g.arc(e.x + Math.cos(a) * r, y + Math.sin(a) * r, 0.04, 0, 7); g.fill();
    }
  }
  if (e.burnT > 0) {
    g.fillStyle = `rgba(255,${120 + Math.sin(time * 20 + e.id) * 60},40,0.8)`;
    g.beginPath(); g.arc(e.x + Math.sin(time * 9 + e.id) * r * 0.4, y - r * 0.9, 0.07, 0, 7); g.fill();
  }
  if (e.hp < e.maxHp) {
    const w = Math.max(0.5, r * 2.2), bh = e.boss ? 0.1 : 0.07;
    const bx = e.x - w / 2, by = y - r - (e.boss ? 0.55 : 0.18);
    g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(bx - 0.02, by - 0.02, w + 0.04, bh + 0.04);
    const f = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = f > 0.5 ? "#6fdc6f" : f > 0.25 ? "#e8c94a" : "#e8564a";
    g.fillRect(bx, by, w * f, bh);
  }
}

export function drawBattle(g, b, view) {
  const { scale, dpr, bg, time } = view;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(bg, 0, 0);
  g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

  const sel = view.selected;
  const ghost = view.ghost;
  if (ghost) {
    const ok = b.canBuild(ghost.x, ghost.y);
    g.fillStyle = ok ? "rgba(255,255,255,0.18)" : "rgba(255,60,60,0.25)";
    g.fillRect(ghost.x, ghost.y, 1, 1);
  }

  for (const t of b.towers) {
    g.save();
    g.translate(t.x, t.y);
    drawTower(g, t.type, t.level, t.angle, time);
    g.restore();
  }
  if (ghost && b.canBuild(ghost.x, ghost.y)) {
    g.save();
    g.globalAlpha = 0.6;
    g.translate(ghost.x + 0.5, ghost.y + 0.5);
    drawTower(g, view.placing, 1, -Math.PI / 2, time);
    g.restore();
  }

  const rangeOf = sel ? { x: sel.x, y: sel.y, s: sel.stats } : ghost && view.ghostStats ? { x: ghost.x + 0.5, y: ghost.y + 0.5, s: view.ghostStats } : null;
  if (rangeOf && rangeOf.s.range) {
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 0.03;
    g.beginPath(); g.arc(rangeOf.x, rangeOf.y, rangeOf.s.range, 0, 7); g.fill(); g.stroke();
    if (rangeOf.s.minRange) {
      g.strokeStyle = "rgba(255,120,120,0.5)";
      g.beginPath(); g.arc(rangeOf.x, rangeOf.y, rangeOf.s.minRange, 0, 7); g.stroke();
    }
  }
  if (sel) {
    g.strokeStyle = "#ffd56b"; g.lineWidth = 0.05;
    g.strokeRect(sel.tx + 0.04, sel.ty + 0.04, 0.92, 0.92);
  }

  const ground = b.enemies.filter(e => !e.flying), air = b.enemies.filter(e => e.flying);
  for (const e of ground) drawEnemy(g, e, time);

  for (const s of b.shots) {
    if (s.kind === "arrow") {
      g.save(); g.translate(s.x, s.y); g.rotate(s.angle || 0);
      g.strokeStyle = "#f3e2c0"; g.lineWidth = 0.04;
      g.beginPath(); g.moveTo(-0.18, 0); g.lineTo(0.08, 0); g.stroke();
      g.restore();
    } else if (s.kind === "mortar") {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.beginPath(); g.arc(s.x, s.y, 0.08, 0, 7); g.fill();
      g.fillStyle = "#2a2a2a";
      g.beginPath(); g.arc(s.x, s.y - s.h, 0.11, 0, 7); g.fill();
    } else {
      g.fillStyle = s.kind === "shell" ? "#2a2a2a" : s.kind === "frost" ? "#bff0ff" : "#9be05a";
      g.beginPath(); g.arc(s.x, s.y, s.kind === "shell" ? 0.09 : 0.07, 0, 7); g.fill();
    }
  }

  for (const e of air) drawEnemy(g, e, time);

  for (const f of b.fx) {
    const k = f.t / f.life;
    switch (f.kind) {
      case "boom": case "frostburst":
        g.fillStyle = f.kind === "boom" ? `rgba(255,${180 - k * 120},60,${0.7 * (1 - k)})` : `rgba(180,235,255,${0.6 * (1 - k)})`;
        g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + 0.5 * k), 0, 7); g.fill();
        break;
      case "pop":
        g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 0.05;
        g.beginPath(); g.arc(f.x, f.y, f.r * (1 + k), 0, 7); g.stroke();
        g.globalAlpha = 1;
        break;
      case "ring":
        g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 0.05;
        g.beginPath(); g.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, 7); g.stroke();
        g.globalAlpha = 1;
        break;
      case "flame":
        g.fillStyle = `rgba(255,140,40,${0.25 * (1 - k)})`;
        g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
        break;
      case "line":
        g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = f.w;
        g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke();
        g.globalAlpha = 1;
        break;
      case "zap":
        g.strokeStyle = `rgba(210,180,255,${1 - k})`; g.lineWidth = 0.05;
        g.beginPath();
        f.pts.forEach((p, i) => {
          if (!i) return g.moveTo(p.x, p.y);
          const q = f.pts[i - 1];
          const mx = (p.x + q.x) / 2 + (Math.random() - 0.5) * 0.3, my = (p.y + q.y) / 2 + (Math.random() - 0.5) * 0.3;
          g.lineTo(mx, my); g.lineTo(p.x, p.y);
        });
        g.stroke();
        break;
      case "text":
        g.save();
        g.globalAlpha = 1 - k * k;
        g.translate(f.x, f.y - k * 0.5);
        g.scale(0.01, 0.01);
        g.fillStyle = f.color;
        g.font = "bold 32px system-ui, sans-serif";
        g.textAlign = "center";
        g.strokeStyle = "rgba(0,0,0,0.7)"; g.lineWidth = 6;
        g.strokeText(f.str, 0, 0);
        g.fillText(f.str, 0, 0);
        g.restore();
        break;
    }
  }
}
