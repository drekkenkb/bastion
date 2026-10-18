// Builds a battlefield (a winding path across a grid) and the waves that walk it.
import { ENEMIES, BOSSES } from "./data.js";

export const GRASS = 0, PATH = 1, ROCK = 2;

// The path is a self-avoiding walk from the left edge to the right edge that never runs alongside itself, so every
// path tile has grass on both sides. Portrait screens get the same thing transposed (top to bottom).
export function genField(rng, portrait) {
  const w = 15, h = 9;
  const minLen = 30;
  let cells = null;
  for (let attempt = 0; attempt < 5000 && !cells; attempt++) cells = walk(rng, w, h, minLen);
  if (!cells) throw new Error("couldn't generate a path");

  const tiles = new Uint8Array(w * h);
  for (const [x, y] of cells) tiles[y * w + x] = PATH;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === GRASS && rng.chance(0.07)) tiles[i] = ROCK;

  const first = cells[0], last = cells[cells.length - 1];
  const pts = [[first[0] - 1, first[1]], ...cells, [last[0] + 1, last[1]]].map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
  if (!portrait) return { w, h, tiles, path: pts };

  const t2 = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t2[x * h + y] = tiles[y * w + x];
  return { w: h, h: w, tiles: t2, path: pts.map(p => ({ x: p.y, y: p.x })) };
}

function walk(rng, w, h, minLen) {
  const key = (x, y) => y * w + x;
  let x = 0, y = 1 + rng.int(h - 2);
  const cells = [[x, y]];
  const used = new Set([key(x, y)]);
  let dir = [1, 0];
  while (x !== w - 1) {
    const opts = [];
    for (const [dx, dy, base] of [[1, 0, 2], [0, 1, 2.2], [0, -1, 2.2], [-1, 0, 0.7]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || nx >= w || ny < 0 || ny >= h || used.has(key(nx, ny))) continue;
      if (nx === w - 1 && cells.length + 1 < minLen) continue;
      // The new cell may only touch the cell we came from.
      let touches = false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = nx + ax, ty = ny + ay;
        if ((tx !== x || ty !== y) && used.has(key(tx, ty))) touches = true;
      }
      if (touches) continue;
      let wt = base * (dx === dir[0] && dy === dir[1] ? 1.8 : 1);
      if (nx === w - 1) wt = 6; // finish once long enough
      opts.push([nx, ny, dx, dy, wt]);
    }
    if (!opts.length) return null;
    let r = rng.next() * opts.reduce((a, o) => a + o[4], 0);
    let o = opts[0];
    for (const c of opts) { r -= c[4]; if (r <= 0) { o = c; break; } }
    [x, y] = o;
    dir = [o[2], o[3]];
    cells.push([x, y]);
    used.add(key(x, y));
    if (cells.length > w * h) return null;
  }
  return cells;
}

// depth runs 0..26 over a run (act * 9 + row). kind is "battle", "elite" or "boss".
export function genWaves(rng, depth, kind, act) {
  const hpScale = (1 + 0.11 * depth + 0.0035 * depth * depth) * (kind === "elite" ? 1.1 : 1);
  const goldScale = 1 + 0.035 * depth;
  const count = kind === "battle" ? 6 : kind === "elite" ? 7 : 8;
  const pool = Object.keys(ENEMIES).filter(id => ENEMIES[id].minD <= depth);
  const waves = [];
  for (let w = 0; w < count; w++) {
    let budget = (7 + 3.2 * w) * (1 + 0.04 * depth);
    const spawns = [];
    let t = 0;
    // Each wave leans on one or two enemy types so it has a character (a rush of runners, a line of brutes...).
    const types = [rng.pick(pool)];
    if (w > 1 && pool.length > 1 && rng.chance(0.6)) types.push(rng.pick(pool));
    if (w === 0) types[0] = "grunt";
    let eliteLeft = kind === "elite" ? (w === count - 1 ? 3 : w >= 2 ? 1 : 0) : 0;
    while (budget > 0) {
      const type = rng.pick(types);
      const e = ENEMIES[type];
      const groupCost = Math.max(e.cost * 3, 2.5);
      const n = Math.max(1, Math.round(Math.min(budget, groupCost) / e.cost));
      for (let i = 0; i < n; i++) {
        const elite = eliteLeft > 0 && rng.chance(0.25);
        if (elite) eliteLeft--;
        spawns.push({ t, type, elite });
        t += (e.gap || 0.8) * (elite ? 1.5 : 1);
      }
      budget -= n * e.cost;
      t += 1.2;
    }
    while (eliteLeft > 0) { spawns.push({ t, type: rng.pick(types), elite: true }); t += 1.5; eliteLeft--; }
    waves.push(spawns);
  }
  if (kind === "boss") {
    const last = waves[count - 1];
    const end = last.length ? last[last.length - 1].t : 0;
    last.push({ t: end + 3, boss: BOSSES[act].id });
  }
  return { hpScale, goldScale, waves };
}
