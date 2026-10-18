// Game content: towers, enemies, relics, perks and events. Everything else reads these tables, so balance changes
// happen here. Distances are in tiles, times in seconds.

export const TOWERS = {
  arrow: {
    name: "Archer", color: "#c9a36a", cost: 50, range: 2.6, dmg: 7, interval: 0.55, air: true,
    desc: "Fast single shots. Hits flyers.",
  },
  cannon: {
    name: "Cannon", color: "#7d8590", cost: 90, range: 2.4, dmg: 20, interval: 1.5, splash: 0.9, air: false,
    desc: "Explosive shells hit a group. Can't hit flyers.",
  },
  frost: {
    name: "Frost", color: "#7fd3f5", cost: 70, range: 2.2, dmg: 3, interval: 1.0, splash: 0.8, air: true,
    slow: 0.4, slowTime: 1.6, desc: "Slows everything it splashes.",
  },
  tesla: {
    name: "Tesla", color: "#b48cff", cost: 110, range: 2.3, dmg: 13, interval: 1.1, chains: 3, air: true,
    desc: "Lightning jumps between enemies.",
  },
  sniper: {
    name: "Sniper", color: "#e06c75", cost: 120, range: 5.5, dmg: 55, interval: 2.4, air: true, target: "strong",
    desc: "Huge range, huge hits, slow reload. Aims for the toughest enemy.",
  },
  flame: {
    name: "Flame", color: "#ff8c3a", cost: 100, range: 1.6, dmg: 4, interval: 0.3, aura: true, burn: 5, burnTime: 2,
    air: false, desc: "Scorches everything close by and sets it alight. Can't hit flyers.",
  },
  poison: {
    name: "Venom", color: "#8fd14f", cost: 80, range: 2.5, dmg: 2, interval: 1.0, poison: 7, poisonTime: 4,
    air: true, pierce: true, desc: "Poison ignores armor and keeps working.",
  },
  mortar: {
    name: "Mortar", color: "#a0785a", cost: 140, range: 6, minRange: 1.5, dmg: 34, interval: 3.0, splash: 1.3,
    air: false, lob: true, desc: "Long-range shells with a wide blast. Can't hit flyers or anything close.",
  },
  bank: {
    name: "Treasury", color: "#f2c94c", cost: 100, income: [20, 35, 55], desc: "Earns gold after every wave.",
  },
};

export const STARTING_TOWERS = ["arrow", "cannon"];

// cost is in "grunt units" for wave budgets; minD is the run depth where the enemy starts appearing.
export const ENEMIES = {
  grunt:    { name: "Grunt", hp: 32, speed: 1.0, gold: 4, cost: 1, minD: 0, color: "#d0b07a", size: 0.28 },
  runner:   { name: "Runner", hp: 18, speed: 1.9, gold: 3, cost: 0.8, minD: 1, color: "#e5d36a", size: 0.22, gap: 0.5 },
  swarm:    { name: "Swarmling", hp: 9, speed: 1.4, gold: 1, cost: 0.35, minD: 2, color: "#c97ad6", size: 0.16, gap: 0.25 },
  flyer:    { name: "Bat", hp: 26, speed: 1.25, gold: 5, cost: 1.2, minD: 3, color: "#8ab4ff", size: 0.24, flying: true },
  tank:     { name: "Brute", hp: 130, speed: 0.6, armor: 4, gold: 10, cost: 3, minD: 4, color: "#9aa0a6", size: 0.36, gap: 1.6, leak: 2 },
  splitter: { name: "Slime", hp: 55, speed: 0.9, gold: 6, cost: 2, minD: 5, color: "#6fd18b", size: 0.32, gap: 1.2, split: 3 },
  healer:   { name: "Shaman", hp: 45, speed: 0.9, gold: 8, cost: 2, minD: 7, color: "#f5f5f5", size: 0.27, gap: 1.4, heals: 6 },
  slimelet: { name: "Slimelet", hp: 14, speed: 1.2, gold: 1, cost: 0, minD: 99, color: "#9be5ae", size: 0.17 },
};

export const BOSSES = [
  { id: "juggernaut", name: "Juggernaut", hp: 1400, speed: 0.38, armor: 6, gold: 120, color: "#b0b6bd", size: 0.5 },
  { id: "broodmother", name: "Broodmother", hp: 1900, speed: 0.33, armor: 2, gold: 150, color: "#c97ad6", size: 0.5, spawns: "swarm", spawnEvery: 1.6 },
  { id: "lich", name: "Lich King", hp: 2600, speed: 0.36, armor: 4, gold: 200, color: "#a8f0e0", size: 0.5, heals: 25, spawns: "grunt", spawnEvery: 3 },
];

