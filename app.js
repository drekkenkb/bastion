// Screens and input: the title, the act map, the screens between fights, and the battle view.
import { TOWERS, RELICS, PERKS, EVENTS } from "./data.js";
import * as R from "./run.js";
import { Battle, TARGET_MODES } from "./battle.js";
import { genField, genWaves } from "./level.js";
import { computeMods, towerStats, MAX_LEVEL } from "./stats.js";
import { drawBackground, drawBattle, towerIcon } from "./render.js";

const $ = id => document.getElementById(id);
const ACT_NAMES = ["The Outskirts", "The Marches", "The Citadel"];
const NODE_ICONS = { battle: "⚔️", elite: "💀", shop: "🛒", rest: "🔥", event: "❓", treasure: "💎", boss: "👑" };
const NODE_NAMES = { battle: "Battle", elite: "Elite battle", shop: "Shop", rest: "Campfire", event: "Unknown", treasure: "Treasure", boss: "Boss" };

let run = null;
let st = null; // the battle in progress, with its view state

function show(id) {
  for (const s of ["title", "map", "battle"]) $(s).hidden = s !== id;
}
const save = () => R.saveRun(run);
const fmt = n => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toString();

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function modal(html, bind) {
  $("sheet").innerHTML = html;
  $("sheet").scrollTop = 0;
  $("modal").hidden = false;
  bind?.($("sheet"));
}
function closeModal() { $("modal").hidden = true; }
function on(root, sel, fn) { root.querySelectorAll(sel).forEach(el => el.addEventListener("click", () => fn(el))); }

// ---------- Title ----------

function describeDepth(d) {
  return d >= R.ACTS * R.ROWS ? "Victory" : `Act ${Math.floor(d / R.ROWS) + 1}, floor ${(d % R.ROWS) + 1}`;
}

function showTitle() {
  st = null;
  closeModal();
  show("title");
  $("btn-continue").hidden = !R.loadRun();
  const s = R.loadStats();
  $("stats").textContent = s.runs ? `Runs ${s.runs} · Wins ${s.wins} · Best: ${describeDepth(s.best)}` : "";
}

$("btn-new").addEventListener("click", () => {
  const start = () => { run = R.newRun(); save(); route(); };
  if (!R.loadRun()) return start();
  modal(`<h2>Start over?</h2><p>Your current run will be lost.</p>
    <div class="row"><button data-a="no">Cancel</button><button class="primary" data-a="yes">New run</button></div>`, root => {
    on(root, "[data-a=no]", closeModal);
    on(root, "[data-a=yes]", start);
  });
});
$("btn-continue").addEventListener("click", () => { run = R.loadRun(); if (run) route(); });
$("btn-help").addEventListener("click", () => showHelp());

function showHelp(back = closeModal) {
  modal(`<h2>How to play</h2>
    <ul class="help">
      <li>Fight your way up the map through three acts. Each act ends with a boss.</li>
      <li>In a battle, pick a tower from the bar at the bottom and tap a grass tile to build it. On a touchscreen, the
        first tap shows its range and the second tap builds.</li>
      <li>Tap a tower to upgrade it, sell it, or change what it aims at.</li>
      <li>Press <b>Start</b> when you're ready, then <b>Next</b> for each wave after. Sending the next wave while enemies are still on the field pays a bonus.</li>
      <li>Turn on <b>Auto</b> to send every wave early on its own, bonus included, as soon as the previous one has finished arriving. You still press Start yourself.</li>
      <li>Every enemy that gets through costs lives (more for elites and bosses), and <b>lives carry over between battles</b>.
        Gold doesn't: every battle starts fresh.</li>
      <li>Winning earns coins for shops and a choice of rewards: new towers, tower perks, and relics that change the rules.</li>
      <li>💀 Elites are tougher but drop a relic. 🔥 Campfires heal or train. ❓ is a random event. 🛒 sells relics and perks.</li>
    </ul>
    <div class="row"><button class="primary" data-a="ok">Got it</button></div>`, root => on(root, "[data-a=ok]", back));
}

// ---------- Routing between screens ----------

