export class Projectile {
  constructor(
    x,
    y,
    vx,
    vy,
    damage,
    life = 30,
    pierce = 1,
    type = "normal",
    maxDistance = null,
    owner = null
  ) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = life;
    this.pierce = pierce; // number of enemies it can still hit
    this.type = type;

    this.owner = owner; // reference to whoever spawned this projectile

    // Distance tracking
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance;

    // Delay collision with owner for a short time (avoids instant self-hit)
    this.ignoreOwnerFrames = 5;

    // Crit-related fields
    this.color = null;
    this.critText = null;
    this.critYOffset = 0;
    this.critAlpha = 1;

    switch (type) {
      case "bouncing":
        this.bounces = 3;
        this.radius = 4;
        break;
      case "homing":
        this.speed = Math.hypot(vx, vy);
        this.radius = 4;
        break;
      case "heavy":
        this.radius = 6;
        break;
      case "spread":
      default:
        this.radius = 4;
    }
  }

  update(enemies = [], canvas = { width: 800, height: 600 }) {
    // Homing logic
    if (this.type === "homing" && enemies.length > 0) {
      let closest = null;
      let minDist = Infinity;
      for (const e of enemies) {
        if (e === this.owner) continue;
        const dist = Math.hypot(e.px + 16 - this.x, e.py + 16 - this.y);
        if (dist < minDist) {
          minDist = dist;
          closest = e;
        }
      }
      if (closest) {
        const angle = Math.atan2(
          closest.py + 16 - this.y,
          closest.px + 16 - this.x
        );
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    if (this.ignoreOwnerFrames > 0) this.ignoreOwnerFrames--;

    if (this.maxDistance !== null) {
      const dx = this.x - this.startX;
      const dy = this.y - this.startY;
      if (Math.hypot(dx, dy) >= this.maxDistance) this.life = 0;
    }

    if (this.type === "bouncing") {
      if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
        this.vx *= -1;
        this.bounces--;
      }
      if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
        this.vy *= -1;
        this.bounces--;
      }
    }

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
      const colors = {
        normal: "#fff",
        spread: "#ff0",
        bouncing: "#0ff",
        homing: "#f0f",
        heavy: "#f33",
        rain: "#00f"
      };
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

  dealDamage(target) {
    if (!this.canDamage(target)) return;

    if (typeof target.takeDamage === "function") {
      target.takeDamage(this.damage);

      // --- Life Leech ---
      if (this.owner?.healFromDamage) {
        this.owner.healFromDamage(this.damage);
      }

      this.pierce--;
    }
  }
}
