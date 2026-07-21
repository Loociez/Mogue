import { applyChainLightning } from "./skills.js";
import { drawEffect } from "./effects.js"; // ✅ add this at the top

export class Projectile {
  constructor(
    x, y, vx, vy, damage,
    life = 30, pierce = 1, type = "normal",
    maxDistance = null, owner = null
  ) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.life = life;
    this.pierce = pierce;
    this.type = type;
    this.owner = owner;

    // Base speed setup
    const baseSpeed = this.owner?.baseProjectileSpeed ?? 0.3; // raw units
    const speedMultiplier = this.owner?.projectileSpeed ?? 1;  // multiplier
    const angle = Math.atan2(vy, vx);
    this.vx = Math.cos(angle) * baseSpeed * speedMultiplier;
    this.vy = Math.sin(angle) * baseSpeed * speedMultiplier;

    // Distance tracking
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance;

    // Delay collision with owner
    this.ignoreOwnerFrames = 5;

    // Crit
    this.color = null;
    this.critText = null;
    this.critYOffset = 0;
    this.critAlpha = 1;

    // Optional hooks
    this.onExpire = null;
    this.onHit = null;

    // Gradual homing (set by Player.spawnProjectile for player shots; left at
    // 0 for anything that shouldn't curve, like most enemy projectiles)
    this.homingTurnRate = 0;
    this.presetTarget = null;
    this.homingTarget = null;

    // Type-specific properties
    switch (type) {
      case "bouncing":
        this.bounces = 3;
        this.radius = 4;
        break;
      case "homing":
        this.speed = Math.hypot(this.vx, this.vy);
        this.radius = 4;
        break;
      case "heavy":
        this.radius = 6;
        break;
      default:
        this.radius = 4;
    }
  }

  acquireNearest(enemies) {
    let closest = null, minDist = Infinity;
    for (const e of enemies) {
      if (e === this.owner) continue;
      const dist = Math.hypot(e.px + 16 - this.x, e.py + 16 - this.y);
      if (dist < minDist) { minDist = dist; closest = e; }
    }
    return closest;
  }

  // Update velocity if owner's projectileSpeed changes mid-flight
  updateVelocity() {
    if (!this.owner) return;
    const angle = Math.atan2(this.vy, this.vx);
    const baseSpeed = this.owner.baseProjectileSpeed ?? 0.3;
    const speedMultiplier = this.owner.projectileSpeed ?? 1;
    this.vx = Math.cos(angle) * baseSpeed * speedMultiplier;
    this.vy = Math.sin(angle) * baseSpeed * speedMultiplier;
  }

  update(enemies = [], canvas = { width: 800, height: 600 }, projectiles = []) {
    // Gradual homing (player shots): curve toward a locked target at a
    // limited turn rate per frame, rather than snapping straight at it.
    if (this.homingTurnRate > 0 && enemies.length > 0) {
      if (!this.homingTarget || this.homingTarget.hp <= 0 || !enemies.includes(this.homingTarget)) {
        this.homingTarget = (this.presetTarget && enemies.includes(this.presetTarget) && this.presetTarget.hp > 0)
          ? this.presetTarget
          : this.acquireNearest(enemies);
      }
      if (this.homingTarget) {
        const tx = this.homingTarget.px + 16, ty = this.homingTarget.py + 16;
        const desired = Math.atan2(ty - this.y, tx - this.x);
        const current = Math.atan2(this.vy, this.vx);
        let diff = desired - current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to [-PI, PI]
        const turn = Math.max(-this.homingTurnRate, Math.min(this.homingTurnRate, diff));
        const newAngle = current + turn;
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
      }
    } else if (this.type === "homing" && enemies.length > 0) {
      // Legacy instant-snap homing, still used by enemy homing shots
      // (wizard/voidcaster) that don't set a turn rate.
      const closest = this.acquireNearest(enemies);
      if (closest) {
        const angle = Math.atan2(closest.py + 16 - this.y, closest.px + 16 - this.x);
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
      }
    }

    // Move projectile
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.ignoreOwnerFrames > 0) this.ignoreOwnerFrames--;

    // Max distance
    if (this.maxDistance !== null) {
      const dx = this.x - this.startX;
      const dy = this.y - this.startY;
      if (Math.hypot(dx, dy) >= this.maxDistance) this.life = 0;
    }

    // Bouncing logic
    if (this.type === "bouncing") {
      if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) { this.vx *= -1; this.bounces--; }
      if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) { this.vy *= -1; this.bounces--; }
    }

    // Expiry hook (explosive shot / cluster projectile shards, etc)
    if (this.life <= 0) {
      if (this.onExpire) {
        this.onExpire(projectiles);
        this.onExpire = null;
      }
    }

    // Crit animation
    if (this.critText) {
      this.critYOffset -= 0.5;
      this.critAlpha -= 0.02;
      if (this.critAlpha <= 0) {
        this.critText = null;
        this.critAlpha = 1;
        this.critYOffset = 0;
        this.color = null;
      }
    }

    if (this.pierce < 0) this.pierce = 0;
  }

  draw(ctx) {
    const spriteByType = {
      normal: "boltNormal", spread: "boltSpread", homing: "boltHoming",
      heavy: "boltHeavy", bouncing: "boltBouncing", rain: "boltRain",
      lightning: "boltLightning", dashshot: "boltDashshot", "boss-burst": "boltBossBurst"
    };
    const spriteKey = spriteByType[this.type];

    let tint = null;
    if (this.owner?.type === "boss" || this.owner?.isMiniBoss) tint = "#ff6600";
    else if (this.color) tint = this.color;

    const size = this.radius * 2.75;
    const angle = Math.atan2(this.vy, this.vx);
    const drew = spriteKey && drawEffect(ctx, spriteKey, this.x, this.y, size, angle, tint);

    if (!drew) {
      // Fallback: original vector circle (sheet not loaded, or an unmapped type)
      if (this.owner?.type === "boss" || this.owner?.isMiniBoss) ctx.fillStyle = "#ff6600";
      else if (this.color) ctx.fillStyle = this.color;
      else {
        const colors = { normal:"#fff", spread:"#ff0", bouncing:"#0ff", homing:"#f0f", heavy:"#f33", rain:"#00f", lightning:"#9cf" };
        ctx.fillStyle = colors[this.type] || "#fff";
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  isAlive() {
    if (this.life <= 0) return false;
    if (this.type === "bouncing" && this.bounces <= 0) return false;
    if (this.pierce <= 0) return false;
    return true;
  }

  canDamage(target) {
    if (target === this.owner && this.ignoreOwnerFrames > 0) return false;
    return this.pierce > 0;
  }

  dealDamage(target, projectiles = [], enemies = []) {
    if (!this.canDamage(target)) return;

    if (typeof target.takeDamage === "function") {
      target.takeDamage(this.damage);
      this.target = target;

      // Life Leech
      if (this.owner?.healFromDamage) this.owner.healFromDamage(this.damage);

      this.pierce--;

      // Delayed Explosion
      if (this.owner?.delayedExplosion) {
        setTimeout(() => {
          if (this.isAlive()) return;
          if (this.onExpire) this.onExpire(projectiles);
        }, this.owner.delayedExplosionTime ?? 60);
      }

      // Exploding Shot on hit
      if (this.owner?.explosiveShot && this.onExpire) {
        this.onExpire(projectiles);
        this.onExpire = null;
      }

      // Custom onHit hook
      if (this.onHit) this.onHit(target, projectiles);

      // Chain Lightning hook
      applyChainLightning(this, enemies, projectiles);
    }
  }
}