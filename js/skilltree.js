// skilltree.js
//
// IMPORTANT: every `apply` function below writes to the SAME property names
// used by Player in player.js (maxHp / hp / speed, all lowercase). The old
// version of this file used maxHP / HP / moveSpeed (capitalized) which do
// not exist on Player, so those skills silently did nothing. That's fixed
// everywhere in this file.

export const skillTree = {
  root: [
    {
      id: "core",
      name: "Core Mastery",
      desc: "+5 Damage",
      requires: null,
      level: 0,
      maxLevel: 5,
      apply: (player) => { player.damage += 5; }
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
        apply: (player, lvl) => { player.damage += 5; }
      },
      {
        id: "defense_1",
        name: "Toughness",
        desc: "+20 Max HP",
        requires: "core",
        branch: "middle",
        level: 0,
        maxLevel: 5,
        apply: (player, lvl) => { player.maxHp += 20; player.hp += 20; }
      },
      {
        id: "speed_1",
        name: "Quick Step",
        desc: "+0.3 Move Speed",
        requires: "core",
        branch: "right",
        level: 0,
        maxLevel: 5,
        apply: (player, lvl) => { player.speed += 0.3; }
      }
    ],

    // === Attack Branch (Left) ===
    "attack_1": [
      { id: "attack_2", name: "Piercing Shots", desc: "+1 Pierce", requires: "attack_1", branch: "left", level: 0, maxLevel: 5,
        apply: (player) => { player.pierce += 1; } }
    ],
    "attack_2": [
      { id: "attack_3", name: "Critical Strikes", desc: "+10% Crit Chance", requires: "attack_2", branch: "left", level: 0, maxLevel: 5,
        apply: (player) => { player.critChance = Math.min(1, player.critChance + 0.10); } }
    ],
    "attack_3": [
      { id: "attack_4", name: "Heavy Hitter", desc: "+15 Damage", requires: "attack_3", branch: "left", level: 0, maxLevel: 5,
        apply: (player) => { player.damage += 15; } }
    ],
    "attack_4": [
      { id: "attack_5", name: "Explosive Shots", desc: "Projectiles explode, damaging nearby enemies", requires: "attack_4", branch: "left", level: 0, maxLevel: 5,
        apply: (player, lvl) => { player.explosiveShot = true; player.explosiveShotPower = 0.4 + 0.1 * lvl; } }
    ],
    "attack_5": [
      { id: "attack_6", name: "Leech Life", desc: "Heal 5% of damage dealt (per level)", requires: "attack_5", branch: "left", level: 0, maxLevel: 5,
        apply: (player, lvl) => { player.lifeLeech = 0.05 * lvl; } }
    ],
    "attack_6": [
      { id: "attack_7", name: "Armor Breaker", desc: "+15% Damage", requires: "attack_6", branch: "left", level: 0, maxLevel: 5,
        apply: (player) => { player.armorPierce += 0.15; } }
    ],
    "attack_7": [
      { id: "attack_8", name: "Multishot", desc: "Fire +1 projectile", requires: "attack_7", branch: "left", level: 0, maxLevel: 5,
        apply: (player) => { player.multishot += 1; } }
    ],
    "attack_8": [
      { id: "attack_9", name: "Berserker Rage", desc: "+25% Attack Speed below 50% HP (per level)", requires: "attack_8", branch: "left", level: 0, maxLevel: 5,
        apply: (player, lvl) => { player.berserkerRage = 0.25 * lvl; } }
    ],
    "attack_9": [
      { id: "uber_attack_1", name: "Cluster Projectile", desc: "Projectiles split into shards on hit/expiry", requires: "attack_9", branch: "left", level: 0, maxLevel: 3,
        apply: (player, lvl) => { player.clusterProjectile = lvl > 0; player.clusterShards = 3 + lvl; } },
      { id: "uber_attack_2", name: "Ricochet", desc: "Projectiles bounce to extra targets", requires: "attack_9", branch: "left", level: 0, maxLevel: 3,
        apply: (player, lvl) => { player.ricochet = lvl; } }
    ],

    // === Defense Branch (Middle) ===
    "defense_1": [
      { id: "defense_2", name: "Fortified", desc: "+30 Max HP", requires: "defense_1", branch: "middle", level: 0, maxLevel: 5,
        apply: (player) => { player.maxHp += 30; player.hp += 30; } }
    ],
    "defense_2": [
      { id: "defense_3", name: "Regeneration", desc: "+1 HP every second", requires: "defense_2", branch: "middle", level: 0, maxLevel: 5,
        apply: (player) => { player.hpRegen += 1; } }
    ],
    "defense_3": [
      { id: "defense_4", name: "Energy Shield", desc: "Absorbs 50 damage, recharges every 30s (per level)", requires: "defense_3", branch: "middle", level: 0, maxLevel: 3,
        apply: (player, lvl) => {
          player.energyShieldMax = 50 * lvl;
          player.energyShieldCooldownMax = 1800; // 30s @ 60fps
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("energyShield")) player.unlockedSkills.push("energyShield");
        } }
    ],
    "defense_4": [
      { id: "defense_5", name: "Stoneform", desc: "Auto-triggers brief invulnerability when HP is critical", requires: "defense_4", branch: "middle", level: 0, maxLevel: 3,
        apply: (player, lvl) => {
          player.stoneform = true;
          player.stoneformDuration = 60 + lvl * 30; // frames of invulnerability
          player.stoneformCooldownMax = Math.max(300, 1200 - lvl * 200);
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("stoneform")) player.unlockedSkills.push("stoneform");
        } }
    ],
    "defense_5": [
      {
        id: "defense_6",
        name: "Magnet",
        desc: "Greatly increases pickup range",
        requires: "defense_5",
        branch: "middle",
        level: 0,
        maxLevel: 1,
        apply: (player, lvl) => {
          if (lvl > 0) {
            player.magnet = true;
            player.pickupRange = (player.basePickupRange ?? 16) + 80;
            player.unlockedSkills ??= [];
            if (!player.unlockedSkills.includes("magnet")) player.unlockedSkills.push("magnet");
          }
        }
      }
    ],
    "defense_6": [
      {
        id: "defense_7",
        name: "Guardian Shield",
        desc: "Blocks the next hit; recharges over time (more charges per level)",
        requires: "defense_6",
        branch: "middle",
        level: 0,
        maxLevel: 3,
        apply: (player, lvl) => {
          player.guardianShieldMaxCharges = lvl;
          player.guardianShieldRechargeMax = 480; // 8s per charge
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("guardianShield")) player.unlockedSkills.push("guardianShield");
        }
      }
    ],
    "defense_7": [
      {
        id: "defense_8",
        name: "Chain Lightning",
        desc: "Hits arc to a nearby enemy",
        requires: "defense_7",
        branch: "middle",
        level: 0,
        maxLevel: 3,
        apply: (player, lvl) => {
          player.chainLightning = lvl;
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("chainLightning")) player.unlockedSkills.push("chainLightning");
        }
      }
    ],
    "defense_8": [
      {
        id: "defense_9",
        name: "Dash Shot",
        desc: "Blinking fires a burst of projectiles from your position",
        requires: "defense_8",
        branch: "middle",
        level: 0,
        maxLevel: 3,
        apply: (player, lvl) => {
          player.dashShot = lvl;
          player.unlockedSkills ??= [];
          if (!player.unlockedSkills.includes("dashShot")) player.unlockedSkills.push("dashShot");
        }
      }
    ],

    // === Speed Branch (Right) ===
    "speed_1": [
      { id: "speed_2", name: "Evasion", desc: "+10% Dodge Chance", requires: "speed_1", branch: "right", level: 0, maxLevel: 5,
        apply: (player) => { player.dodge = Math.min(0.75, player.dodge + 0.10); } }
    ],
    "speed_2": [
      { id: "speed_3", name: "Blink", desc: "Dash forward (Shift)", requires: "speed_2", branch: "right", level: 0, maxLevel: 1,
        apply: (player, lvl) => {
          if (lvl > 0) {
            player.blinkDistance = 180;
            player.blinkCooldown = 150;
            player.unlockedSkills ??= [];
            if (!player.unlockedSkills.includes("blink")) player.unlockedSkills.push("blink");
          }
        } }
    ],
    "speed_3": [
      { id: "speed_4", name: "Phase Strike", desc: "+25% Damage", requires: "speed_3", branch: "right", level: 0, maxLevel: 1,
        apply: (player, lvl) => {
          if (lvl > 0) {
            player.phaseStrike = 0.25;
            player.unlockedSkills ??= [];
            if (!player.unlockedSkills.includes("phaseStrike")) player.unlockedSkills.push("phaseStrike");
          }
        } }
    ],
    "speed_4": [
      { id: "speed_5", name: "Momentum", desc: "+20% Projectile Speed", requires: "speed_4", branch: "right", level: 0, maxLevel: 5,
        apply: (player) => { player.projectileSpeed = (player.projectileSpeed ?? 1) * 1.2; } }
    ],
    "speed_5": [
      { id: "speed_6", name: "Adrenaline", desc: "+25% Attack Speed at full HP (per level)", requires: "speed_5", branch: "right", level: 0, maxLevel: 5,
        apply: (player, lvl) => { player.adrenaline = 0.25 * lvl; } }
    ],
    "speed_6": [
      { id: "speed_7", name: "Lightning Reflexes", desc: "Dodging resets your attack cooldown", requires: "speed_6", branch: "right", level: 0, maxLevel: 3,
        apply: (player, lvl) => { player.lightningReflexes = lvl > 0; } }
    ],
    "speed_7": [
      { id: "speed_8", name: "Blitz", desc: "+1 Blink Charge", requires: "speed_7", branch: "right", level: 0, maxLevel: 3,
        apply: (player) => { player.blinkChargesMax = (player.blinkChargesMax || 1) + 1; } }
    ],
    "speed_8": [
      { id: "uber_speed_1", name: "Uber Phantom", desc: "Double Move Speed & +50% Dodge", requires: "speed_8", branch: "right", level: 0, maxLevel: 1,
        apply: (player, lvl) => { if (lvl > 0) { player.speed = player.speed * 2; player.dodge = Math.min(0.9, player.dodge + 0.5); } } },
      { id: "uber_speed_2", name: "Uber Storm", desc: "Fire an extra volley with every shot", requires: "speed_8", branch: "right", level: 0, maxLevel: 1,
        apply: (player, lvl) => { player.rapidFire = lvl > 0; } }
    ]
  }
};

