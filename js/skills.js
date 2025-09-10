// skills.js
import { TILE_SIZE } from "./map.js";
import { Projectile } from "./projectile.js";
import { skillTree } from "./skilltree.js";

// === Guardian Shield visuals ===
export function drawGuardianShield(ctx, player) {
  if (!player.guardianShieldActive) return;

  const radius = 25;
  const shieldX = player.px + TILE_SIZE/2 + Math.cos(player.shieldAngle) * radius;
  const shieldY = player.py + TILE_SIZE/2 + Math.sin(player.shieldAngle) * radius;

  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 15, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(135,206,250,0.6)";
  ctx.fill();
  ctx.strokeStyle = "rgba(30,144,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// === Dash Shot helper ===
export function spawnDashShot(player, projectiles) {
  if (!player.dashShotActive || !player.isDashing || player.dashFired) return;

  projectiles.push(new Projectile(
    player.px + TILE_SIZE/2,
    player.py + TILE_SIZE/2,
    Math.cos(player.facingAngle) * 5,
    Math.sin(player.facingAngle) * 5,
    (player.damage || 1) * 2,
    50,
    1,
    "dashshot",
    150,
    player
  ));
  player.dashFired = true;
}

// === Chain Lightning logic ===
export function applyChainLightning(proj, enemies, projectiles) {
  if (!proj.owner?.chainLightning) return;

  let jumps = proj.owner.chainLightning;
  let currentTarget = proj.target;

  while (jumps > 0 && currentTarget) {
    const next = enemies.find(e =>
      e !== currentTarget &&
      Math.hypot(e.px - currentTarget.px, e.py - currentTarget.py) < 120
    );
    if (!next) break;

    next.HP -= proj.damage * 0.5;

    // Visual lightning projectile
    projectiles.push(new Projectile(
      currentTarget.px, currentTarget.py,
      (next.px - currentTarget.px) / 20,
      (next.py - currentTarget.py) / 20,
      0,
      10,
      0,
      "lightning",
      10,
      proj.owner
    ));

    currentTarget = next;
    jumps--;
  }
}

// === Custom projectile skills ===
export function createClusterProjectile(player, targetX, targetY, projectiles) {
  const dx = targetX - (player.px + TILE_SIZE / 2);
  const dy = targetY - (player.py + TILE_SIZE / 2);
  const dist = Math.hypot(dx, dy);
  const speed = 1;
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

// === Phase Strike (ignores armor) ===
export function phaseStrike(player, target) {
  if (!target) return;
  const armor = target.armor || 0;
  const ignore = player.phaseStrike || 0;
  const effectiveArmor = armor * (1 - ignore);
  const damage = Math.max(0, (player.damage || 1) - effectiveArmor);
  target.HP -= damage;
}

// === Magnet skill logic ===
export function applyMagnet(player, level, orbs = []) {
  if (!player.magnet || !Array.isArray(orbs)) return;

  const range = 1.5 * TILE_SIZE + level * TILE_SIZE; 
  const speed = 1 + level; 

  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    const dx = player.px + TILE_SIZE/2 - orb.x;
    const dy = player.py + TILE_SIZE/2 - orb.y;
    const dist = Math.hypot(dx, dy);

    if (dist < range) {
      orb.x += (dx / dist) * speed;
      orb.y += (dy / dist) * speed;

      if (dist < 10) {
        player.gainXp(orb.value);
        player.gold += orb.value;
        orbs.splice(i, 1);
      }
    }
  }
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
        case "attack_15": // Chain Lightning
          skill.apply = (player, lvl) => { if(lvl>0) player.chainLightning = lvl; };
          break;
        case "speed_10": // Blink
          skill.apply = (player) => { 
            player.blinkDistance = 150;
            player.blinkCooldown = 180;
            player.unlockedSkills ??= [];
            if (!player.unlockedSkills.includes("blink")) player.unlockedSkills.push("blink");
          };
          break;
        case "speed_13": // Multistrike Dash
          skill.apply = (player) => { player.dashBarrage = true; };
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
        case "defense_6": // Magnet
          skill.apply = (player, level) => {
            player.magnet = true;
            player.magnetLevel = level || 1;
            player.unlockedSkills ??= [];
            if (!player.unlockedSkills.includes("magnet")) player.unlockedSkills.push("magnet");
          };
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
        case "defense_13": // Guardian Shield
          skill.apply = (player) => {
            player.guardianShieldActive = true;
            player.shieldAngle = 0;
          };
          break;
        case "defense_14": // Dash Shot
          skill.apply = (player) => { player.dashShotActive = true; player.dashFired = false; };
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
      skill.apply(player, skill.level || 1);
      skill.unlocked = true;
    }
  }
}

// === Apply all skills each frame ===
export function applyAllSkills(player, projectiles = [], enemies = [], xpOrbs = []) {
  if (!skillTree || !skillTree.nodes) return;

  Object.values(skillTree.nodes).forEach(branch => {
    branch.forEach(node => {
      if (node.level > 0 && typeof node.apply === "function") {
        node.apply(player, node.level);
      }
    });
  });

  if (player.magnet && player.magnetLevel > 0) {
    applyMagnet(player, player.magnetLevel, xpOrbs);
  }

  if (player.guardianShieldActive) {
    player.shieldAngle += 0.05;
  }

  if (player.dashShotActive) {
    spawnDashShot(player, projectiles);
  }

  // Apply chain lightning for all projectiles
  projectiles.forEach(proj => {
    if (proj.owner?.chainLightning && proj.hasHit) {
      applyChainLightning(proj, enemies, projectiles);
      proj.hasHit = false; // prevent double application
    }
  });
}
