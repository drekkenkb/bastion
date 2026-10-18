// A run: the act map, what the player owns, and the screens between battles. The whole run is plain JSON so it can
// be saved after every step.
import { TOWERS, RELICS, PERKS, EVENTS, STARTING_TOWERS } from "./data.js";
import { makeRng } from "./stats.js";

export const ACTS = 3;
export const ROWS = 9; // rows 0..7 are rooms, row 8 is the boss
export const COLS = 5;
const SAVE_KEY = "bastion.run";
const STATS_KEY = "bastion.stats";

export function newRun(seed = (Math.random() * 2 ** 32) >>> 0) {
  const run = {
    seed, act: 0, pos: null, visited: [], map: null,
    lives: 20, maxLives: 20, coins: 0,
    towers: [...STARTING_TOWERS], perks: [], relics: [],
    kills: 0, battles: 0, pending: null, over: null,
  };
  run.map = genMap(rngFor(run, "map"));
  const rng = rngFor(run, "start");
  run.pending = { type: "relicPick", title: "Choose a starting relic", options: randomRelics(run, rng, 3) };
  return run;
}

export function depth(run, row) { return run.act * ROWS + row; }

export function rngFor(run, ...parts) {
  let h = run.seed ^ 0x9e3779b9;
  for (const ch of [run.act, ...parts].join("/")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return makeRng(h);
}

function genMap(rng) {
  const rows = Array.from({ length: ROWS - 1 }, () => new Map());
  const edges = new Set();
  const ek = (r, a, b) => `${r}:${a}>${b}`;
  const starts = rng.shuffle([0, 1, 2, 3, 4]);
  for (let p = 0; p < 4; p++) {
    let c = p < 2 ? starts[p] : rng.int(COLS);
    for (let r = 0; r < ROWS - 1; r++) {
      if (!rows[r].has(c)) rows[r].set(c, { r, c, type: "battle", next: [] });
      if (r === ROWS - 2) break;
      const opts = [c - 1, c, c + 1].filter(n => n >= 0 && n < COLS
        && !(n === c + 1 && edges.has(ek(r, c + 1, c)))
        && !(n === c - 1 && edges.has(ek(r, c - 1, c))));
      const n = rng.pick(opts);
      edges.add(ek(r, c, n));
      const node = rows[r].get(c);
      if (!node.next.includes(n)) node.next.push(n);
      c = n;
    }
  }
  const table = r => r <= 2
    ? [["battle", 60], ["event", 25], ["shop", 15]]
    : [["battle", 44], ["elite", 18], ["event", 18], ["shop", 10], ["rest", r === 6 ? 0 : 10]];
  for (let r = 1; r < ROWS - 1; r++) {
    for (const node of rows[r].values()) {
      if (r === 4) node.type = "treasure";
      else if (r === ROWS - 2) node.type = "rest";
      else {
        const t = table(r);
        let x = rng.next() * t.reduce((a, e) => a + e[1], 0);
        for (const [type, w] of t) { x -= w; if (x <= 0) { node.type = type; break; } }
      }
    }
  }
  const out = rows.map(m => [...m.values()].sort((a, b) => a.c - b.c));
  out.push([{ r: ROWS - 1, c: 2, type: "boss", next: [] }]);
  for (const n of out[ROWS - 2]) n.next = [2];
  return out;
}

export function nodeAt(run, r, c) { return run.map[r]?.find(n => n.c === c) || null; }

export function available(run) {
  if (!run.pos) return run.map[0];
  const cur = nodeAt(run, run.pos.r, run.pos.c);
  return cur.next.map(c => nodeAt(run, run.pos.r + 1, c));
}

// Moving onto a node sets up whatever screen it leads to.
export function enter(run, node) {
  run.pos = { r: node.r, c: node.c };
  run.visited.push([node.r, node.c]);
  const rng = rngFor(run, "node", node.r, node.c);
  switch (node.type) {
    case "battle": case "elite": case "boss":
      run.pending = { type: "battle", kind: node.type, row: node.r };
      break;
    case "shop": run.pending = makeShop(run, rng); break;
    case "rest": run.pending = { type: "rest" }; break;
    case "treasure":
      run.pending = { type: "relicPick", title: "Treasure!", options: randomRelics(run, rng, 1) };
      break;
    case "event": {
      const ev = EVENTS[rng.int(EVENTS.length)];
      run.pending = { type: "event", event: EVENTS.indexOf(ev) };
      break;
    }
  }
}

export function battleWon(run, kind, row, kills) {
  run.battles++;
  run.kills += kills;
  const rng = rngFor(run, "reward", row);
  const coinMult = run.relics.includes("coin") ? 1.5 : 1;
  const base = kind === "boss" ? 70 : kind === "elite" ? 38 : 18;
  const coins = Math.round((base + rng.int(10)) * coinMult);
  run.coins += coins;
  let healed = 0;
  if (run.relics.includes("bandage")) healed += heal(run, 2);
  const rewards = [];
  if (kind === "elite") {
    const r = randomRelics(run, rng, 1);
    if (r.length) { addRelic(run, r[0]); rewards.push({ relic: r[0] }); }
  }
  if (kind === "boss") healed += heal(run, run.maxLives);
  run.pending = {
    type: "reward", kind, coins, healed, rewards,
    cards: cardChoices(run, rng, 3),
    relics: kind === "boss" ? randomRelics(run, rng, 3) : null,
  };
}

export function finishReward(run, kind = run.pending?.kind) {
  if (kind === "boss") {
    if (run.act === ACTS - 1) return endRun(run, true);
    run.act++;
    run.pos = null;
    run.visited = [];
    run.map = genMap(rngFor(run, "map"));
  }
  run.pending = null;
}

export function heal(run, n) {
  const before = run.lives;
  run.lives = Math.min(run.maxLives, run.lives + n);
  return run.lives - before;
}

export function addRelic(run, id) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === "idol") { run.maxLives += 6; run.lives += 6; }
}

