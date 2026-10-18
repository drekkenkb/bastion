// Turns the run's relics and perks into modifiers, and works out a tower's numbers at a given level.
import { TOWERS } from "./data.js";

export const MAX_LEVEL = 3;

// Seeded random numbers, so a run's maps and waves come out the same after a reload.
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: n => Math.floor(next() * n),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    get state() { return s; },
  };
}

export function computeMods(run) {
  const r = new Set(run.relics);
  const g = {
    dmg: r.has("whetstone") ? 1.15 : 1,
    rate: r.has("clockwork") ? 1.12 : 1,
    range: r.has("spyglass") ? 0.35 : 0,
    cost: r.has("guild") ? 0.85 : 1,
    upgrade: r.has("blueprint") ? 0.75 : 1,
    sell: r.has("receipt") ? 1 : 0.7,
    crit: r.has("lens") ? 0.1 : 0,
    startGold: 160 + (r.has("war_chest") ? 60 : 0),
    killGold: r.has("tax") ? 1 : 0,
    interest: r.has("piggy"),
    ward: r.has("ward") ? 3 : 0,
    enemySpeed: r.has("tar") ? 0.9 : 1,
    eliteDmg: r.has("slayer") ? 1.35 : 1,
    slowedDmg: r.has("frostbite") ? 1.25 : 1,
    early: r.has("bugle") ? 2 : 1,
    splash: r.has("powder") ? 1.25 : 1,
  };
  const t = {};
  for (const id of Object.keys(TOWERS)) t[id] = { dmg: 1, rate: 1, range: 0, cost: 1, special: new Set() };
  for (const p of run.perks) {
    const m = t[p.tower];
    if (p.id === "dmg") m.dmg *= 1.3;
    else if (p.id === "rate") m.rate *= 1.2;
    else if (p.id === "range") m.range += 0.5;
    else if (p.id === "cost") m.cost *= 0.8;
    else m.special.add(p.id);
  }
  return { g, t };
}

export function buildCost(type, mods) {
  return Math.round(TOWERS[type].cost * mods.g.cost * mods.t[type].cost);
}

// Cost to go from `level` to level + 1.
export function upgradeCost(type, level, mods) {
  return Math.round(TOWERS[type].cost * [0.8, 1.3][level - 1] * mods.g.upgrade);
}

export function towerStats(type, level, mods) {
  const b = TOWERS[type];
  const g = mods.g, m = mods.t[type], sp = m.special;
  const lv = level - 1;
  if (type === "bank") return { income: Math.round(b.income[lv] * (sp.has("compound") ? 1.5 : 1)) };
  const s = {
    dmg: b.dmg * (1 + 0.7 * lv) * g.dmg * m.dmg,
    interval: b.interval * Math.pow(0.88, lv) / (g.rate * m.rate),
    range: b.range + 0.25 * lv + g.range + m.range,
    minRange: b.minRange || 0,
    air: b.air,
    splash: (b.splash || 0) * (1 + 0.1 * lv) * g.splash * (sp.has("shrapnel") ? 1.4 : 1),
    chains: (b.chains || 0) + lv + (sp.has("overcharge") ? 2 : 0),
    slow: b.slow ? Math.min(0.75, b.slow + 0.08 * lv + (sp.has("deepfreeze") ? 0.15 : 0)) : 0,
    slowTime: (b.slowTime || 0) * (sp.has("deepfreeze") ? 1.5 : 1),
    burn: (b.burn || 0) * (1 + 0.7 * lv) * g.dmg * m.dmg * (sp.has("napalm") ? 2 : 1),
    burnTime: b.burnTime || 0,
    poison: (b.poison || 0) * (1 + 0.7 * lv) * g.dmg * m.dmg,
    poisonTime: b.poisonTime || 0,
    pierce: !!b.pierce,
    aura: !!b.aura,
    lob: !!b.lob,
    volley: sp.has("volley"),
    headshot: sp.has("headshot"),
    contagion: sp.has("contagion"),
    cluster: sp.has("cluster"),
  };
  return s;
}