function route() {
  closeModal();
  const p = run.pending;
  if (p?.type === "battle") return startBattle();
  showMap();
  if (!p) return;
  ({ relicPick: showRelicPick, reward: showReward, shop: showShop, rest: showRest, event: showEvent,
    cardPick: showCardPick, over: showOver })[p.type]?.();
}

function next() { save(); route(); }

// ---------- Map ----------

function relicButtons(el) {
  el.innerHTML = run.relics.map(id => `<button class="relic" data-id="${id}" title="${RELICS[id].name}">${RELICS[id].icon}</button>`).join("")
    || `<span class="muted" style="font-size:13px;align-self:center">No relics yet</span>`;
  on(el, ".relic", b => toast(`${RELICS[b.dataset.id].name}: ${RELICS[b.dataset.id].desc}`, 3500));
}

function towerChips(el) {
  el.innerHTML = run.towers.map(t => {
    const n = run.perks.filter(p => p.tower === t).length;
    return `<button class="chip" data-t="${t}"><img src="${towerIcon(t)}" alt="">${TOWERS[t].name}${n ? ` <b>+${n}</b>` : ""}</button>`;
  }).join("");
  on(el, ".chip", b => {
    const t = b.dataset.t;
    const perks = run.perks.filter(p => p.tower === t).map(p => PERKS[p.id].name);
    toast(`${TOWERS[t].name}: ${TOWERS[t].desc}${perks.length ? ` Perks: ${perks.join(", ")}.` : ""}`, 4000);
  });
}

function showMap() {
  st = null;
  show("map");
  $("map-lives").textContent = `♥ ${run.lives}/${run.maxLives}`;
  $("map-coins").textContent = `🪙 ${run.coins}`;
  $("map-act").textContent = `Act ${run.act + 1} · ${ACT_NAMES[run.act]}`;
  relicButtons($("map-relics"));
  towerChips($("map-towers"));
  drawMap();
}

