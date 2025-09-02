// projectile.js
export class Projectile {
  constructor(x, y, vx, vy, damage, life = 60, pierce = 1) {
    this.x = x;        // position
    this.y = y;
    this.vx = vx;      // velocity
    this.vy = vy;
    this.damage = damage;
    this.life = life;  // how many frames projectile lasts
    this.pierce = pierce; // how many enemies it can hit
    this.r = 3.5;      // radius for hitbox + drawing
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
}
