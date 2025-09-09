import {
  createClusterProjectile,
  applyExplodingShot,
  applyRicochet
} from "./skills.js";

export const skillTree = {
  root: [
    { 
      id: "core", 
      name: "Core Mastery", 
      desc: "+5 Damage", 
      requires: null,
      level: 0,
      maxLevel: 5,
      apply: (player, lvl) => { player.damage += 5 * lvl; } 
    }
  ],
  nodes: {
    // === Core branches ===
    "core": [
      { 
        id: "attack_1", 
        name: "Sharpened Blades", 
        desc: "+5 Damage", 
        requires: "core",
        branch: "left",
        level: 0,
        maxLevel: 5,
        apply: (player, lvl) => { player.damage += 5 * lvl; }
      },
      { 
        id: "defense_1", 
        name: "Toughness", 
        desc: "+20 Max HP", 
        requires: "core",
        branch: "middle",
        level: 0,
        maxLevel: 5,
        apply: (player, lvl) => { player.maxHP += 20 * lvl; player.HP += 20 * lvl; }
      },
      { 
        id: "speed_1", 
        name: "Quick Step", 
        desc: "+0.5 Move Speed", 
        requires: "core",
        branch: "right",
        level: 0,
        maxLevel: 5,
        apply: (player, lvl) => { player.moveSpeed += 0.5 * lvl; }
      }
    ],

    // === Attack Branch (Left) ===
    "attack_1": [
      { id: "attack_2", name: "Piercing Shots", desc: "+1 Pierce", requires: "attack_1", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.pierce += 1 * lvl; } }
    ],
    "attack_2": [
      { id: "attack_3", name: "Critical Strikes", desc: "+10% Crit Chance", requires: "attack_2", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.critChance += 0.10 * lvl; } }
    ],
    "attack_3": [
      { id: "attack_4", name: "Heavy Hitter", desc: "+15 Damage", requires: "attack_3", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.damage += 15 * lvl; } }
    ],
    "attack_4": [
      { id: "attack_5", name: "Explosive Shots", desc: "Exploding projectiles", requires: "attack_4", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { if(lvl>0) player.explosiveShot = true; } }
    ],
    "attack_5": [
      { id: "attack_6", name: "Leech Life", desc: "Heal 5% of damage dealt", requires: "attack_5", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { if(lvl>0) player.leechPercent = 0.05; } }
    ],
    "attack_6": [
      { id: "attack_7", name: "Armor Breaker", desc: "Enemies take +15% damage", requires: "attack_6", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.armorPierce += 0.15 * lvl; } }
    ],
    "attack_7": [
      { id: "attack_8", name: "Multishot", desc: "Fire +1 projectile", requires: "attack_7", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.multishot += 1 * lvl; } }
    ],
    "attack_8": [
      { id: "attack_9", name: "Berserker Rage", desc: "+25% Attack Speed below 50% HP", requires: "attack_8", branch: "left", level: 0, maxLevel: 5, apply: (player, lvl) => { player.berserkerRage = 0.25 * lvl; } }
    ],
    "attack_9": [
      { id: "uber_attack_1", name: "Cluster Projectile", desc: "Projectiles split on hit", requires: "attack_9", branch: "left", level: 0, maxLevel: 3, apply: (player, lvl) => { if(lvl>0) player.clusterProjectile = true; } },
      { id: "uber_attack_2", name: "Ricochet", desc: "Projectiles bounce to extra targets", requires: "attack_9", branch: "left", level: 0, maxLevel: 3, apply: (player, lvl) => { if(lvl>0) player.ricochet = lvl; } }
    ],

   // === Defense Branch (Middle) ===
"defense_1": [
  { id: "defense_2", name: "Fortified", desc: "+30 Max HP", requires: "defense_1", branch: "middle", level: 0, maxLevel: 5, apply: (player, lvl) => { player.maxHP += 30 * lvl; player.HP += 30 * lvl; } }
],
"defense_2": [
  { id: "defense_3", name: "Regeneration", desc: "+1 HP/sec", requires: "defense_2", branch: "middle", level: 0, maxLevel: 5, apply: (player, lvl) => { player.hpRegen += 1 * lvl; } }
],
"defense_3": [
  { id: "defense_4", name: "Energy Shield", desc: "Absorbs 50 damage per 30s", requires: "defense_3", branch: "middle", level: 0, maxLevel: 3, apply: (player, lvl) => { 
      if(lvl > 0) { 
          player.energyShield = 50; 
          player.energyShieldCooldown = 30; 
          player.unlockedSkills ??= [];
          if(!player.unlockedSkills.includes("energyShield")) player.unlockedSkills.push("energyShield");
      } 
  } }
],
"defense_4": [
  { id: "defense_5", name: "Stoneform", desc: "Temporary damage immunity", requires: "defense_4", branch: "middle", level: 0, maxLevel: 3, apply: (player, lvl) => { 
      if(lvl > 0) {
          player.stoneform = true; 
          player.unlockedSkills ??= [];
          if(!player.unlockedSkills.includes("stoneform")) player.unlockedSkills.push("stoneform");
      } 
  } }
],
"defense_5": [
  { 
    id: "defense_6", 
    name: "Magnet", 
    desc: "Pulls nearby pickups", 
    requires: "defense_5", 
    branch: "middle", 
    level: 0, 
    maxLevel: 1, 
    apply: (player, lvl) => { 
      if (lvl > 0) { 
          player.magnet = true; 
          player.magnetLevel = lvl;     // patch: ensure pixel pull strength
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("magnet")) 
              player.unlockedSkills.push("magnet");
      } 
    } 
  }
],

