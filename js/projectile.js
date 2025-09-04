// projectile.js
export class Projectile {
  constructor(x, y, vx, vy, damage, life = 30, pierce = 1, type = "normal", maxDistance = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = life;
    this.pierce = pierce; // number of enemies it can still hit
    this.type = type;

    // Distance tracking
    this.startX = x;
    this.startY = y;
    this.maxDistance = maxDistance; // if set, projectile dies after traveling this far

    // Crit-related fields (for visual effect, not piercing)
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

    // Distance check
    if (this.maxDistance !== null) {
      const dx = this.x - this.startX;
      const dy = this.y - this.startY;
      if (Math.hypot(dx, dy) >= this.maxDistance) {
        this.life = 0; // mark projectile dead
      }
    }

    // Bouncing logic
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

    // Crit text float + fade
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

    // Safety: pierce cannot be negative
    if (this.pierce < 0) this.pierce = 0;
  }

  draw(ctx) {
    if (this.color) {
      ctx.fillStyle = this.color;
    } else {
      const colors = {
        normal: "#fff",
        spread: "#ff0",
        bouncing: "#0ff",
        homing: "#f0f",
        heavy: "#f33",
      };
      ctx.fillStyle = colors[this.type] || "#fff";
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw crit text if any
    if (this.critText) {
      ctx.fillStyle = `rgba(255, 255, 0, ${this.critAlpha})`;
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.critText, this.x, this.y + this.critYOffset - 12);
    }
  }

  isAlive() {
    if (this.life <= 0) return false;
    if (this.type === "bouncing" && this.bounces <= 0) return false;
    if (this.pierce <= 0) return false; // remove projectile if pierce used up
    return true;
  }
}
