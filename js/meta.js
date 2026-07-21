// meta.js
//
// Persistent, cross-run progression stored in localStorage. Earns "Essence"
// at the end of each run (based on level reached / map tier / gold), which
// can be spent on small permanent bonuses from the character-select screen.
//
// Balance intent: every upgrade path is capped so the maximum possible
// investment is a meaningful-but-modest edge (roughly the same ballpark as
// one or two in-run skill tree nodes), not a substitute for playing well.
// This is meant to smooth the difficulty curve as more/harder map tiers are
// added, not trivialize them.

const STORAGE_KEY = "roguelite_meta_v1";

const DEFAULT_META = {
  essence: 0,
  totalRuns: 0,
  bestLevel: 0,
  bestMapTier: 1,
  upgrades: {
    vitality: 0,
    might: 0,
    swiftness: 0,
    fortune: 0,
    wisdom: 0,
    reach: 0,
    focus: 0,
    grit: 0
  }
};

// stat: which bonus bucket this upgrade feeds (see computeMetaBonuses)
export const UPGRADE_DEFS = {
  vitality:  { name: "Vitality",  desc: "+2% Max HP per level",        max: 10, baseCost: 15, perLevel: 0.02, stat: "hpMult" },
  might:     { name: "Might",     desc: "+2% Damage per level",        max: 10, baseCost: 18, perLevel: 0.02, stat: "dmgMult" },
  swiftness: { name: "Swiftness", desc: "+1% Move Speed per level",    max: 8,  baseCost: 20, perLevel: 0.01, stat: "speedMult" },
  fortune:   { name: "Fortune",   desc: "+3% Gold Gain per level",     max: 10, baseCost: 12, perLevel: 0.03, stat: "goldMult" },
  wisdom:    { name: "Wisdom",    desc: "+3% XP Gain per level",       max: 10, baseCost: 12, perLevel: 0.03, stat: "xpMult" },
  reach:     { name: "Reach",     desc: "+5 Pickup Range per level",   max: 6,  baseCost: 10, perLevel: 5,    stat: "pickupFlat" },
  focus:     { name: "Focus",     desc: "+1% Crit Chance per level",   max: 5,  baseCost: 25, perLevel: 0.01, stat: "critFlat" },
  grit:      { name: "Grit",      desc: "+20 Starting Gold per level", max: 10, baseCost: 8,  perLevel: 20,   stat: "startGoldFlat" }
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_META));
}

let meta = loadMeta();

function loadMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefault(),
      ...parsed,
      upgrades: { ...cloneDefault().upgrades, ...(parsed.upgrades || {}) }
    };
  } catch (e) {
    console.warn("Meta progression: localStorage unavailable, using in-memory only this session.", e);
    return cloneDefault();
  }
}

function saveMeta() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn("Meta progression: failed to save.", e);
  }
}

export function getMeta() {
  return meta;
}

export function getUpgradeCost(key) {
  const def = UPGRADE_DEFS[key];
  if (!def) return null;
  const level = meta.upgrades[key] || 0;
  if (level >= def.max) return null;
  return Math.round(def.baseCost * Math.pow(1.25, level));
}

export function purchaseUpgrade(key) {
  const def = UPGRADE_DEFS[key];
  if (!def) return false;
  const cost = getUpgradeCost(key);
  if (cost === null || meta.essence < cost) return false;
  meta.essence -= cost;
  meta.upgrades[key] = (meta.upgrades[key] || 0) + 1;
  saveMeta();
  return true;
}

// Aggregates every purchased upgrade into a flat bonus object Player can
// apply once at the start of a run.
export function computeMetaBonuses() {
  const bonuses = {
    hpMult: 1, dmgMult: 1, speedMult: 1, goldMult: 1, xpMult: 1,
    pickupFlat: 0, critFlat: 0, startGoldFlat: 0
  };
  for (const key in UPGRADE_DEFS) {
    const def = UPGRADE_DEFS[key];
    const level = meta.upgrades[key] || 0;
    if (level <= 0) continue;
    const amount = def.perLevel * level;
    if (def.stat === "hpMult" || def.stat === "dmgMult" || def.stat === "speedMult" || def.stat === "goldMult" || def.stat === "xpMult") {
      bonuses[def.stat] += amount;
    } else {
      bonuses[def.stat] += amount;
    }
  }
  return bonuses;
}

// Call once when a run ends. Returns the amount of essence earned.
export function awardRunEssence({ level = 1, mapTier = 1, gold = 0 }) {
  const earned = Math.max(1, Math.round(level * 1.5 + mapTier * 15 + Math.min(gold, 20000) / 200));
  meta.essence += earned;
  meta.totalRuns += 1;
  meta.bestLevel = Math.max(meta.bestLevel, level);
  meta.bestMapTier = Math.max(meta.bestMapTier, mapTier);
  saveMeta();
  return earned;
}

export function resetMeta() {
  meta = cloneDefault();
  saveMeta();
}