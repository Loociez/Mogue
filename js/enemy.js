import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";

// A* pathfinding helper
function findPath(startX, startY, endX, endY, map, avoidTile = true) {
  const openSet = [{
    x: startX, y: startY, g: 0,
    h: Math.abs(endX - startX) + Math.abs(endY - startY),
    f: 0, parent: null
  }];
  const closedSet = new Set();
  const hash = (x, y) => `${x},${y}`;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();

    if ((avoidTile && Math.abs(current.x - endX) + Math.abs(current.y - endY) === 1) ||
        (!avoidTile && current.x === endX && current.y === endY)) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closedSet.add(hash(current.x, current.y));

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (!map.isWalkable(nx, ny)) continue;
      if (closedSet.has(hash(nx, ny))) continue;

      const g = current.g + 1;
      const h = Math.abs(nx - endX) + Math.abs(ny - endY);
      const f = g + h;

      if (!openSet.some(n => n.x===nx && n.y===ny && n.g<=g)) {
        openSet.push({ x: nx, y: ny, g, h, f, parent: current });
      }
    }
  }
  return [];
}

export class Enemy {
  constructor(x, y, spriteIndex=0, type="normal") {
    this.type = type;
    this.x = x; this.y = y;
    this.px = x*TILE_SIZE; this.py = y*TILE_SIZE;
    this.speed = 1; this.size = TILE_SIZE;
    this.hp = 25; this.maxHp = 25; this.touchDamage = 6;

    this.spriteSheet = new Image();
    this.spriteSheet.src = "assets/enemy.png";

    this.spriteIndex = spriteIndex;
    this.dir = "down"; this.frame = 0;
    this.frameTicker = 0; this.frameSpeed = 10;

    this.spriteFrameMap = {
      up: [0,1,2], down: [3,4,5],
      left: [6,7,8], right: [9,10,11]
    };

    this.attacking = false;
    this.attackCooldown = 0;

    this.path = [];
    this.pathUpdateTicker = 0;

    this.flashTimer = 0;

    this.isMiniBoss = false;
    this.specialCooldown = 0;
    this.specialCooldownMax = 300;
    this.specialType = "classic";
    this.telegraph = null;
    this.rainTelegraph = [];

    // Shooter/boss properties
    this.fireProjectile = false;
    this.fireCooldownMax = 0;
    this.fireCooldown = 0;
    this.projectileSpeed = 0;
    this.projectileDamageMultiplier = 1;
    this.projectileRange = 0;
    this.projectileType = "heavy";
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 5;
  }

  update(player, frameCount, projectiles=[]) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distance = Math.abs(dx) + Math.abs(dy);

    // ==== MELEE ATTACK ====
    if (distance === 1 && this.attackCooldown <= 0) {
      player.takeDamage(this.touchDamage);
      this.attackCooldown = 30;
      this.attacking = true;
    } else this.attacking = false;

    if (this.attackCooldown > 0) this.attackCooldown--;

    // ==== PATHFINDING ====
    this.pathUpdateTicker++;
    if (this.pathUpdateTicker >= 10 || !this.path || this.path.length===0) {
      this.path = findPath(this.x, this.y, player.x, player.y, map, true);
      this.pathUpdateTicker = 0;
    }

    if (this.path && this.path.length>1) {
      const nextTile = this.path[1];
      const tx = nextTile.x*TILE_SIZE;
      const ty = nextTile.y*TILE_SIZE;

      if (nextTile.x > this.x) this.dir = "right";
      else if (nextTile.x < this.x) this.dir = "left";
      else if (nextTile.y > this.y) this.dir = "down";
      else if (nextTile.y < this.y) this.dir = "up";

      const dist = Math.hypot(tx-this.px, ty-this.py);
      if (dist>0) {
        const step = Math.min(this.speed, dist);
        this.px += ((tx-this.px)/dist)*step;
        this.py += ((ty-this.py)/dist)*step;
      }

      if (Math.abs(this.px-tx)<0.1 && Math.abs(this.py-ty)<0.1) {
        this.x = nextTile.x;
        this.y = nextTile.y;
        map.applyTileEffects?.(this, this.x, this.y);
        this.path.shift();
      }
    }

    // ==== ANIMATION ====
    if (this.path && this.path.length>0) {
      this.frameTicker++;
      if (this.frameTicker>=this.frameSpeed) {
        this.frame = (this.frame+1)%2;
        this.frameTicker=0;
      }
    } else this.frame=0;

    if (this.flashTimer>0) this.flashTimer--;