export const RELICS = {
  war_chest:   { name: "War Chest", icon: "💰", desc: "Start every battle with +60 gold." },
  whetstone:   { name: "Whetstone", icon: "🗡️", desc: "All towers deal +15% damage." },
  clockwork:   { name: "Clockwork", icon: "⚙️", desc: "All towers fire 12% faster." },
  spyglass:    { name: "Spyglass", icon: "🔭", desc: "All towers get +0.35 range." },
  tax:         { name: "Tax Ledger", icon: "📜", desc: "+1 gold for every kill." },
  piggy:       { name: "Piggy Bank", icon: "🐷", desc: "After each wave, earn 10% interest on unspent gold (up to 40)." },
  bandage:     { name: "Bandages", icon: "🩹", desc: "Heal 2 lives after every battle." },
  ward:        { name: "Warding Stone", icon: "🛡️", desc: "The first 3 enemies to get through each battle cost no lives." },
  tar:         { name: "Tar Pots", icon: "🛢️", desc: "All enemies move 10% slower." },
  guild:       { name: "Builders' Guild", icon: "🧱", desc: "Towers cost 15% less to build." },
  receipt:     { name: "Receipt", icon: "🧾", desc: "Selling a tower refunds everything you spent on it." },
  blueprint:   { name: "Blueprints", icon: "📐", desc: "Tower upgrades cost 25% less." },
  lens:        { name: "Lucky Lens", icon: "🔍", desc: "Towers have a 10% chance to deal double damage." },
  coin:        { name: "Lucky Coin", icon: "🪙", desc: "Earn 50% more coins from battles." },
  slayer:      { name: "Giant Slayer", icon: "🪓", desc: "+35% damage to elites and bosses." },
  frostbite:   { name: "Frostbite", icon: "🥶", desc: "Slowed enemies take 25% more damage." },
  idol:        { name: "Golden Idol", icon: "🗿", desc: "+6 max lives (and heal 6 when picked up)." },
  haggler:     { name: "Haggler", icon: "🤝", desc: "Shop prices are 25% lower." },
  bugle:       { name: "Bugle", icon: "📯", desc: "Calling a wave early pays double." },
  powder:      { name: "Black Powder", icon: "💥", desc: "Splash radius +25%." },
};

// Generic perks can be taken any number of times; special perks belong to one tower and are taken once.
export const PERKS = {
  dmg:   { name: "Sharpened", desc: "+30% damage", generic: true },
  rate:  { name: "Oiled", desc: "Fires 20% faster", generic: true },
  range: { name: "Raised", desc: "+0.5 range", generic: true },
  cost:  { name: "Simplified", desc: "Builds 20% cheaper", generic: true },
  volley:     { tower: "arrow", name: "Volley", desc: "Shoots a second arrow at another enemy" },
  shrapnel:   { tower: "cannon", name: "Shrapnel", desc: "+40% blast radius" },
  deepfreeze: { tower: "frost", name: "Deep Freeze", desc: "Slows harder (+15%) and for longer" },
  overcharge: { tower: "tesla", name: "Overcharge", desc: "Lightning hits 2 more enemies" },
  headshot:   { tower: "sniper", name: "Headshot", desc: "25% chance to hit for triple damage" },
  napalm:     { tower: "flame", name: "Napalm", desc: "Burns twice as hot" },
  contagion:  { tower: "poison", name: "Contagion", desc: "Poisoned enemies infect others when they die" },
  cluster:    { tower: "mortar", name: "Cluster Shells", desc: "Each shell scatters 3 extra blasts" },
  compound:   { tower: "bank", name: "Compound Interest", desc: "+50% income" },
};

// Events: each option has a label and an effect id that run.js knows how to apply.
export const EVENTS = [
  {
    title: "The Wandering Smith",
    text: "A smith with a cart of strange trinkets offers you one, if you lend some of your soldiers to haul it.",
    options: [{ label: "Take a relic (lose 4 lives)", fx: "relicForLives" }, { label: "Move on", fx: "none" }],
  },
  {
    title: "Abandoned Cache",
    text: "Behind a collapsed wall you find an old paymaster's strongbox.",
    options: [{ label: "Take the coins (+45 coins)", fx: "coins45" }],
  },
  {
    title: "Forgotten Shrine",
    text: "Candles still burn at a shrine nobody remembers building.",
    options: [{ label: "Pray (heal to full)", fx: "healFull" }, { label: "Study the carvings (a tower perk)", fx: "perk" }],
  },
  {
    title: "The Gambler",
    text: "\"Thirty coins, one coin toss. Heads, you get something special.\"",
    options: [{ label: "Play (30 coins, 50% chance of a relic)", fx: "gamble" }, { label: "Decline", fx: "none" }],
  },
  {
    title: "Deserters",
    text: "A band of deserters asks to join. They're good engineers but they eat a lot.",
    options: [{ label: "Accept them (new tower, lose 25 coins)", fx: "towerForCoins" }, { label: "Send them away", fx: "none" }],
  },
  {
    title: "Field Hospital",
    text: "A field hospital has spare beds and a surgeon with nothing to do.",
    options: [{ label: "Rest here (heal 8 lives)", fx: "heal8" }, { label: "Raid the supplies (+60 coins, lose 3 lives)", fx: "raid" }],
  },
];
