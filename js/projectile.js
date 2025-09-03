// projectile.js
export class Projectile {
  constructor(x, y, vx, vy, damage, life = 60, pierce = 1, type = "normal") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.life = life;
    this.pierce = pierce;
    this.type = type;

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
        const angle = Math.atan2(closest.py + 16 - this.y, closest.px + 16 - this.x);
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    // Bouncing logic
    if (this.type === "bouncing") {
      if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) this.vx *= -1, this.bounces--;
      if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) this.vy *= -1, this.bounces--;
    }
  }

  draw(ctx) {
    const colors = {
      normal: "#fff",
      spread: "#ff0",
      bouncing: "#0ff",
      homing: "#f0f",
      heavy: "#f33",
    };
    ctx.fillStyle = colors[this.type] || "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  isAlive() {
    if (this.life <= 0) return false;
    if (this.type === "bouncing" && this.bounces <= 0) return false;
    return true;
  }
}
