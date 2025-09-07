import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";

// === Fixed spawn location (change here when needed) ===
const SPAWN_X = 15;
const SPAWN_Y = 15;

export class Player {
  constructor(characterType = "warrior", spriteSlot = 0) {
    this.characterType = characterType;
    this.spriteSlot = spriteSlot; // 0-31
    this.setCharacter(characterType, spriteSlot);

    // Position (always spawn at fixed safe tile)
    this.x = SPAWN_X;
    this.y = SPAWN_Y;
    this.px = this.x * TILE_SIZE;
    this.py = this.y * TILE_SIZE;
    this.targetX = this.x;
    this.targetY = this.y;

    // Movement
    this.dir = "down";
    this.lastDir = null;
    this.dirPressTime = 0;
    this.inputQueue = [];
    this.queueIndex = 0;

    // Combat
    this.fireCooldown = 0;
    this.attacking = false;

    // Leveling
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 10;
    this.gold = 0;

    // Sprite
    this.spriteSheet = new Image();
    this.spriteSheet.src = "assets/player.png";
    this.frame = 0;
    this.frameTicker = 0;
    this.frameSpeed = 4;

    // Misc
    this.contactIFrames = 0;
    this.pickupRange = 16;

    // Input state
    this.inputKeys = {};
    this.attackPressed = false;

    // === Crit system ===
    this.critChance = 0.05;       
    this.critMultiplier = 2.0; 

    // === Life Leech ===
    this.lifeLeech = 0.1; // 0 = off, 0.2 = 20% of damage dealt heals

    // Keyboard events
    window.addEventListener("keydown", e => { this.inputKeys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", e => { this.inputKeys[e.key.toLowerCase()] = false; });

    // Touch controls
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

      el.addEventListener("touchstart", e => { e.preventDefault(); press(); }, { passive: false });
      el.addEventListener("touchend", e => { e.preventDefault(); release(); }, { passive: false });
      el.addEventListener("touchcancel", e => { e.preventDefault(); release(); }, { passive: false });
    }
  }

  setCharacter(characterType, slot = 0) {
    this.characterType = characterType;
    this.spriteSlot = slot;

    switch (characterType) {
      case "warrior":
        this.baseDamage = 18;
        this.baseSpeed = 4;
        this.baseHp = 120;
        this.projectileType = "normal";
        this.projectileSpeed = 6;
        this.projectileLife = 60;
        this.maxDistance = 250;
        this.pierce = 1;
        this.fireCooldownMax = 20;
        break;
      case "archer":
        this.baseDamage = 12;
        this.baseSpeed = 4.5;
        this.baseHp = 100;
        this.projectileType = "spread";
        this.projectileSpeed = 6;
        this.projectileLife = 60;
        this.maxDistance = 250;
        this.pierce = 1;
        this.fireCooldownMax = 20;
        break;
      case "mage":
        this.baseDamage = 10;
        this.baseSpeed = 4;
        this.baseHp = 90;
        this.projectileType = "homing";
        this.projectileSpeed = 5;
        this.projectileLife = 80;
        this.maxDistance = 250;
        this.pierce = 1;
        this.fireCooldownMax = 20;
        break;
    }

    this.maxHp = this.baseHp;
    this.hp = this.maxHp;
    this.speed = this.baseSpeed;
    this.damage = this.baseDamage;
  }

  setSpriteSlot(slot) {
    this.spriteSlot = slot;
    this.frame = 0;
    this.frameTicker = 0;
  }

  reset(x = SPAWN_X, y = SPAWN_Y) {
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

  keyHeld(key) { return !!this.inputKeys[key]; }

  update(projectiles = [], enemies = []) {
    const now = performance.now();
    if (this.contactIFrames > 0) this.contactIFrames--;

    const keys = this.inputKeys;
    let direction = null;
    if (keys["arrowup"] || keys["w"]) direction = "up";
    else if (keys["arrowdown"] || keys["s"]) direction = "down";
    else if (keys["arrowleft"] || keys["a"]) direction = "left";
    else if (keys["arrowright"] || keys["d"]) direction = "right";

    if (direction) { this.inputQueue = [direction]; this.queueIndex = 0; } else { this.inputQueue = []; this.queueIndex = 0; }

    if (this.inputQueue.length > 0) {
      const currentDir = this.inputQueue[0];
      if (this.lastDir !== currentDir) { this.lastDir = currentDir; this.dirPressTime = now; }
      this.dir = currentDir;

      if (!this.attacking && this.px === this.targetX * TILE_SIZE && this.py === this.targetY * TILE_SIZE && now - this.dirPressTime > 100) {
        let nx = this.x, ny = this.y;
        switch (currentDir) { case "up": ny--; break; case "down": ny++; break; case "left": nx--; break; case "right": nx++; break; }
        if (map.isWalkable(nx, ny)) {
          this.targetX = nx; this.targetY = ny;
          this.x = nx; this.y = ny;
          map.applyTileEffects?.(this, nx, ny);
        }
      }
    } else { this.lastDir = null; }

    // --- Attack ---
    if ((keys[" "] || this.attackPressed) && this.fireCooldown <= 0) {
      this.attacking = true;
      this.fireCooldown = this.fireCooldownMax;

      const spawnProjectile = (vx, vy, type = this.projectileType) => {
        let dmg = this.damage;
        let isCrit = false;
        if (Math.random() < this.critChance) {
            dmg = Math.floor(dmg * this.critMultiplier);
            isCrit = true;
        }

        const proj = new Projectile(
          this.px + TILE_SIZE / 2,
          this.py + TILE_SIZE / 2,
          vx,
          vy,
          dmg,
          this.projectileLife,
          this.pierce,
          type,
          this.maxDistance,
          this
        );

        // --- Add maxDistance tracking ---
        proj.startX = this.px + TILE_SIZE / 2;
        proj.startY = this.py + TILE_SIZE / 2;
        proj.maxDistance = this.maxDistance;

        // Wrap original update for maxDistance
        const originalUpdate = proj.update.bind(proj);
        proj.update = function(enemies = [], canvas = { width: 800, height: 600 }) {
          originalUpdate(enemies, canvas);
          const dx = this.x - this.startX;
          const dy = this.y - this.startY;
          if(Math.hypot(dx, dy) >= this.maxDistance) this.life = 0;
        }

        if (isCrit) {
            proj.color = "#ffff00";     
            proj.isCrit = true;         
            proj.critText = `CRIT! ${dmg}`;
        }

        projectiles.push(proj);
      };

      switch (this.projectileType) {
        case "spread":
          let baseAngle = 0;
          switch (this.dir) {
            case "up": baseAngle = -Math.PI / 2; break;
            case "down": baseAngle = Math.PI / 2; break;
            case "left": baseAngle = Math.PI; break;
            case "right": baseAngle = 0; break;
          }
          const spread = Math.PI / 12;
          [-1,0,1].forEach(offset => {
            const angle = baseAngle + offset * spread;
            spawnProjectile(Math.cos(angle)*this.projectileSpeed, Math.sin(angle)*this.projectileSpeed, "spread");
          });
          break;

        default:
          let vx=0, vy=0;
          switch (this.dir) { case "up": vy=-this.projectileSpeed; break; case "down": vy=this.projectileSpeed; break; case "left": vx=-this.projectileSpeed; break; case "right": vx=this.projectileSpeed; break; }
          spawnProjectile(vx, vy, this.projectileType);
      }

      this.attackPressed = false;
    } else { this.attacking = false; }

    if (this.fireCooldown > 0) this.fireCooldown--;

    const targetPx = this.targetX * TILE_SIZE;
    const targetPy = this.targetY * TILE_SIZE;
    if (this.px < targetPx) this.px = Math.min(this.px + this.speed, targetPx);
    if (this.px > targetPx) this.px = Math.max(this.px - this.speed, targetPx);
    if (this.py < targetPy) this.py = Math.min(this.py + this.speed, targetPy);
    if (this.py > targetPy) this.py = Math.max(this.py - this.speed, targetPy);

    this.updateAnimation(targetPx, targetPy);
  }

  // --- Life Leech Helper ---
  healFromDamage(amount) {
    if(this.lifeLeech > 0) {
      const healAmount = Math.floor(amount * this.lifeLeech);
      this.hp = Math.min(this.hp + healAmount, this.maxHp);
    }
  }

  updateAnimation(targetPx, targetPy) {
    const moving = this.px !== targetPx || this.py !== targetPy;
    const dirOffsetMap = { "up":0,"down":3,"left":6,"right":9 };
    const dirOffset = dirOffsetMap[this.dir] || 0;

    let startFrame = 0, frameCount = 3;

    if(this.attacking){ startFrame=dirOffset+2; frameCount=1; }
    else if(moving){ startFrame=dirOffset+1; frameCount=1; }
    else{ startFrame=dirOffset+0; frameCount=1; }

    this.frameTicker++;
    if(this.frameTicker>=this.frameSpeed){
      this.frame=startFrame+((this.frame-startFrame+1)%frameCount);
      this.frameTicker=0;
    }

    this.currentAnim=this.spriteSlot;
  }

  draw(ctx) {
    if (!this.spriteSheet.complete) {
        ctx.fillStyle = "blue";
        ctx.fillRect(this.px, this.py, TILE_SIZE, TILE_SIZE);
        return;
    }

    const totalFrameIndex = this.spriteSlot * 12 + this.frame;
    const tilesPerRow = this.spriteSheet.naturalWidth / TILE_SIZE;
    const sx = (totalFrameIndex % tilesPerRow) * TILE_SIZE;
    const sy = Math.floor(totalFrameIndex / tilesPerRow) * TILE_SIZE;

    ctx.drawImage(this.spriteSheet, sx, sy, TILE_SIZE, TILE_SIZE, this.px, this.py, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = "red";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE, 4);
    ctx.fillStyle = "green";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE * (this.hp / this.maxHp), 4);
  }

  gainXp(amount, levelUpCallback){
    this.xp+=amount;
    while(this.xp>=this.xpToNext){
      this.xp-=this.xpToNext;
      this.levelUp();
      if(levelUpCallback) levelUpCallback();
    }
  }

  levelUp(){
    this.level++;
    this.maxHp+=10;
    this.hp=this.maxHp;
    this.damage+=2;
    this.speed+=0.2;
    this.xpToNext=Math.floor(this.xpToNext*1.25);
  }

  takeDamage(amount){
    if(this.contactIFrames>0) return;
    this.hp-=amount;
    this.contactIFrames=30;
    if(this.hp<0) this.hp=0;
  }

  // ==== Unlock / Equip New Projectile ====
  unlockProjectile(type) {
    this.projectileType = type;             // Equip it immediately
    if (!this.unlockedProjectiles) this.unlockedProjectiles = new Set();
    this.unlockedProjectiles.add(type);     // Keep track of all unlocked projectiles
  }
}
