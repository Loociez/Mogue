import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";
import { resetSkillTree } from "./skilltree.js";
import { explodeAt } from "./skills.js";
import { drawEffect } from "./effects.js";

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
    this.basePickupRange = 16;
    this.pickupRange = this.basePickupRange;

    // Input state
    this.inputKeys = {};
    this.attackHeld = false;

    // === Crit system ===
    this.critChance = 0.05;
    this.critMultiplier = 2.0;

    // === Blink Trail ===
    this.blinkTrail = [];

    // === Skill-tree driven stats (all start at 0/off; skilltree.resetSkillTree
    // also resets these at run-start, this is just so Player is well-formed
    // even before that runs) ===
    this.lifeLeech = 0;
    this.dodge = 0;
    this.armorPierce = 0;
    this.phaseStrike = 0;
    this.multishot = 0;
    this.berserkerRage = 0;
    this.adrenaline = 0;
    this.rapidFire = false;
    this.hpRegen = 0;
    this.hpRegenTimer = 0;

    this.explosiveShot = false;
    this.explosiveShotPower = 0;
    this.ricochet = 0;
    this.clusterProjectile = false;
    this.clusterShards = 5;

    this.energyShield = 0;
    this.energyShieldMax = 0;
    this.energyShieldCooldown = 0;
    this.energyShieldCooldownMax = 1800;

    this.stoneform = false;
    this.stoneformActive = false;
    this.stoneformTimer = 0;
    this.stoneformCooldown = 0;
    this.stoneformCooldownMax = 1200;
    this.stoneformDuration = 0;

    this.magnet = false;

    this.guardianShieldMaxCharges = 0;
    this.guardianShieldCharges = 0;
    this.guardianShieldRecharge = 0;
    this.guardianShieldRechargeMax = 480;
    this.shieldAngle = 0;

    this.chainLightning = 0;
    this.dashShot = 0;

    this.blinkDistance = 0;
    this.blinkCooldown = 0;
    this.blinkCooldownTimer = 0;
    this.blinkChargesMax = 1;
    this.blinkCharges = 1;
    this.lightningReflexes = false;

    this.unlockedSkills = [];
    this.skillPoints = 0;

    // Keyboard events
    window.addEventListener("keydown", e => { this.inputKeys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", e => { this.inputKeys[e.key.toLowerCase()] = false; });

    // Touch controls: attack button (movement is handled by the joystick, see game.js)
    const attackBtn = document.getElementById("btnAttack");
    if (attackBtn) {
      const press = () => { this.attackHeld = true; };
      const release = () => { this.attackHeld = false; };
      attackBtn.addEventListener("touchstart", e => { e.preventDefault(); press(); }, { passive: false });
      attackBtn.addEventListener("touchend", e => { e.preventDefault(); release(); }, { passive: false });
      attackBtn.addEventListener("touchcancel", e => { e.preventDefault(); release(); }, { passive: false });
    }
  }

  setCharacter(characterType, slot = 0) {
    this.characterType = characterType;
    this.spriteSlot = slot;

    switch (characterType) {
      case "warrior":
        // Heavy Tracker: slow to turn but hits like a truck. Every shot locks
        // onto the nearest enemy and gradually curves toward it.
        this.baseDamage = 20;
        this.baseSpeed = 2.6;
        this.baseHp = 130;
        this.projectileType = "normal";
        this.projectileSpeed = 6;
        this.projectileLife = 70;
        this.maxDistance = 260;
        this.pierce = 2;
        this.fireCooldownMax = 22;
        this.homingTurnRate = 0.055;
        this.homingStyle = "single";
        break;
      case "archer":
        // Volley Tracker: fires a spread of arrows that each lock onto a
        // *different* nearby enemy, so a single volley can tag multiple foes.
        this.baseDamage = 11;
        this.baseSpeed = 3.0;
        this.baseHp = 95;
        this.projectileType = "spread";
        this.projectileSpeed = 6.5;
        this.projectileLife = 60;
        this.maxDistance = 260;
        this.pierce = 1;
        this.fireCooldownMax = 18;
        this.homingTurnRate = 0.15;
        this.homingStyle = "multi";
        break;
      case "mage":
        // Precision Tracker: single bolt, turns fast enough to reliably hit
        // whatever it locks onto. Squishiest class, but rarely misses.
        this.baseDamage = 11;
        this.baseSpeed = 2.5;
        this.baseHp = 85;
        this.projectileType = "homing";
        this.projectileSpeed = 5.5;
        this.projectileLife = 85;
        this.maxDistance = 280;
        this.pierce = 1;
        this.fireCooldownMax = 20;
        this.homingTurnRate = 0.27;
        this.homingStyle = "single";
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
    this.fireCooldown = 0;
    this.attacking = false;
    this.pickupRange = this.basePickupRange;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = 10;
    this.gold = 0;

    // --- Reset skill tree and player skill stats ---
    resetSkillTree(this);

    // --- Restore character base stats (damage, projectileType, fireCooldownMax, speed) ---
    this.setCharacter(this.characterType, this.spriteSlot);
  }

  keyHeld(key) { return !!this.inputKeys[key]; }

  createBlinkTrail(oldX, oldY, newX, newY) {
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      this.blinkTrail.push({
        x: oldX + (newX - oldX) * t,
        y: oldY + (newY - oldY) * t,
        alpha: 1 - t * 0.8,
        life: 15
      });
    }
  }

  update(projectiles = [], enemies = [], pickups = [], visualEffects = []) {
    const now = performance.now();
    if (this.contactIFrames > 0) this.contactIFrames--;

    // === Stoneform: auto-trigger brief invulnerability when critically low ===
    if (this.stoneformCooldown > 0) this.stoneformCooldown--;
    if (this.stoneformActive) {
      this.stoneformTimer--;
      if (this.stoneformTimer <= 0) this.stoneformActive = false;
    } else if (this.stoneform && this.stoneformCooldown <= 0 && this.hp > 0 && this.hp / this.maxHp <= 0.25) {
      this.stoneformActive = true;
      this.stoneformTimer = this.stoneformDuration || 60;
      this.stoneformCooldown = this.stoneformCooldownMax || 1200;
      this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.1));
      visualEffects.push({ x: this.px + TILE_SIZE / 2, y: this.py + TILE_SIZE / 2, radius: TILE_SIZE * 1.3, life: 25, maxLife: 25, sprite: "explosionBurst", tint: "#d8d8d8" });
    }

    // === Energy Shield recharge ===
    if (this.energyShieldMax > 0 && this.energyShield < this.energyShieldMax) {
      this.energyShieldCooldown--;
      if (this.energyShieldCooldown <= 0) {
        this.energyShield = this.energyShieldMax;
        this.energyShieldCooldown = this.energyShieldCooldownMax;
      }
    }

    // === Guardian Shield recharge ===
    if (this.guardianShieldMaxCharges > 0 && this.guardianShieldCharges < this.guardianShieldMaxCharges) {
      this.guardianShieldRecharge--;
      if (this.guardianShieldRecharge <= 0) {
        this.guardianShieldCharges++;
        this.guardianShieldRecharge = this.guardianShieldRechargeMax;
      }
    }

    // === HP Regen ===
    if (this.hpRegen > 0 && this.hp > 0 && this.hp < this.maxHp) {
      this.hpRegenTimer++;
      if (this.hpRegenTimer >= 60) {
        this.hp = Math.min(this.maxHp, this.hp + this.hpRegen);
        this.hpRegenTimer = 0;
      }
    }

    // === Blink charge recovery ===
    if (this.blinkCooldownTimer > 0) this.blinkCooldownTimer--;
    if (this.blinkCharges < (this.blinkChargesMax || 1) && this.blinkCooldownTimer <= 0) {
      this.blinkCharges = this.blinkChargesMax || 1;
    }

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

    // --- Magnet effect (base pickup range is boosted directly by the skill;
    // this is what actually pulls orbs in on top of the pull-when-in-range
    // logic that already lives in the main game loop) ---
    if (this.magnet) {
      const pullStrength = 1.2;
      for (let p of pickups) {
        const dx = (this.px + TILE_SIZE / 2) - (p.x + (p.size || 0) / 2);
        const dy = (this.py + TILE_SIZE / 2) - (p.y + (p.size || 0) / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < this.pickupRange && dist > 0) {
          p.x += (dx / dist) * pullStrength;
          p.y += (dy / dist) * pullStrength;
        }
      }
    }

    // === Attack speed modifiers: berserker (low hp) and adrenaline (full hp) ===
    let cooldownMult = 1;
    if (this.berserkerRage > 0 && this.hp / this.maxHp <= 0.5) cooldownMult -= this.berserkerRage;
    if (this.adrenaline > 0 && this.hp >= this.maxHp) cooldownMult -= this.adrenaline;
    cooldownMult = Math.max(0.25, cooldownMult);

    const spawnProjectile = (vx, vy, type = this.projectileType, presetTarget = null) => {
      let dmg = this.damage;
      const bonusMult = 1 + (this.armorPierce || 0) + (this.phaseStrike || 0);
      dmg = Math.round(dmg * bonusMult);

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

      proj.startX = this.px + TILE_SIZE / 2;
      proj.startY = this.py + TILE_SIZE / 2;
      proj.maxDistance = this.maxDistance;

      // Every class homes now, just with a different feel: warrior turns
      // slowly onto the nearest target, mage turns fast and precise, and
      // archer's volley (see fireVolley) locks each shot to a different
      // enemy via presetTarget.
      if (this.homingTurnRate > 0) {
        proj.homingTurnRate = this.homingTurnRate;
        proj.presetTarget = presetTarget;
      }

      const originalUpdate = proj.update.bind(proj);
      proj.update = function(enemiesArg = [], canvas = { width: 800, height: 600 }, projectilesArg = []) {
        originalUpdate(enemiesArg, canvas, projectilesArg);
        const dx = this.x - this.startX;
        const dy = this.y - this.startY;
        if (Math.hypot(dx, dy) >= this.maxDistance) this.life = 0;
      };

      if (isCrit) {
        proj.color = "#ffff00";
        proj.isCrit = true;
        proj.critText = `CRIT! ${dmg}`;
      }

      // --- Explosive Shot: blow up on expiry, damaging nearby enemies ---
      if (this.explosiveShot) {
        proj.onExpire = (projArray) => {
          const blastRadius = TILE_SIZE * 1.8;
          explodeAt(proj.x, proj.y, blastRadius, dmg * (this.explosiveShotPower || 0.4), enemies, null, this);
          visualEffects.push({ x: proj.x, y: proj.y, radius: blastRadius, life: 20, maxLife: 20, sprite: "explosionBurst" });
        };
      }

      // --- Cluster Projectile: splits into shards on hit or expiry ---
      if (this.clusterProjectile) {
        const shardCount = this.clusterShards || 5;
        const splitFn = (projArray) => {
          for (let i = 0; i < shardCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            projArray.push(new Projectile(
              proj.x, proj.y,
              Math.cos(angle) * 3, Math.sin(angle) * 3,
              Math.max(1, Math.floor(dmg * 0.4)),
              30, 1, "normal", 100, this
            ));
          }
        };
        proj.onExpire = splitFn;
        proj.onHit = (target, projArray) => { splitFn(projArray); proj.onExpire = null; };
      }

      // --- Ricochet: on hit, spawn a bounce shot toward a new random angle ---
      if (this.ricochet > 0) {
        let bouncesLeft = this.ricochet;
        const previousOnHit = proj.onHit;
        proj.onHit = (target, projArray) => {
          if (previousOnHit) previousOnHit(target, projArray);
          if (bouncesLeft > 0) {
            bouncesLeft--;
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.hypot(proj.vx, proj.vy) || 3;
            projArray.push(new Projectile(
              proj.x, proj.y,
              Math.cos(angle) * spd, Math.sin(angle) * spd,
              Math.max(1, Math.floor(dmg * 0.6)),
              40, 1, type, 150, this
            ));
          }
        };
      }

      projectiles.push(proj);
    };

    const fireVolley = () => {
      const shotCount = 1 + (this.multishot || 0);

      // Build a distance-sorted target list once per volley so multi-shot
      // volleys (archer's "Volley Tracker" style) can hand each projectile a
      // different enemy to lock onto instead of everyone dogpiling the same one.
      let targetPool = [];
      if (this.homingTurnRate > 0 && enemies.length > 0) {
        targetPool = [...enemies].sort((a, b) =>
          Math.hypot(a.px - this.px, a.py - this.py) - Math.hypot(b.px - this.px, b.py - this.py)
        );
      }
      let targetCursor = 0;
      const nextTarget = () => {
        if (targetPool.length === 0) return null;
        if (this.homingStyle === "multi") {
          const t = targetPool[targetCursor % targetPool.length];
          targetCursor++;
          return t;
        }
        return targetPool[0]; // "single" style: everyone goes for the nearest
      };

      switch (this.projectileType) {
        case "spread": {
          let baseAngle = 0;
          switch (this.dir) {
            case "up": baseAngle = -Math.PI / 2; break;
            case "down": baseAngle = Math.PI / 2; break;
            case "left": baseAngle = Math.PI; break;
            case "right": baseAngle = 0; break;
          }
          const spread = Math.PI / 12;
          const spreadOffsets = [-1, 0, 1];
          for (let i = 1; i <= shotCount - 1; i++) spreadOffsets.push(1.5 + i * 0.5, -(1.5 + i * 0.5));
          spreadOffsets.forEach(offset => {
            const angle = baseAngle + offset * spread;
            spawnProjectile(Math.cos(angle) * this.projectileSpeed, Math.sin(angle) * this.projectileSpeed, "spread", nextTarget());
          });
          break;
        }
        default: {
          let vx = 0, vy = 0;
          switch (this.dir) { case "up": vy = -this.projectileSpeed; break; case "down": vy = this.projectileSpeed; break; case "left": vx = -this.projectileSpeed; break; case "right": vx = this.projectileSpeed; break; }
          spawnProjectile(vx, vy, this.projectileType, nextTarget());

          if (shotCount > 1) {
            const baseAngle = Math.atan2(vy, vx);
            const spd = Math.hypot(vx, vy);
            const step = 0.18;
            for (let i = 1; i < shotCount; i++) {
              const off = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * step;
              const angle = baseAngle + off;
              spawnProjectile(Math.cos(angle) * spd, Math.sin(angle) * spd, this.projectileType, nextTarget());
            }
          }
        }
      }
    };

    if ((keys[" "] || this.attackHeld) && this.fireCooldown <= 0) {
      this.attacking = true;
      this.fireCooldown = Math.max(3, Math.round(this.fireCooldownMax * cooldownMult));

      fireVolley();
      if (this.rapidFire) fireVolley();
    } else { this.attacking = false; }

    if (this.fireCooldown > 0) this.fireCooldown--;

    const targetPx = this.targetX * TILE_SIZE;
    const targetPy = this.targetY * TILE_SIZE;
    if (this.px < targetPx) this.px = Math.min(this.px + this.speed, targetPx);
    if (this.px > targetPx) this.px = Math.max(this.px - this.speed, targetPx);
    if (this.py < targetPy) this.py = Math.min(this.py + this.speed, targetPy);
    if (this.py > targetPy) this.py = Math.max(this.py - this.speed, targetPy);

    this.updateAnimation(targetPx, targetPy);

    this.blinkTrail.forEach(t => t.life--);
    this.blinkTrail = this.blinkTrail.filter(t => t.life > 0);
  }

  healFromDamage(amount) {
    if (this.lifeLeech > 0) {
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

    for (let t of this.blinkTrail) {
      ctx.globalAlpha = t.alpha * (t.life / 15);
      ctx.drawImage(
        this.spriteSheet,
        sx, sy, TILE_SIZE, TILE_SIZE,
        t.x, t.y, TILE_SIZE, TILE_SIZE
      );
    }
    ctx.globalAlpha = 1;

    if (this.stoneformActive) ctx.globalAlpha = 0.6;
    ctx.drawImage(this.spriteSheet, sx, sy, TILE_SIZE, TILE_SIZE, this.px, this.py, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = 1;

    if (this.stoneformActive) {
      // Pulsing stone-gray ring - thin outline only, not a filled blob
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
      ctx.save();
      ctx.globalAlpha = 0.5 + pulse * 0.2;
      ctx.strokeStyle = "#d8d8d8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.px + TILE_SIZE / 2, this.py + TILE_SIZE / 2, TILE_SIZE * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.energyShieldMax > 0 && this.energyShield > 0) {
      // Thin cyan ring - only drawn while there's actual charge to show
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "#5fd0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.px + TILE_SIZE / 2, this.py + TILE_SIZE / 2, TILE_SIZE * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "red";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE, 4);
    ctx.fillStyle = "green";
    ctx.fillRect(this.px, this.py - 6, TILE_SIZE * (this.hp / this.maxHp), 4);

    if (this.energyShieldMax > 0) {
      ctx.fillStyle = "rgba(80,180,255,0.4)";
      ctx.fillRect(this.px, this.py - 10, TILE_SIZE * (this.energyShield / this.energyShieldMax), 3);
    }
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
    this.speed+=0.13;
    this.xpToNext=Math.floor(this.xpToNext*1.25);
  }

  takeDamage(amount){
    if(this.contactIFrames>0) return;
    if(this.stoneformActive) return; // total invulnerability while active

    // Dodge: avoid the hit entirely
    if (this.dodge > 0 && Math.random() < this.dodge) {
      if (this.lightningReflexes) this.fireCooldown = 0;
      return;
    }

    // Guardian Shield: blocks one hit completely, then needs to recharge
    if (this.guardianShieldCharges > 0) {
      this.guardianShieldCharges--;
      this.guardianShieldRecharge = this.guardianShieldRechargeMax;
      this.contactIFrames = 15;
      return;
    }

    // Energy Shield: absorbs damage before HP
    if (this.energyShield > 0) {
      const absorbed = Math.min(this.energyShield, amount);
      this.energyShield -= absorbed;
      amount -= absorbed;
      this.energyShieldCooldown = this.energyShieldCooldownMax;
      if (amount <= 0) { this.contactIFrames = 30; return; }
    }

    this.hp-=amount;
    this.contactIFrames=30;
    if(this.hp<0) this.hp=0;
  }

  unlockProjectile(type) {
    this.projectileType = type;
    if (!this.unlockedProjectiles) this.unlockedProjectiles = new Set();
    this.unlockedProjectiles.add(type);
  }

  // Applies persistent meta-progression bonuses (see meta.js) once at the
  // start of a run, on top of the freshly-reset class stats. Gold/XP
  // multipliers are stored for game.js to apply when awarding rewards
  // during the run, rather than being a stat on Player itself.
  applyMetaBonuses(bonuses) {
    if (!bonuses) return;
    this.maxHp = Math.round(this.maxHp * bonuses.hpMult);
    this.hp = this.maxHp;
    this.damage = Math.round(this.damage * bonuses.dmgMult);
    this.speed *= bonuses.speedMult;
    this.basePickupRange = (this.basePickupRange || 16) + bonuses.pickupFlat;
    this.pickupRange = this.basePickupRange;
    this.critChance = Math.min(1, this.critChance + bonuses.critFlat);
    this.gold += bonuses.startGoldFlat;
    this._metaGoldMult = bonuses.goldMult;
    this._metaXpMult = bonuses.xpMult;
  }
}