export function randomRelics(run, rng, n) {
  return rng.shuffle(Object.keys(RELICS).filter(id => !run.relics.includes(id))).slice(0, n);
}

export function perkChoices(run, rng, n) {
  const opts = [];
  for (const tower of run.towers) {
    for (const [id, p] of Object.entries(PERKS)) {
      if (p.generic && tower !== "bank" && !(id === "cost" && run.perks.filter(x => x.id === "cost" && x.tower === tower).length >= 2)) opts.push({ id, tower });
      if (p.tower === tower && !run.perks.some(x => x.id === id)) opts.push({ id, tower }, { id, tower }); // specials come up more often
    }
  }
  const out = [];
  for (const o of rng.shuffle(opts)) {
    if (out.length >= n) break;
    if (!out.some(x => x.id === o.id && x.tower === o.tower)) out.push(o);
  }
  return out;
}

// Reward cards are new towers or perks for towers you have.
export function cardChoices(run, rng, n) {
  const missing = rng.shuffle(Object.keys(TOWERS).filter(t => !run.towers.includes(t)));
  const cards = [];
  const towerSlots = missing.length ? (rng.chance(0.5) ? 2 : 1) : 0;
  for (let i = 0; i < towerSlots && i < missing.length; i++) cards.push({ tower: missing[i] });
  for (const p of perkChoices(run, rng, n - cards.length)) cards.push({ perk: p });
  return rng.shuffle(cards);
}

export function takeCard(run, card) {
  if (card.tower && !run.towers.includes(card.tower)) run.towers.push(card.tower);
  if (card.perk) run.perks.push(card.perk);
}

function makeShop(run, rng) {
  const disc = run.relics.includes("haggler") ? 0.75 : 1;
  const price = p => Math.round(p * disc);
  const items = [];
  for (const id of randomRelics(run, rng, 3)) items.push({ relic: id, price: price(95 + rng.int(50)) });
  const missing = rng.shuffle(Object.keys(TOWERS).filter(t => !run.towers.includes(t)));
  if (missing.length) items.push({ card: { tower: missing[0] }, price: price(60) });
  for (const p of perkChoices(run, rng, 2)) items.push({ card: { perk: p }, price: price(45) });
  items.push({ heal: 6, price: price(35) });
  return { type: "shop", items };
}

export function buy(run, i) {
  const item = run.pending.items[i];
  if (!item || item.sold || run.coins < item.price) return false;
  if (item.heal && run.lives >= run.maxLives) return false;
  run.coins -= item.price;
  item.sold = true;
  if (item.relic) addRelic(run, item.relic);
  if (item.card) takeCard(run, item.card);
  if (item.heal) heal(run, item.heal);
  return true;
}

// Returns a message describing what happened, and may replace pending with a follow-up choice.
export function eventChoice(run, fx) {
  const rng = rngFor(run, "event", run.pos.r, run.pos.c, fx);
  run.pending = null;
  switch (fx) {
    case "relicForLives": {
      run.lives = Math.max(1, run.lives - 4);
      const [r] = randomRelics(run, rng, 1);
      if (r) addRelic(run, r);
      return r ? `You gained ${RELICS[r].name}.` : "The cart is empty.";
    }
    case "coins45": run.coins += 45; return "+45 coins.";
    case "healFull": heal(run, run.maxLives); return "Your forces are fully healed.";
    case "heal8": return `Healed ${heal(run, 8)} lives.`;
    case "raid": run.coins += 60; run.lives = Math.max(1, run.lives - 3); return "+60 coins, -3 lives.";
    case "perk":
      run.pending = { type: "cardPick", title: "Choose a perk", cards: perkChoices(run, rng, 3).map(p => ({ perk: p })) };
      return null;
    case "gamble": {
      if (run.coins < 30) return "You can't afford it.";
      run.coins -= 30;
      if (rng.chance(0.5)) {
        const [r] = randomRelics(run, rng, 1);
        if (r) { addRelic(run, r); return `Heads! You won ${RELICS[r].name}.`; }
      }
      return "Tails. The gambler pockets your coins.";
    }
    case "towerForCoins": {
      const missing = Object.keys(TOWERS).filter(t => !run.towers.includes(t));
      if (!missing.length) { run.coins += 25; return "You already have every tower. They pay you 25 coins to leave."; }
      run.coins = Math.max(0, run.coins - 25);
      const t = rng.pick(missing);
      run.towers.push(t);
      return `You can now build ${TOWERS[t].name} towers.`;
    }
    default: return null;
  }
}

export function endRun(run, won) {
  run.over = { won, act: run.act, row: run.pos?.r ?? 0 };
  run.pending = { type: "over" };
  const st = loadStats();
  st.runs++;
  if (won) st.wins++;
  const reached = run.act * ROWS + (run.pos?.r ?? 0) + (won ? 1 : 0);
  st.best = Math.max(st.best, reached);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(st)); } catch {}
}

export function loadStats() {
  try { return { runs: 0, wins: 0, best: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || "{}") }; }
  catch { return { runs: 0, wins: 0, best: 0 }; }
}

export function saveRun(run) {
  try {
    if (!run || run.over) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  } catch {}
}

export function loadRun() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { return null; }
}