    // ==== MINI-BOSS SPECIALS ====
if (this.isMiniBoss) {
  this.specialCooldown--;
  if (this.specialCooldown<=0) {
    this.specialCooldown = this.specialCooldownMax;
    const spawnProj = (vx, vy, type="normal", damageMult=1) => {
      // Offset spawn position so it doesn’t overlap the enemy
      const ox = vx !== 0 ? Math.sign(vx) * 10 : 0;
      const oy = vy !== 0 ? Math.sign(vy) * 10 : 0;
      projectiles.push(new Projectile(
        this.px + TILE_SIZE/2 + ox,
        this.py + TILE_SIZE/2 + oy,
        vx, vy,
        this.touchDamage*damageMult,
        90, 1, type, 300, this
      ));
    };

    switch(this.specialType) {
      case "classic":
        const speed = 3;
        [[speed,0],[-speed,0],[0,speed],[0,-speed]].forEach(([vx,vy])=>spawnProj(vx,vy));
        break;

      case "rain":
        if (this.rainTelegraph.length===0) {
          for (let i=0;i<5;i++) {
            const offsetX=(Math.random()-0.5)*TILE_SIZE*3;
            const x=player.px+offsetX;
            const y=player.py-TILE_SIZE*(i+1);
            this.rainTelegraph.push({x,y,countdown:60,active:false});
          }
        }
        for (let i=this.rainTelegraph.length-1;i>=0;i--) {
          const t=this.rainTelegraph[i];
          t.countdown--;
          if(!t.active && t.countdown<=0) t.active=true;
          if(t.active){
            projectiles.push(new Projectile(
              t.x, t.y, 0, 4,
              this.touchDamage*0.8, 120, 1, "rain", 300, this
            ));
            this.rainTelegraph.splice(i,1);
          }
        }
        break;

      case "tracking":
        if(!this.telegraph) this.telegraph={x:player.px, y:player.py, countdown:60};
        else {
          this.telegraph.countdown--;
          if(this.telegraph.countdown<=0){
            const dx=this.telegraph.x-this.px;
            const dy=this.telegraph.y-this.py;
            const dist=Math.hypot(dx,dy)||1; // avoid NaN
            const speed=5;
            spawnProj((dx/dist)*speed,(dy/dist)*speed,"homing",1.5);
            this.telegraph=null;
          }
        }
        break;
    }
  }
}

// ==== SHOOTER/BOSS PROJECTILES ====
if(this.fireProjectile){
  if(this.fireCooldown <= 0){
    const px = player.px + TILE_SIZE/2;
    const py = player.py + TILE_SIZE/2;
    const ex = this.px + TILE_SIZE/2;
    const ey = this.py + TILE_SIZE/2;
    const dx = px - ex;
    const dy = py - ey;
    const dist = Math.hypot(dx, dy) || 1; // safeguard against zero

    if(dist >= TILE_SIZE){
      const vx = (dx/dist) * this.projectileSpeed;
      const vy = (dy/dist) * this.projectileSpeed;

      // Offset spawn point slightly forward
      const ox = (dx/dist) * 10;
      const oy = (dy/dist) * 10;

      projectiles.push(new Projectile(
        ex + ox, ey + oy, vx, vy,
        this.touchDamage*this.projectileDamageMultiplier,
        90, 1, this.projectileType, this.projectileRange, this
      ));
      this.fireCooldown = this.fireCooldownMax;
    }
  } else this.fireCooldown--;
}

  }

  draw(ctx) {
    if (!this.spriteSheet.complete || this.spriteSheet.naturalWidth===0){
      ctx.fillStyle=this.flashTimer>0?"#ff5555":"red";
      ctx.fillRect(this.px,this.py,TILE_SIZE,TILE_SIZE);
      return;
    }

    const frames=this.spriteFrameMap[this.dir];
    const animFrame=frames[this.frame];
    const tilesPerRow=1024/TILE_SIZE;
    const baseFrame=8+(this.spriteIndex*12);
    const actualFrame=baseFrame+animFrame;
    const sx=(actualFrame%tilesPerRow)*TILE_SIZE;
    const sy=Math.floor(actualFrame/tilesPerRow)*TILE_SIZE;

    if(this.flashTimer>0) ctx.globalAlpha=0.5;
    ctx.drawImage(this.spriteSheet,sx,sy,TILE_SIZE,TILE_SIZE,this.px,this.py,TILE_SIZE,TILE_SIZE);
    if(this.flashTimer>0) ctx.globalAlpha=1;

    ctx.fillStyle="red";
    ctx.fillRect(this.px,this.py-6,TILE_SIZE,4);
    ctx.fillStyle="green";
    ctx.fillRect(this.px,this.py-6,TILE_SIZE*(this.hp/this.maxHp),4);

    if(this.isMiniBoss){
      ctx.fillStyle="yellow";
      ctx.font="bold 12px Arial";
      ctx.textAlign="center";
      ctx.fillText("MINI-BOSS",this.px+TILE_SIZE/2,this.py-10);
      ctx.textAlign="left";
    }

    if(this.type==="boss"){
      ctx.fillStyle="purple";
      ctx.font="bold 14px Arial";
      ctx.textAlign="center";
      ctx.fillText("BOSS",this.px+TILE_SIZE/2,this.py-10);
      ctx.textAlign="left";
    }
  }
}

// === Mini-boss spawner ===
export function spawnMiniBoss(x, y, type="classic"){
  const mb = new Enemy(x, y, 3, "mini-boss");
  mb.isMiniBoss = true;
  mb.maxHp = 500; mb.hp = mb.maxHp;
  mb.touchDamage = 20; mb.speed = 0.7;
  mb.specialCooldownMax = 120;
  mb.specialCooldown = mb.specialCooldownMax;
  mb.specialType = type;
  mb.rainTelegraph = [];
  return mb;
}

// === Boss spawner ===
export function spawnBoss(x, y, type="mega"){
  const boss = new Enemy(x, y, 4, "boss");
  boss.isMiniBoss = false;
  boss.maxHp = 2000; boss.hp = boss.maxHp;
  boss.touchDamage = 50; boss.speed = 0.5;

  // Boss shooting properties
  boss.fireProjectile = true;
  boss.fireCooldownMax = 80;
  boss.fireCooldown = 0;
  boss.projectileSpeed = 4;
  boss.projectileDamageMultiplier = 1.5;
  boss.projectileRange = 300;
  boss.projectileType = "boss-burst";

  boss.specialType = type;

  return boss;
}
