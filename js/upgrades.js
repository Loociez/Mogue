// upgrades.js
// Defines possible upgrades and provides functions for rolling and applying them
export const rollUberUpgrades = rollUpgrades;

const ALL_UPGRADES = [
  {
    key: "damage",
    name: "+Damage",
    desc: "+5 damage",
    apply: (p) => (p.damage += 5),
  },
  {
    key: "firerate",
    name: "+Fire Rate",
    desc: "Shoot faster",
    apply: (p) => (p.fireCooldownMax = Math.max(6, Math.round(p.fireCooldownMax * 0.85))),
  },
  {
    key: "projectileSpeed",
    name: "+Projectile Speed",
    desc: "+2 px/frame",
    apply: (p) => (p.projectileSpeed += 2),
  },
  {
    key: "pierce",
    name: "+Pierce",
    desc: "+1 pierce",
    apply: (p) => (p.pierce += 1),
  },
  {
    key: "hp",
    name: "+Max HP",
    desc: "+20 max HP and heal",
    apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); },
  },
  {
    key: "speed",
    name: "+Speed",
    desc: "+0.5 movement speed",
    apply: (p) => (p.speed += 0.5),
  },
  {
    key: "pickup",
    name: "+Pickup Range",
    desc: "+20 pickup radius",
    apply: (p) => (p.pickupRange += 20),
  },

  // ==== Projectile Variants ====
  {
    key: "spreadShot",
    name: "Spread Shot",
    desc: "Fire 3 bullets in a fan",
    apply: (p) => (p.projectileType = "spread"),
  },
  {
    key: "bouncingShot",
    name: "Bouncing Shot",
    desc: "Projectiles bounce off walls",
    apply: (p) => (p.projectileType = "bouncing"),
  },
  {
    key: "homingShot",
    name: "Homing Shot",
    desc: "Projectiles home in on enemies",
    apply: (p) => (p.projectileType = "homing"),
  },
  {
    key: "heavyShot",
    name: "Heavy Shot",
    desc: "Slower, bigger, stronger projectiles",
    apply: (p) => (p.projectileType = "heavy"),
  },
  {
    key: "normalShot",
    name: "Normal Shot",
    desc: "Single default projectile",
    apply: (p) => (p.projectileType = "normal"),
  },
];

// ===== Uber Upgrades =====
const UBER_UPGRADES = [
  {
    key: "megaDamage",
    name: "Mega Damage",
    desc: "+20 damage",
    apply: (p) => (p.damage += 20),
  },
  {
    key: "hyperFirerate",
    name: "Hyper Fire Rate",
    desc: "Shoots extremely fast",
    apply: (p) => (p.fireCooldownMax = Math.max(3, Math.round(p.fireCooldownMax * 0.6))),
  },
  {
    key: "lightningSpeed",
    name: "Lightning Speed",
    desc: "+2 movement speed",
    apply: (p) => (p.speed += 2),
  },
  {
    key: "pierceMaster",
    name: "Pierce Master",
    desc: "+3 pierce",
    apply: (p) => (p.pierce += 3),
  },
  {
    key: "titanHP",
    name: "Titan HP",
    desc: "+50 max HP and full heal",
    apply: (p) => { p.maxHp += 50; p.hp = p.maxHp; },
  },
  {
    key: "orbMagnet",
    name: "Orb Magnet",
    desc: "+50 pickup radius",
    apply: (p) => (p.pickupRange += 50),
  }
];

// Pick 3 random upgrades, with optional chance to include Uber upgrades
export function rollUpgrades(player) {
  const pool = [...ALL_UPGRADES];

  // 20% chance to include one Uber upgrade
  if (Math.random() < 0.2) {
    const uber = UBER_UPGRADES[Math.floor(Math.random() * UBER_UPGRADES.length)];
    pool.push(uber);
  }

  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export function applyUpgrade(player, upgrade) {
  upgrade.apply(player);
}
