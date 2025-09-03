import { TILE_SIZE, map } from "./map.js";
import { Projectile } from "./projectile.js";

export class Player {
  constructor(characterType = "warrior", spriteSlot = 0) {
    this.characterType = characterType;
    this.spriteSlot = spriteSlot; // 0-31
    this.setCharacter(characterType, spriteSlot);

    // Position
    this.x = Math.floor(map.width / 2);
    this.y = Math.floor(map.height / 2);
    this.px = this.x * TILE_SIZE;
    this.py = this.y * TILE_SIZE;
    this.targetX = this.x;
    this.targetY = this.y;

    // Movement
    this.speed = this.baseSpeed;
    this.dir = "down";
    this.lastDir = null;
    this.dirPressTime = 0;
    this.inputQueue = [];
    this.queueIndex = 0;

    // Combat
    this.maxHp = this.baseHp;
    this.hp = this.maxHp;
    this.damage = this.baseDamage;
    this.projectileType = "normal";
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
    this.frame = 0;
    this.frameTicker = 0;
    this.frameSpeed = 5;

    // Misc
    this.contactIFrames = 0;
    this.pickupRange = 16;

    // Input state
    this.inputKeys = {};
    this.attackPressed = false;

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
      case "warrior": this.baseDamage=18; this.baseSpeed=4; this.baseHp=120; this.projectileType="normal"; break;
      case "archer": this.baseDamage=12; this.baseSpeed=4.5; this.baseHp=100; this.projectileType="spread"; break;
      case "mage": this.baseDamage=10; this.baseSpeed=4; this.baseHp=90; this.projectileType="homing"; break;
      default: this.baseDamage=15; this.baseSpeed=4; this.baseHp=100; this.projectileType="normal";
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

  reset(x = this.x, y = this.y) {
    this.x = x; this.y = y;
    this.targetX = x; this.targetY = y;
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
    if(this.contactIFrames>0) this.contactIFrames--;

    const keys = this.inputKeys;
    let direction = null;
    if(keys["arrowup"] || keys["w"]) direction="up";
    else if(keys["arrowdown"] || keys["s"]) direction="down";
    else if(keys["arrowleft"] || keys["a"]) direction="left";
    else if(keys["arrowright"] || keys["d"]) direction="right";

    if(direction){ this.inputQueue=[direction]; this.queueIndex=0; } else { this.inputQueue=[]; this.queueIndex=0; }

    if(this.inputQueue.length>0){
      const currentDir = this.inputQueue[0];
      if(this.lastDir!==currentDir){ this.lastDir=currentDir; this.dirPressTime=now; }
      this.dir=currentDir;

      if(!this.attacking && this.px===this.targetX*TILE_SIZE && this.py===this.targetY*TILE_SIZE && now-this.dirPressTime>100){
        let nx=this.x, ny=this.y;
        switch(currentDir){ case "up": ny--; break; case "down": ny++; break; case "left": nx--; break; case "right": nx++; break; }
        if(map.isWalkable(nx, ny)){
          this.targetX=nx; this.targetY=ny;
          this.x=nx; this.y=ny;
          map.applyTileEffects?.(this,nx,ny);
        }
      }
    } else { this.lastDir=null; }

    // --- Attack ---
    if((keys[" "]||this.attackPressed) && this.fireCooldown<=0){
      this.attacking=true;
      this.fireCooldown=this.fireCooldownMax;

      const spawnProjectile = (vx,vy,type=this.projectileType)=>{
        projectiles.push(new Projectile(this.px+TILE_SIZE/2, this.py+TILE_SIZE/2, vx, vy, this.damage, this.projectileLife, this.pierce, type));
      };

      switch(this.projectileType){
        case "spread":
          [-0.2,0,0.2].forEach(a=>{
            const speed=this.projectileSpeed;
            let vx=0, vy=0;
            switch(this.dir){ case "up": vy=-speed; break; case "down": vy=speed; break; case "left": vx=-speed; break; case "right": vx=speed; break; }
            spawnProjectile(vx,vy,"spread");
          });
          break;
        default:
          let vx=0, vy=0;
          switch(this.dir){ case "up": vy=-this.projectileSpeed; break; case "down": vy=this.projectileSpeed; break; case "left": vx=-this.projectileSpeed; break; case "right": vx=this.projectileSpeed; break; }
          spawnProjectile(vx,vy,this.projectileType);
      }

      this.attackPressed=false;
    } else { this.attacking=false; }

    if(this.fireCooldown>0) this.fireCooldown--;

    const targetPx=this.targetX*TILE_SIZE;
    const targetPy=this.targetY*TILE_SIZE;
    if(this.px<targetPx) this.px=Math.min(this.px+this.speed,targetPx);
    if(this.px>targetPx) this.px=Math.max(this.px-this.speed,targetPx);
    if(this.py<targetPy) this.py=Math.min(this.py+this.speed,targetPy);
    if(this.py>targetPy) this.py=Math.max(this.py-this.speed,targetPy);

    // Animate
    this.updateAnimation(targetPx,targetPy);
  }

  updateAnimation(targetPx,targetPy){
    const moving = this.px!==targetPx || this.py!==targetPy;

    // Each character has 12 frames: 3 frames per action per direction
    // Direction offsets: up=0, down=3, left=6, right=9
    const dirOffsetMap = { "up":0, "down":3, "left":6, "right":9 };
    const dirOffset = dirOffsetMap[this.dir] || 0;

    let startFrame = 0;
    let frameCount = 3;

    if(this.attacking){
      startFrame = dirOffset + 2;  // attack frames in each 3-frame block
      frameCount = 1; // or 3 if attack animation has multiple frames
    } else if(moving){
      startFrame = dirOffset + 1;  // walk frames
      frameCount = 1; 
    } else {
      startFrame = dirOffset + 0;  // idle frames
      frameCount = 1;
    }

    // Frame cycling
    this.frameTicker++;
    if(this.frameTicker>=this.frameSpeed){
      this.frame = startFrame + ((this.frame - startFrame + 1) % frameCount);
      this.frameTicker=0;
    }

    // currentAnim = row index = spriteSlot
    this.currentAnim = this.spriteSlot;
  }

  draw(ctx){
    if(!this.spriteSheet.complete){
      ctx.fillStyle="blue";
      ctx.fillRect(this.px,this.py,TILE_SIZE,TILE_SIZE);
      return;
    }

    const sx=this.frame*TILE_SIZE;
    const sy=this.currentAnim*TILE_SIZE;

    ctx.drawImage(this.spriteSheet,sx,sy,TILE_SIZE,TILE_SIZE,this.px,this.py,TILE_SIZE,TILE_SIZE);

    // Health bar
    ctx.fillStyle="red";
    ctx.fillRect(this.px,this.py-6,TILE_SIZE,4);
    ctx.fillStyle="green";
    ctx.fillRect(this.px,this.py-6,TILE_SIZE*(this.hp/this.maxHp),4);
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
}
