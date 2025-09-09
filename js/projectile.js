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
    // Homing logic
    if (this.type === "homing" && enemies.length > 0) {
      let closest = null, minDist = Infinity;
      for (const e of enemies) {
        if (e === this.owner) continue;
        const dist = Math.hypot(e.px + 16 - this.x, e.py + 16 - this.y);
        if (dist < minDist) { minDist = dist; closest = e; }
      }
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

    // Explosions on expiration
    if (this.life <= 0) {
      if (this.owner?.customProjectile && this.onExpire) {
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
    if (this.owner?.type === "boss" || this.owner?.isMiniBoss) ctx.fillStyle = "#ff6600";
    else if (this.color) ctx.fillStyle = this.color;
    else {
      const colors = { normal:"#fff", spread:"#ff0", bouncing:"#0ff", homing:"#f0f", heavy:"#f33", rain:"#00f" };
      ctx.fillStyle = colors[this.type] || "#fff";
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
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

  dealDamage(target, projectiles = []) {
    if (!this.canDamage(target)) return;

    if (typeof target.takeDamage === "function") {
      target.takeDamage(this.damage);

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
      if (this.owner?.explodingShot && this.onExpire) {
        this.onExpire(projectiles);
        this.onExpire = null;
      }

      // Custom onHit hook
      if (this.onHit) this.onHit(target, projectiles);
    }
  }
}
