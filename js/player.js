import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";

export class Player {
  constructor(spriteIndex = 0) {
    // Start in middle of the map
    this.x = Math.floor(map.width / 2);
    this.y = Math.floor(map.height / 2);
    this.px = this.x * TILE_SIZE;
    this.py = this.y * TILE_SIZE;

    this.targetX = this.x;
    this.targetY = this.y;
    this.speed = 4;
    this.size = TILE_SIZE;
    this.hp = 100;
    this.maxHp = 100;

    // combat
    this.damage = 15;
    this.projectileSpeed = 6;
    this.projectileLife = 60;
    this.pierce = 1;
    this.fireCooldown = 0;
    this.fireCooldownMax = 20;

    // leveling / progression
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 10;
    this.gold = 0;

    this.spriteSheet = new Image();
    this.spriteSheet.src = "assets/player.png";

    this.spriteIndex = spriteIndex;
    this.dir = "down";
    this.frame = 0;
    this.frameTicker = 0;
    this.frameSpeed = 10;
    this.attacking = false;

    this.spriteFrameMap = {
      up: [0, 1, 2],
      down: [3, 4, 5],
      left: [6, 7, 8],
      right: [9, 10, 11],
    };

    this.lastDir = null;
    this.dirPressTime = 0;
    this.inputQueue = [];
    this.queueIndex = 0;

    this.contactIFrames = 0;
    this.pickupRange = 16;
  }

  reset(x = this.x, y = this.y) {
    // Reset player to given tile
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.px = x * TILE_SIZE;
    this.py = y * TILE_SIZE;

    // Reset stats
    this.hp = this.maxHp;
    this.contactIFrames = 0;
    this.inputQueue = [];
    this.queueIndex = 0;
    this.lastDir = null;
    this.dir = "down";
  }

  update(keys, projectiles) {
    const now = performance.now();
    if (this.contactIFrames > 0) this.contactIFrames--;

    // --- Determine pressed directions ---
    const directions = [];
    if (keys["ArrowUp"]) directions.push("up");
    if (keys["ArrowDown"]) directions.push("down");
    if (keys["ArrowLeft"]) directions.push("left");
    if (keys["ArrowRight"]) directions.push("right");

    // --- Update input queue ---
    this.inputQueue = directions;
    if (this.queueIndex >= this.inputQueue.length) this.queueIndex = 0;

    // --- Face current queued direction ---
    if (this.inputQueue.length > 0) {
      const currentDir = this.inputQueue[this.queueIndex];
      if (this.lastDir !== currentDir) {
        this.lastDir = currentDir;
        this.dirPressTime = now;
      }
      this.dir = currentDir;

      // Move if held long enough & reached target
      if (!this.attacking &&
          this.px === this.targetX * TILE_SIZE &&
          this.py === this.targetY * TILE_SIZE &&
          now - this.dirPressTime > 100) {

        let nx = this.x;
        let ny = this.y;
        switch (currentDir) {
          case "up": ny--; break;
          case "down": ny++; break;
          case "left": nx--; break;
          case "right": nx++; break;
        }

        if (map.isWalkable(nx, ny)) {
          this.targetX = nx;
          this.targetY = ny;
          this.x = nx;
          this.y = ny;
          map.applyTileEffects(this, nx, ny);

          this.queueIndex = (this.queueIndex + 1) % this.inputQueue.length;
          this.lastDir = this.inputQueue[this.queueIndex];
          this.dirPressTime = now;
        }
      }
    } else {
      this.lastDir = null;
      this.queueIndex = 0;
    }

    // --- Attack ---
    if (keys[" "] && this.fireCooldown <= 0) {
      this.attacking = true;
      this.fireCooldown = this.fireCooldownMax;

      let vx = 0, vy = 0;
      switch (this.dir) {
        case "up": vy = -this.projectileSpeed; break;
        case "down": vy = this.projectileSpeed; break;
        case "left": vx = -this.projectileSpeed; break;
        case "right": vx = this.projectileSpeed; break;
      }
      projectiles.push(
        new Projectile(
          this.px + TILE_SIZE / 2,
          this.py + TILE_SIZE / 2,
          vx,
          vy,
          this.damage,
          this.projectileLife,
          this.pierce
        )
      );
    } else {
      this.attacking = false;
    }

    if (this.fireCooldown > 0) this.fireCooldown--;

    // --- Smooth movement with clamping to target ---
    const targetPx = this.targetX * TILE_SIZE;
    const targetPy = this.targetY * TILE_SIZE;

    if (this.px < targetPx) this.px = Math.min(this.px + this.speed, targetPx);
    if (this.px > targetPx) this.px = Math.max(this.px - this.speed, targetPx);
    if (this.py < targetPy) this.py = Math.min(this.py + this.speed, targetPy);
    if (this.py > targetPy) this.py = Math.max(this.py - this.speed, targetPy);

    // --- Animate ---
    if (this.px !== targetPx || this.py !== targetPy) {
      this.frameTicker++;
      if (this.frameTicker >= this.frameSpeed) {
        this.frame = (this.frame + 1) % 2;
        this.frameTicker = 0;
      }
    } else if (this.attacking) {
      this.frame = 2;
    } else {
      this.frame = 0;
    }
  }

  draw(ctx) {
    if (!this.spriteSheet.complete) {
      ctx.fillStyle = "blue";
      ctx.fillRect(this.px, this.py, TILE_SIZE, TILE_SIZE);
      return;
    }

    const frames = this.spriteFrameMap[this.dir];
    const frameIndex = this.attacking ? frames[2] : frames[this.frame];
    const sx = frameIndex * TILE_SIZE;
    const sy = 0;

    ctx.drawImage(
      this.spriteSheet,
      sx, sy, TILE_SIZE, TILE_SIZE,
      this.px, this.py, TILE_SIZE, TILE_SIZE
    );

    // Draw HP bar above player
    ctx.fillStyle = "red";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE, 4);
    ctx.fillStyle = "green";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE * (this.hp / this.maxHp), 4);
  }

  // ==== XP / Leveling ====
  gainXp(amount, levelUpCallback) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
      if (levelUpCallback) levelUpCallback();
    }
  }

  levelUp() {
    this.level++;
    this.maxHp += 10;
    this.hp = this.maxHp;
    this.damage += 2;
    this.speed += 0.2;
    this.xpToNext = Math.floor(this.xpToNext * 1.25);
  }

  takeDamage(amount) {
    if (this.contactIFrames > 0) return;
    this.hp -= amount;
    this.contactIFrames = 30;
    if (this.hp < 0) this.hp = 0;
  }
}