export function resetSkillTree(player) {
  if (!player) return console.warn("resetSkillTree called with undefined player!");

  // 1) Reset all skill nodes back to level 0
  const resetNode = node => {
    node.level = 0;
    node.selected = false;
    node.unlocked = false;
  };
  skillTree.root.forEach(resetNode);
  Object.values(skillTree.nodes).forEach(branch => branch.forEach(resetNode));

  // 2) Reset the run-specific skill state on the player.
  // NOTE: base stats (damage/maxHp/hp/speed/pierce/etc) are intentionally
  // NOT touched here - Player.setCharacter() (called right after this by
  // Player.reset()) is responsible for those.
  Object.assign(player, {
    explosiveShot: false,
    explosiveShotPower: 0,
    lifeLeech: 0,
    armorPierce: 0,
    multishot: 0,
    berserkerRage: 0,
    adrenaline: 0,
    rapidFire: false,
    energyShield: 0,
    energyShieldMax: 0,
    energyShieldCooldown: 0,
    energyShieldCooldownMax: 1800,
    stoneform: false,
    stoneformDuration: 0,
    stoneformCooldownMax: 1200,
    stoneformCooldown: 0,
    stoneformActive: false,
    stoneformTimer: 0,
    magnet: false,
    guardianShieldMaxCharges: 0,
    guardianShieldCharges: 0,
    guardianShieldRechargeMax: 480,
    guardianShieldRecharge: 0,
    chainLightning: 0,
    dashShot: 0,
    dodge: 0,
    blinkDistance: 0,
    blinkCooldown: 0,
    blinkCooldownTimer: 0,
    blinkChargesMax: 1,
    blinkCharges: 1,
    phaseStrike: 0,
    hpRegen: 0,
    hpRegenTimer: 0,
    lightningReflexes: false,
    clusterProjectile: false,
    clusterShards: 5,
    ricochet: 0,
    unlockedSkills: [],
    skillPoints: 0
  });

  // 3) Clear the skill tree UI if it exists
  const grid = document.getElementById("skillGrid");
  if (grid) while (grid.firstChild) grid.removeChild(grid.firstChild);

  document.querySelectorAll(".skill-node").forEach(el => {
    el.classList.remove("selected", "unlocked");
  });

  const ptsLabel = document.getElementById("skillPointsLabel");
  if (ptsLabel) ptsLabel.textContent = "Points: 0";
}