// === Speed Branch (Right) ===
"speed_1": [
  { id: "speed_2", name: "Evasion", desc: "+10% Dodge Chance", requires: "speed_1", branch: "right", level: 0, maxLevel: 5, apply: (player, lvl) => { player.dodge += 0.10 * lvl; } }
],
"speed_2": [
  { id: "speed_3", name: "Blink", desc: "Dash forward", requires: "speed_2", branch: "right", level: 0, maxLevel: 1, apply: (player, lvl) => { 
      if(lvl > 0) {
          player.blinkDistance = 5; 
          player.blinkCooldown = 10; 
          player.unlockedSkills ??= [];
          if(!player.unlockedSkills.includes("blink")) player.unlockedSkills.push("blink");
      } 
  } }
],
"speed_3": [
  { id: "speed_4", name: "Phase Strike", desc: "Attacks ignore 25% armor", requires: "speed_3", branch: "right", level: 0, maxLevel: 1, apply: (player, lvl) => { 
      if(lvl > 0) {
          player.phaseStrike = 0.25; 
          player.unlockedSkills ??= [];
          if(!player.unlockedSkills.includes("phaseStrike")) player.unlockedSkills.push("phaseStrike");
      } 
  } }
],
"speed_4": [
  { id: "speed_5", name: "Momentum", desc: "+20% Projectile Speed", requires: "speed_4", branch: "right", level: 0, maxLevel: 5, apply: (player, lvl) => { player.projectileSpeed *= 1 + 0.2 * lvl; } }
],
"speed_5": [
  { id: "speed_6", name: "Adrenaline", desc: "+25% Attack Speed at full HP", requires: "speed_5", branch: "right", level: 0, maxLevel: 5, apply: (player, lvl) => { player.adrenaline = 0.25 * lvl; } }
],
"speed_6": [
  { id: "speed_7", name: "Lightning Reflexes", desc: "Dodge resets fire cooldown", requires: "speed_6", branch: "right", level: 0, maxLevel: 3, apply: (player, lvl) => { if(lvl>0) player.lightningReflexes = true; } }
],
"speed_7": [
  { id: "speed_8", name: "Blitz", desc: "+1 Dash Charge", requires: "speed_7", branch: "right", level: 0, maxLevel: 3, apply: (player, lvl) => { player.dashCharges += lvl; } }
],
"speed_8": [
  { id: "uber_speed_1", name: "Uber Phantom", desc: "Double Move Speed & 50% Dodge", requires: "speed_8", branch: "right", level: 0, maxLevel: 3, apply: (player, lvl) => { if(lvl>0) { player.moveSpeed *= 2; player.dodge += 0.5; } } }
],
"speed_9": [
  { id: "uber_speed_2", name: "Uber Storm", desc: "Rapid Fire fires twice", requires: "speed_8", branch: "right", level: 0, maxLevel: 3, apply: (player, lvl) => { if(lvl>0) player.rapidFire = true; } }
]

  }
};

export function resetSkillTree(player) {
    if (!player) return console.warn("resetSkillTree called with undefined player!");

    // 1️⃣ Reset all skill nodes
    const resetNode = node => {
        node.level = 0;
        node.selected = false;
        node.unlocked = false;
    };
    skillTree.root.forEach(resetNode);
    Object.values(skillTree.nodes).forEach(branch => branch.forEach(resetNode));

    // 2️⃣ Reset player stats & points
    Object.assign(player, {
        damage: player.baseDamage ?? 0,
        maxHP: player.baseMaxHP ?? 100,
        HP: player.maxHP,
        moveSpeed: player.baseMoveSpeed ?? 1,
        pierce: 0,
        critChance: 0,
        explosiveShot: false,
        leechPercent: 0,
        armorPierce: 0,
        multishot: 0,
        berserkerRage: 0,
        rapidFire: false,
        energyShield: 0,
        energyShieldCooldown: 0,
        stoneform: false,
        magnet: false,
        magnetLevel: 0,       // patch: reset magnet level
        dodge: 0,
        blinkDistance: 0,
        blinkCooldown: 0,
        phaseStrike: 0,
        projectileSpeed: 1,
        adrenaline: 0,
        lightningReflexes: false,
        dashCharges: 0,
        unlockedSkills: [],
        skillPoints: 0
    });

    // 3️⃣ Clear the UI completely
    const grid = document.getElementById("skillGrid");
    if (grid) while (grid.firstChild) grid.removeChild(grid.firstChild);

    document.querySelectorAll(".skill-node").forEach(el => {
        el.classList.remove("selected", "unlocked");
    });

    const ptsLabel = document.getElementById("skillPointsLabel");
    if (ptsLabel) ptsLabel.textContent = "Points: 0";

    // 4️⃣ Clear any cached state that renderSkillTree may use
    window.skillTreeCache = {};  
    window.selectedSkillNodes = [];

    // 5️⃣ Force a stateless render
    if (typeof renderSkillTree === "function") renderSkillTree(player);
}
