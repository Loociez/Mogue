import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";

export class Player {
  constructor(spriteIndex = 0) {
    // Position
    this.x = Math.floor(map.width / 2);
    this.y = Math.floor(map.height / 2);
    this.px = this.x * TILE_SIZE;
    this.py = this.y * TILE_SIZE;
    this.targetX = this.x;
    this.targetY = this.y;

    // Movement
    this.speed = 4;
    this.dir = "down";
    this.lastDir = null;
    this.dirPressTime = 0;
    this.inputQueue = [];
    this.queueIndex = 0;

    this.projectileType = "normal"; // default

    // Combat
    this.hp = 100;
    this.maxHp = 100;
    this.damage = 15;
    this.projectileSpeed = 6;
    this.projectileLife = 60;
    this.pierce = 1;
    this.fireCooldown = 0;
    this.fireCooldownMax = 20;
    this.attacking = false;

    // Leveling
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 10;
    this.gold = 0;

    // Sprite
    this.spriteSheet = new Image();
    this.spriteSheet.src = "assets/player.png";
    this.spriteIndex = spriteIndex;
    this.frame = 0;
    this.frameTicker = 0;
    this.frameSpeed = 10;
    this.spriteFrameMap = {
      up: [0, 1, 2],
      down: [3, 4, 5],
      left: [6, 7, 8],
      right: [9, 10, 11],
    };

    // Misc
    this.contactIFrames = 0;
    this.pickupRange = 16;

    // Input state
    this.inputKeys = {};
    this.attackPressed = false;

    // --- Keyboard events ---
    window.addEventListener("keydown", e => {
      this.inputKeys[e.key.toLowerCase()] = true;
    });
    window.addEventListener("keyup", e => {
      this.inputKeys[e.key.toLowerCase()] = false;
    });

    // --- Touch controls ---
    const touchMap = {
      "btnUp": "arrowup",
      "btnDown": "arrowdown",
      "btnLeft": "arrowleft",
      "btnRight": "arrowright",
      "btnAttack": "attack"
    };

    for (let id in touchMap) {
      const el = document.getElementById(id);
      if (!el) continue;
      const key = touchMap[id];

      const press = () => {
        if (key === "attack") this.attackPressed = true;
        else this.inputKeys[key] = true;
      };

      const release = () => {
        if (key === "attack") this.attackPressed = false;
        else this.inputKeys[key] = false;
      };

      el.addEventListener("touchstart", e => { e.preventDefault(); press(); });
      el.addEventListener("mousedown", e => { e.preventDefault(); press(); });
      el.addEventListener("touchend", e => { e.preventDefault(); release(); });
      el.addEventListener("mouseup", e => { e.preventDefault(); release(); });
      el.addEventListener("touchcancel", e => { e.preventDefault(); release(); });
    }
  }

  reset(x = this.x, y = this.y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.px = x * TILE_SIZE;
    this.py = y * TILE_SIZE;

    this.hp = this.maxHp;
    this.contactIFrames = 0;
    this.inputQueue = [];
    this.queueIndex = 0;
    this.lastDir = null;
    this.dir = "down";
  }

  keyHeld(key) {
    return !!this.inputKeys[key];
  }

  update(projectiles = [], enemies = []) {
  const now = performance.now();
  if (this.contactIFrames > 0) this.contactIFrames--;

  // --- Gamepad input ---
  const gamepads = navigator.getGamepads();
  if (gamepads) {
    for (let gp of gamepads) {
      if (!gp) continue;
      const lx = gp.axes[0];
      const ly = gp.axes[1];
      const rt = gp.buttons[7]?.pressed;
      const threshold = 0.4;

      if (Math.abs(lx) > threshold || Math.abs(ly) > threshold) {
        if (Math.abs(lx) > Math.abs(ly)) {
          this.inputKeys["arrowleft"] = lx < -threshold;
          this.inputKeys["arrowright"] = lx > threshold;
          this.inputKeys["arrowup"] = false;
          this.inputKeys["arrowdown"] = false;
        } else {
          this.inputKeys["arrowup"] = ly < -threshold;
          this.inputKeys["arrowdown"] = ly > threshold;
          this.inputKeys["arrowleft"] = false;
          this.inputKeys["arrowright"] = false;
        }
      } else {
        this.inputKeys["arrowup"] = false;
        this.inputKeys["arrowdown"] = false;
        this.inputKeys["arrowleft"] = false;
        this.inputKeys["arrowright"] = false;
      }

      this.attackPressed = rt;
    }
  }

  // --- Determine pressed direction ---
  const keys = this.inputKeys;
  let direction = null;
  if (keys["arrowup"] || keys["w"]) direction = "up";
  else if (keys["arrowdown"] || keys["s"]) direction = "down";
  else if (keys["arrowleft"] || keys["a"]) direction = "left";
  else if (keys["arrowright"] || keys["d"]) direction = "right";

  if (direction) {
    this.inputQueue = [direction];
    this.queueIndex = 0;
  } else {
    this.inputQueue = [];
    this.queueIndex = 0;
  }

  // --- Move player ---
  if (this.inputQueue.length > 0) {
    const currentDir = this.inputQueue[0];
    if (this.lastDir !== currentDir) {
      this.lastDir = currentDir;
      this.dirPressTime = now;
    }
    this.dir = currentDir;

    if (!this.attacking &&
        this.px === this.targetX * TILE_SIZE &&
        this.py === this.targetY * TILE_SIZE &&
        now - this.dirPressTime > 100) {

      let nx = this.x, ny = this.y;
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
        map.applyTileEffects?.(this, nx, ny);
      }
    }
  } else {
    this.lastDir = null;
  }

  // --- Attack / fire projectile ---
  if ((keys[" "] || this.attackPressed) && this.fireCooldown <= 0) {
    this.attacking = true;
    this.fireCooldown = this.fireCooldownMax;

    const spawnProjectile = (vx, vy, type = this.projectileType) => {
      projectiles.push(
        new Projectile(
          this.px + TILE_SIZE / 2,
          this.py + TILE_SIZE / 2,
          vx, vy,
          this.damage,
          this.projectileLife,
          this.pierce,
          type
        )
      );
    };

    switch (this.projectileType) {
      case "spread":
        const angles = [-0.2, 0, 0.2];
        angles.forEach(a => {
          const speed = this.projectileSpeed;
          let vx = 0, vy = 0;
          switch (this.dir) {
            case "up": vx = Math.sin(a) * speed; vy = -Math.cos(a) * speed; break;
            case "down": vx = Math.sin(a) * speed; vy = Math.cos(a) * speed; break;
            case "left": vx = -Math.cos(a) * speed; vy = Math.sin(a) * speed; break;
            case "right": vx = Math.cos(a) * speed; vy = Math.sin(a) * speed; break;
          }
          spawnProjectile(vx, vy, "spread");
        });
        break;

      default:
        let vx = 0, vy = 0;
        switch (this.dir) {
          case "up": vy = -this.projectileSpeed; break;
          case "down": vy = this.projectileSpeed; break;
          case "left": vx = -this.projectileSpeed; break;
          case "right": vx = this.projectileSpeed; break;
        }
        spawnProjectile(vx, vy, this.projectileType);
    }

    this.attackPressed = false;
  } else {
    this.attacking = false;
  }

  if (this.fireCooldown > 0) this.fireCooldown--;

  // --- Smooth movement ---
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

    ctx.fillStyle = "red";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE, 4);
    ctx.fillStyle = "green";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE * (this.hp / this.maxHp), 4);
  }

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
