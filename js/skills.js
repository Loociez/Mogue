// skills.js
import { TILE_SIZE } from "./map.js";
import { Projectile } from "./projectile.js";

// === Custom projectile skills ===
export function createClusterProjectile(player, targetX, targetY) {
  const dx = targetX - (player.px + TILE_SIZE / 2);
  const dy = targetY - (player.py + TILE_SIZE / 2);
  const dist = Math.hypot(dx, dy);
  const speed = 4;
  const vx = (dx / dist) * speed;
  const vy = (dy / dist) * speed;

  const mainProj = new Projectile(
    player.px + TILE_SIZE / 2,
    player.py + TILE_SIZE / 2,
    vx,
    vy,
    player.damage || 1,
    60,
    player.projectilePierce || 1,
    "normal",
    200,
    player
  );

  const splitProjectile = (projArray) => {
    for (let i = 0; i < 5; i++) {
      projArray.push(new Projectile(
        mainProj.x,
        mainProj.y,
        Math.cos(Math.random() * Math.PI * 2) * 3,
        Math.sin(Math.random() * Math.PI * 2) * 3,
        Math.max(1, Math.floor((player.damage || 1) * 0.4)),
        40,
        1,
        "normal",
        120,
        player
      ));
    }
  };

  mainProj.onExpire = splitProjectile;
  mainProj.onHit = (target, projArray) => {
    splitProjectile(projArray);
    mainProj.onHit = null;
  };

  projectiles.push(mainProj);
}

// === Exploding Shot logic ===
export function applyExplodingShot(proj) {
  if (proj.owner?.explosiveShot && proj.onExpire) {
    proj.onHit = (target, projArray) => {
      proj.onExpire(projArray);
      proj.onExpire = null;
    };
  }
}

// === Ricochet logic ===
export function applyRicochet(proj) {
  if (proj.owner?.ricochet) {
    let bounces = proj.owner.ricochet;
    const originalOnHit = proj.onHit;
    proj.onHit = (target, projArray) => {
      if (bounces > 0) {
        bounces--;
        projArray.push(new Projectile(
          proj.x,
          proj.y,
          Math.cos(Math.random() * Math.PI * 2) * 3,
          Math.sin(Math.random() * Math.PI * 2) * 3,
          proj.damage,
          40,
          1,
          "normal",
          120,
          proj.owner
        ));
      }
      if (originalOnHit) originalOnHit(target, projArray);
    };
  }
}

// === Blink ability ===
export function blink(player, distance = 5) {
  // Simple dash in current facing direction
  player.px += Math.cos(player.rotation) * distance;
  player.py += Math.sin(player.rotation) * distance;
  if (player.blinkCooldown) player.blinkCooldownTimer = player.blinkCooldown;
}

// === Phase Strike (ignores armor) ===
export function phaseStrike(player, target) {
  if (!target) return;
  const armor = target.armor || 0;
  const ignore = player.phaseStrike || 0;
  const effectiveArmor = armor * (1 - ignore);
  const damage = Math.max(0, (player.damage || 1) - effectiveArmor);
  target.HP -= damage;
}

// === Attach skills to skillTree nodes ===
export function attachSkills(skillTree) {
  for (const category of Object.values(skillTree.nodes)) {
    for (const skill of category) {
      switch (skill.id) {
        case "attack_5": // Explosive Shots
          skill.apply = (player) => { player.explosiveShot = true; };
          break;
        case "attack_11": // Ricochet
          skill.apply = (player) => { player.ricochet = 1; };
          break;
        case "speed_10": // Blink
          skill.apply = (player) => { player.blinkDistance = 5; player.blinkCooldown = 10; };
          break;
        case "speed_12": // Phase Strike
          skill.apply = (player) => { player.phaseStrike = 0.25; };
          break;
        case "attack_6": // Leech Life
          skill.apply = (player) => { player.leechPercent = 0.05; };
          break;
        case "attack_10": // Siphoning Shot
          skill.apply = (player) => { player.bossLeech = 0.10; };
          break;
        case "defense_10": // Energy Shield
          skill.apply = (player) => { player.energyShield = 50; player.energyShieldCooldown = 30; };
          break;
        case "defense_11": // Reflective Armor
          skill.apply = (player) => { player.reflectiveArmor = 0.3; };
          break;
        case "defense_12": // Stoneform
          skill.apply = (player) => { player.stoneform = true; };
          break;
        case "core_ultimate":
          skill.apply = (player) => {
            player.elementalFury = true;
            player.unstoppableForce = { damage: 0.5, speed: 0.25 };
            player.eternalGuardian = 3;
          };
          break;
      }
    }
  }
}

// === Unlock and apply utility functions ===
export function unlockSkill(player, skillId, skillTree) {
  for (const category of Object.values(skillTree.nodes)) {
    const skill = category.find(s => s.id === skillId);
    if (skill && typeof skill.apply === "function") {
      skill.apply(player);
      skill.unlocked = true;
    }
  }
}

export function applyAllSkills(player, skillTree) {
  for (const category of Object.values(skillTree.nodes)) {
    for (const skill of category) {
      if (skill.unlocked && typeof skill.apply === "function") {
        skill.apply(player);
      }
    }
  }
}
