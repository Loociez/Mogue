// skills.js
import { TILE_SIZE } from "./map.js";
import { Projectile } from "./projectile.js";

// === Guardian Shield visuals (drawn around the player while a charge is up) ===
export function drawGuardianShield(ctx, player) {
  if (!player.guardianShieldMaxCharges || player.guardianShieldCharges <= 0) return;

  player.shieldAngle = (player.shieldAngle || 0) + 0.05;
  const radius = 25;
  const shieldX = player.px + TILE_SIZE / 2 + Math.cos(player.shieldAngle) * radius;
  const shieldY = player.py + TILE_SIZE / 2 + Math.sin(player.shieldAngle) * radius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(shieldX, shieldY, 15, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(135,206,250,0.6)";
  ctx.fill();
  ctx.strokeStyle = "rgba(30,144,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// === Chain Lightning: bounces the hit to a nearby enemy ===
// Requires proj.target to be set (Projectile.dealDamage sets this before calling us).
export function applyChainLightning(proj, enemies, projectiles) {
  if (!proj.owner?.chainLightning) return;

  let jumps = proj.owner.chainLightning;
  let currentTarget = proj.target;
  const alreadyHit = new Set([currentTarget]);

  while (jumps > 0 && currentTarget) {
    const next = enemies.find(e =>
      !alreadyHit.has(e) &&
      Math.hypot(e.px - currentTarget.px, e.py - currentTarget.py) < 120
    );
    if (!next) break;

    const dmg = Math.max(1, Math.floor(proj.damage * 0.5));
    if (typeof next.takeDamage === "function") next.takeDamage(dmg);
    else next.hp -= dmg;

    // Visual lightning bolt (does no additional damage, purely cosmetic)
    projectiles.push(new Projectile(
      currentTarget.px + TILE_SIZE / 2, currentTarget.py + TILE_SIZE / 2,
      (next.px - currentTarget.px) / 20,
      (next.py - currentTarget.py) / 20,
      0, 10, 0, "lightning", 10, proj.owner
    ));

    alreadyHit.add(next);
    currentTarget = next;
    jumps--;
  }
}

// === Explosive Shot: AoE damage around the projectile's death point ===
export function explodeAt(x, y, radius, damage, enemies, damageTexts, owner) {
  for (const enemy of enemies) {
    const dist = Math.hypot(enemy.px + TILE_SIZE / 2 - x, enemy.py + TILE_SIZE / 2 - y);
    if (dist <= radius) {
      const dealt = Math.max(1, Math.floor(damage));
      enemy.hp -= dealt;
      enemy.flashTimer = 5;
      if (owner?.healFromDamage) owner.healFromDamage(dealt);
      if (damageTexts) {
        damageTexts.push({
          x: enemy.px + TILE_SIZE / 2, y: enemy.py,
          value: dealt, life: 20, color: "#ff8844", font: "14px sans-serif"
        });
      }
    }
  }
}