function drawMap() {
  const board = $("map-board");
  const scroll = $("map-scroll");
  const width = Math.min(scroll.clientWidth, 520);
  const pad = 34;
  const rowH = 78, top = 56;
  const height = top + (R.ROWS - 1) * rowH + 56;
  board.style.height = `${height}px`;
  const rng = R.rngFor(run, "mapjitter");
  const pos = new Map();
  for (const row of run.map) {
    for (const n of row) {
      const jx = n.type === "boss" ? 0 : (rng.next() - 0.5) * 0.06 * width;
      const jy = n.type === "boss" ? 0 : (rng.next() - 0.5) * 14;
      pos.set(`${n.r},${n.c}`, { x: pad + (n.c + 0.5) / R.COLS * (width - 2 * pad) + jx, y: top + (R.ROWS - 1 - n.r) * rowH + jy });
    }
  }
  const visited = new Set(run.visited.map(([r, c]) => `${r},${c}`));
  const open = run.pending ? new Set() : new Set(R.available(run).map(n => `${n.r},${n.c}`));
  let lines = "";
  for (const row of run.map) {
    for (const n of row) {
      const a = pos.get(`${n.r},${n.c}`);
      for (const c of n.next) {
        const k = `${n.r + 1},${c}`, b = pos.get(k);
        const walked = visited.has(`${n.r},${n.c}`) && visited.has(k);
        lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${walked ? "#f2c94c" : "#4a5366"}"
          stroke-width="${walked ? 3 : 2}" ${walked ? "" : 'stroke-dasharray="4 5"'}/>`;
      }
    }
  }
  let nodes = "";
  for (const row of run.map) {
    for (const n of row) {
      const k = `${n.r},${n.c}`, p = pos.get(k);
      const cur = run.pos && run.pos.r === n.r && run.pos.c === n.c;
      const cls = ["node", n.type === "boss" && "boss", visited.has(k) && "visited", cur && "current", open.has(k) && "open"].filter(Boolean).join(" ");
      nodes += `<button class="${cls}" style="left:${p.x}px;top:${p.y}px" data-k="${k}" title="${NODE_NAMES[n.type]}">${NODE_ICONS[n.type]}</button>`;
    }
  }
  board.style.width = `${width}px`;
  board.innerHTML = `<svg viewBox="0 0 ${width} ${height}">${lines}</svg>${nodes}`;
  on(board, ".node", el => {
    const [r, c] = el.dataset.k.split(",").map(Number);
    const n = R.nodeAt(run, r, c);
    if (!open.has(el.dataset.k)) return toast(NODE_NAMES[n.type]);
    R.enter(run, n);
    next();
  });
  if (!$("map-legend")) {
    scroll.insertAdjacentHTML("beforeend", `<div class="map-legend" id="map-legend">⚔️ battle · 💀 elite · ❓ event · 🛒 shop · 🔥 campfire · 💎 treasure · 👑 boss</div>`);
  }
  // Keep the next choices in view: the map runs bottom to top.
  const focusRow = run.pos ? run.pos.r + 1 : 0;
  scroll.scrollTop = top + (R.ROWS - 1 - focusRow) * rowH - scroll.clientHeight * 0.55;
}

// ---------- Screens between battles ----------

function cardHtml(card) {
  if (card.tower) {
    const t = TOWERS[card.tower];
    return `<img src="${towerIcon(card.tower)}" alt=""><div><span class="tag">New tower</span><b>${t.name}</b><small>${t.desc} Costs ${t.cost}.</small></div>`;
  }
  const p = PERKS[card.perk.id], t = TOWERS[card.perk.tower];
  return `<img src="${towerIcon(card.perk.tower)}" alt=""><div><span class="tag">${t.name} perk</span><b>${p.name}</b><small>${p.desc}</small></div>`;
}

function relicHtml(id) {
  const r = RELICS[id];
  return `<span class="big">${r.icon}</span><div><span class="tag">Relic</span><b>${r.name}</b><small>${r.desc}</small></div>`;
}

function showRelicPick() {
  const p = run.pending;
  const start = run.visited.length === 0 && run.act === 0 && !run.relics.length;
  modal(`<h2>${p.title}</h2>
    ${p.options.length ? `<div class="picks">${p.options.map((id, i) => `<button class="pick" data-i="${i}">${relicHtml(id)}</button>`).join("")}</div>`
      : `<p class="muted">There's nothing left to find.</p>`}
    <div class="row">${start && p.options.length ? "" : `<button data-a="skip">${p.options.length ? "Skip" : "Continue"}</button>`}</div>`, root => {
    const done = () => {
      if (p.boss) R.finishReward(run, "boss");
      else run.pending = null;
      next();
    };
    on(root, ".pick", el => { R.addRelic(run, p.options[+el.dataset.i]); done(); });
    on(root, "[data-a=skip]", done);
  });
}

function showReward() {
  const p = run.pending;
  const gains = [`<span style="color:var(--gold)">+${p.coins} coins</span>`];
  if (p.healed) gains.push(`<span style="color:var(--green)">+${p.healed} ♥</span>`);
  for (const r of p.rewards) if (r.relic) gains.push(`<span>${RELICS[r.relic].icon} ${RELICS[r.relic].name}</span>`);
  modal(`<h2>${p.kind === "boss" ? "Boss defeated!" : "Victory!"}</h2>
    <div class="gains">${gains.join("")}</div>
    ${p.cards.length ? `<h3>Choose a reward</h3><div class="picks">${p.cards.map((c, i) => `<button class="pick" data-i="${i}">${cardHtml(c)}</button>`).join("")}</div>` : ""}
    <div class="row"><button data-a="skip">${p.cards.length ? "Skip" : "Continue"}</button></div>`, root => {
    const done = () => {
      if (p.relics?.length) run.pending = { type: "relicPick", title: "Choose a boss relic", options: p.relics, boss: true };
      else R.finishReward(run);
      next();
    };
    on(root, ".pick", el => { R.takeCard(run, p.cards[+el.dataset.i]); done(); });
    on(root, "[data-a=skip]", done);
  });
}

function showShop() {
  const p = run.pending;
  const item = (it, i) => {
    const body = it.relic ? relicHtml(it.relic) : it.card ? cardHtml(it.card)
      : `<span class="big">❤️</span><div><span class="tag">Supplies</span><b>Heal ${it.heal}</b><small>Restore ${it.heal} lives.</small></div>`;
    const can = !it.sold && run.coins >= it.price && !(it.heal && run.lives >= run.maxLives);
    return `<button class="pick ${it.sold ? "sold" : ""}" data-i="${i}" ${can ? "" : "disabled"}>${body}
      <span class="price">${it.sold ? "Sold" : `🪙 ${it.price}`}</span></button>`;
  };
  modal(`<h2>Shop</h2><p>You have <b style="color:var(--gold)">🪙 ${run.coins}</b> · ♥ ${run.lives}/${run.maxLives}</p>
    <div class="picks">${p.items.map(item).join("")}</div>
    <div class="row"><button class="primary" data-a="leave">Leave</button></div>`, root => {
    on(root, ".pick", el => {
      if (R.buy(run, +el.dataset.i)) { save(); showMap(); showShop(); }
    });
    on(root, "[data-a=leave]", () => { run.pending = null; next(); });
  });
}

function showRest() {
  const amount = Math.ceil(run.maxLives * 0.3);
  const missing = run.maxLives - run.lives;
  modal(`<h2>🔥 Campfire</h2><p>Your troops gather around the fire. ♥ ${run.lives}/${run.maxLives}</p>
    <div class="picks">
      <button class="pick" data-a="heal" ${missing ? "" : "disabled"}><span class="big">❤️</span><div><b>Rest</b><small>Heal ${Math.min(amount, missing)} lives.</small></div></button>
      <button class="pick" data-a="train"><span class="big">🛠️</span><div><b>Train</b><small>Choose a perk for one of your towers.</small></div></button>
    </div>`, root => {
    on(root, "[data-a=heal]", () => { R.heal(run, amount); run.pending = null; next(); });
    on(root, "[data-a=train]", () => {
      const rng = R.rngFor(run, "train", run.pos.r, run.pos.c);
      run.pending = { type: "cardPick", title: "Choose a perk", cards: R.perkChoices(run, rng, 3).map(p => ({ perk: p })) };
      next();
    });
  });
}

function showEvent() {
  const ev = EVENTS[run.pending.event];
  modal(`<h2>${ev.title}</h2><p>${ev.text}</p>
    <div class="row" style="flex-direction:column;align-items:stretch">${ev.options.map((o, i) => `<button data-i="${i}">${o.label}</button>`).join("")}</div>`, root => {
    on(root, "[data-i]", el => {
      const msg = R.eventChoice(run, ev.options[+el.dataset.i].fx);
      save();
      if (!msg) return route();
      showMap();
      modal(`<h2>${ev.title}</h2><p>${msg}</p><div class="row"><button class="primary" data-a="ok">Continue</button></div>`,
        root2 => on(root2, "[data-a=ok]", route));
    });
  });
}

function showCardPick() {
  const p = run.pending;
  modal(`<h2>${p.title}</h2><div class="picks">${p.cards.map((c, i) => `<button class="pick" data-i="${i}">${cardHtml(c)}</button>`).join("")}</div>
    <div class="row"><button data-a="skip">Skip</button></div>`, root => {
    on(root, ".pick", el => { R.takeCard(run, p.cards[+el.dataset.i]); run.pending = null; next(); });
    on(root, "[data-a=skip]", () => { run.pending = null; next(); });
  });
}

function showOver() {
  const o = run.over;
  modal(`<h2>${o.won ? "🏰 The Bastion stands!" : "The Bastion has fallen"}</h2>
    <p>${o.won ? "You defeated all three bosses." : `You fell in act ${o.act + 1}, on floor ${o.row + 1}.`}</p>
    <p class="muted">Battles won: ${run.battles} · Enemies slain: ${run.kills} · Relics: ${run.relics.length}</p>
    <div class="row"><button data-a="title">Title screen</button><button class="primary" data-a="new">New run</button></div>`, root => {
    on(root, "[data-a=title]", showTitle);
    on(root, "[data-a=new]", () => { run = R.newRun(); next(); });
  });
}

// ---------- Battle ----------

function startBattle() {
  show("battle");
  const p = run.pending;
  const wrap = $("field-wrap");
  const portrait = wrap.clientHeight > wrap.clientWidth * 1.1;
  const field = genField(R.rngFor(run, "field", p.row), portrait);
  const plan = genWaves(R.rngFor(run, "waves", p.row), R.depth(run, p.row), p.kind, run.act);
  const b = new Battle(field, plan, computeMods(run), run, { onLeak: save });
  st = { b, kind: p.kind, row: p.row, placing: null, selected: null, ghost: null, speed: st?.speed || 1, paused: false, auto,
    endAt: 0, time: 0, last: performance.now(), hud: {} };
  layoutBattle();
  renderDock();
  $("btn-speed").textContent = `${st.speed}×`;
  $("btn-auto").classList.toggle("on", auto);
  requestAnimationFrame(frame);
}

function layoutBattle() {
  if (!st) return;
  const wrap = $("field-wrap"), c = $("field"), f = st.b.field;
  const scale = Math.max(8, Math.min((wrap.clientWidth - 8) / f.w, (wrap.clientHeight - 8) / f.h));
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.style.width = `${f.w * scale}px`;
  c.style.height = `${f.h * scale}px`;
  c.width = Math.round(f.w * scale * dpr);
  c.height = Math.round(f.h * scale * dpr);
  st.scale = scale;
  st.dpr = dpr;
  st.bg = drawBackground(f, scale, dpr);
}
window.addEventListener("resize", () => { layoutBattle(); if (!$("map").hidden) drawMap(); });

function frame(now) {
  if (!st) return;
  const s = st;
  const dt = Math.min(0.05, (now - s.last) / 1000);
  s.last = now;
  if (!s.paused && $("modal").hidden) {
    let sim = dt * s.speed;
    while (sim > 1e-6) {
      const step = Math.min(sim, 1 / 60);
      s.b.update(step);
      sim -= step;
      // Auto-send: once the first wave is out, send each next wave as soon as the last one has finished arriving.
      if (s.auto && s.b.wave > 0 && s.b.canSend) s.b.sendWave();
    }
    s.time += dt * s.speed;
  }
  if (s.selected && !s.b.towers.includes(s.selected)) { s.selected = null; renderDock(); }
  const g = $("field").getContext("2d");
  drawBattle(g, s.b, {
    scale: s.scale, dpr: s.dpr, bg: s.bg, time: s.time, selected: s.selected, ghost: s.placing ? s.ghost : null,
    placing: s.placing, ghostStats: s.placing && towerStats(s.placing, 1, s.b.mods),
  });
  updateHud();
  if ((s.b.state === "won" || s.b.state === "lost") && !s.endAt) s.endAt = now + 900;
  if (s.endAt && now >= s.endAt) return finishBattle();
  requestAnimationFrame(frame);
}

function finishBattle() {
  const { b, kind, row } = st;
  st = null;
  if (b.state === "won") R.battleWon(run, kind, row, b.kills);
  else R.endRun(run, false);
  next();
}

function updateHud() {
  const b = st.b, h = st.hud;
  const set = (key, val, fn) => { if (h[key] !== val) { h[key] = val; fn(val); } };
  set("lives", run.lives, v => ($("hud-lives").textContent = `♥ ${v}`));
  set("gold", Math.floor(b.gold), v => { $("hud-gold").textContent = `💰 ${v}`; refreshDock(); });
  const tag = st.kind === "boss" ? " · Boss" : st.kind === "elite" ? " · Elite" : "";
  set("wave", `${b.wave}/${b.waveCount}${tag}`, v => ($("hud-wave").textContent = `🌊 ${v}`));
  // Short labels, so the wave counter keeps its room in the top bar on phones.
  const label = b.wave === 0 ? "Start" : b.wave >= b.waveCount ? "Final" : b.state === "fight" ? "Next ▸" : "Send ▸";
  set("send", `${label}|${b.canSend}|${b.state}`, () => {
    const btn = $("btn-send");
    btn.textContent = label;
    btn.disabled = !b.canSend;
    btn.classList.toggle("pulse", b.state === "build" && b.canSend);
  });
}

function statLine(t) {
  const s = t.stats;
  if (t.type === "bank") return `+${s.income} gold after each wave`;
  const parts = [`Dmg ${fmt(s.dmg)}`, `${(1 / s.interval).toFixed(1)}/s`, `Range ${s.range.toFixed(1)}`];
  if (s.splash) parts.push(`Blast ${s.splash.toFixed(1)}`);
  if (s.slow) parts.push(`Slow ${Math.round(s.slow * 100)}%`);
  if (s.chains) parts.push(`Jumps ${s.chains}`);
  if (s.poison) parts.push(`Poison ${fmt(s.poison)}/s`);
  if (s.burn) parts.push(`Burn ${fmt(s.burn)}/s`);
  return parts.join(" · ");
}

function renderDock() {
  const dock = $("dock");
  if (!st) return;
  const b = st.b, t = st.selected;
  if (t) {
    const def = TOWERS[t.type];
    const up = b.upgradeCostOf(t);
    const aims = t.type !== "bank" && !t.stats.aura;
    dock.innerHTML = `<div class="tpanel">
      <img src="${towerIcon(t.type)}" alt="">
      <div class="info"><b>${def.name} · Lv ${t.level}</b><small>${statLine(t)}</small></div>
      <button data-a="close" class="icon" aria-label="Close">✕</button>
      <div class="acts">
        ${aims ? `<button data-a="target">Aim: ${t.target}</button>` : ""}
        <button data-a="up" ${t.level >= MAX_LEVEL ? "disabled" : ""}>${t.level >= MAX_LEVEL ? "Max level" : `Upgrade 💰${up}`}</button>
        <button data-a="sell">Sell +${b.sellValue(t)}</button>
      </div></div>`;
    on(dock, "[data-a=target]", () => { t.target = TARGET_MODES[(TARGET_MODES.indexOf(t.target) + 1) % TARGET_MODES.length]; renderDock(); });
    on(dock, "[data-a=up]", () => { if (b.upgrade(t)) renderDock(); else toast("Not enough gold"); });
    on(dock, "[data-a=sell]", () => { b.sell(t); st.selected = null; renderDock(); });
    on(dock, "[data-a=close]", () => { st.selected = null; renderDock(); });
  } else {
    const touch = matchMedia("(hover: none)").matches;
    dock.innerHTML = `<div class="cards">${run.towers.map(type => `<button class="tcard" data-t="${type}">
        <img src="${towerIcon(type)}" alt=""><span>${TOWERS[type].name}</span><span class="cost">${b.costOf(type)}</span></button>`).join("")}</div>
      ${st.placing && touch ? `<div class="hint">Tap a tile to preview, tap it again to build</div>` : ""}`;
    on(dock, ".tcard", el => {
      st.placing = st.placing === el.dataset.t ? null : el.dataset.t;
      st.ghost = null;
      renderDock();
    });
  }
  refreshDock();
}

// Cheap in-place update when gold changes, so buttons aren't replaced under a finger mid-tap.
function refreshDock() {
  if (!st) return;
  const b = st.b, dock = $("dock");
  dock.querySelectorAll(".tcard").forEach(el => {
    const type = el.dataset.t;
    el.classList.toggle("sel", st.placing === type);
    el.classList.toggle("poor", b.gold < b.costOf(type));
  });
  const up = dock.querySelector("[data-a=up]");
  if (up && st.selected && st.selected.level < MAX_LEVEL) up.classList.toggle("poor", b.gold < b.upgradeCostOf(st.selected));
}

function tileAt(ev) {
  const r = $("field").getBoundingClientRect();
  return { x: Math.floor((ev.clientX - r.left) / st.scale), y: Math.floor((ev.clientY - r.top) / st.scale) };
}

$("field").addEventListener("pointerdown", ev => {
  if (!st) return;
  const { x, y } = tileAt(ev);
  const b = st.b, mouse = ev.pointerType === "mouse";
  const tower = b.towerAt(x, y);
  if (tower) {
    st.selected = st.selected === tower ? null : tower;
    st.placing = null;
    st.ghost = null;
    return renderDock();
  }
  if (st.placing) {
    if (!b.canBuild(x, y)) { st.ghost = mouse ? { x, y } : null; return; }
    const confirmed = mouse || (st.ghost && st.ghost.x === x && st.ghost.y === y);
    if (!confirmed) { st.ghost = { x, y }; return; }
    if (b.gold < b.costOf(st.placing)) { toast("Not enough gold"); return; }
    b.build(st.placing, x, y);
    if (!mouse) st.ghost = null;
    if (b.gold < b.costOf(st.placing)) { st.placing = null; st.ghost = null; }
    return renderDock();
  }
  if (st.selected) { st.selected = null; renderDock(); }
});
$("field").addEventListener("pointermove", ev => {
  if (st && ev.pointerType === "mouse" && st.placing) st.ghost = tileAt(ev);
});
$("field").addEventListener("pointerleave", ev => {
  if (st && ev.pointerType === "mouse") st.ghost = null;
});

$("btn-send").addEventListener("click", () => st?.b.sendWave());
// Auto-send stays on between battles and app launches until it's turned off.
let auto = (() => { try { return localStorage.getItem("bastion.autoSend") === "1"; } catch { return false; } })();
function toggleAuto() {
  auto = !auto;
  try { localStorage.setItem("bastion.autoSend", auto ? "1" : "0"); } catch { /* private mode */ }
  $("btn-auto").classList.toggle("on", auto);
  if (st) st.auto = auto;
  toast(auto ? "Auto-send on: each wave goes out early, as soon as the last one is in" : "Auto-send off", 2500);
}
$("btn-auto").addEventListener("click", toggleAuto);
$("btn-speed").addEventListener("click", () => {
  if (!st) return;
  st.speed = st.speed >= 3 ? 1 : st.speed + 1;
  $("btn-speed").textContent = `${st.speed}×`;
});
$("btn-pause").addEventListener("click", () => showPause());
$("map-menu").addEventListener("click", () => showPause());

function showPause() {
  modal(`<h2>Paused</h2>
    <p class="muted">Act ${run.act + 1} · ♥ ${run.lives}/${run.maxLives} · 🪙 ${run.coins}</p>
    <div class="row" style="flex-direction:column;align-items:stretch">
      <button class="primary" data-a="resume">Resume</button>
      <button data-a="help">How to play</button>
      <button data-a="title">Save and quit to title</button>
      <button data-a="abandon" style="color:var(--red)">Abandon run</button>
    </div>
    ${st ? `<p class="muted" style="font-size:13px">Quitting mid-battle restarts this battle when you continue (lives already lost stay lost).</p>` : ""}`, root => {
    on(root, "[data-a=resume]", closeModal);
    on(root, "[data-a=help]", () => showHelp(showPause));
    on(root, "[data-a=title]", () => { save(); showTitle(); });
    on(root, "[data-a=abandon]", () => {
      modal(`<h2>Abandon this run?</h2><p>It will count as a loss.</p>
        <div class="row"><button data-a="no">Cancel</button><button class="primary" data-a="yes">Abandon</button></div>`, r2 => {
        on(r2, "[data-a=no]", showPause);
        on(r2, "[data-a=yes]", () => { st = null; R.endRun(run, false); next(); });
      });
    });
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && st && $("modal").hidden) showPause();
});

// Keyboard shortcuts on desktop: 1-9 pick towers, space sends a wave, Esc cancels.
document.addEventListener("keydown", ev => {
  if (!st || !$("modal").hidden) return;
  if (ev.key === " ") { ev.preventDefault(); st.b.sendWave(); }
  else if (ev.key === "a") toggleAuto();
  else if (ev.key === "Escape") { st.placing = null; st.selected = null; st.ghost = null; renderDock(); }
  else if (/^[1-9]$/.test(ev.key) && run.towers[+ev.key - 1]) {
    const t = run.towers[+ev.key - 1];
    st.placing = st.placing === t ? null : t;
    st.selected = null;
    renderDock();
  }
});

if ("serviceWorker" in navigator && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  navigator.serviceWorker.register("sw.js");
}

// For poking at the game from the console (and the browser tests).
window.bastion = { get run() { return run; }, get battle() { return st; } };

showTitle();
