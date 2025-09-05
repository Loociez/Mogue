import { map, TILE_SIZE } from "./map.js";
import { Player } from "./player.js";
import { Projectile } from "./projectile.js";
import { rollUpgrades, applyUpgrade, rollUberUpgrades } from "./upgrades.js";
import { Enemy, spawnMiniBoss, spawnBoss } from "./enemy.js";

// === Enemies ===
let enemies = [
  new Enemy(5, 5, 0, "normal"),
  new Enemy(10, 5, 1, "brute"),
  new Enemy(15, 5, 2, "shooter"),
];

let canvas, ctx, gameWidth, gameHeight;
let animationId = null;

// ==== HUD Elements ====
const hudHp = document.getElementById("hp");
const hudXp = document.getElementById("xp");
const hudGold = document.getElementById("gold");
const hudStats = document.getElementById("stats");

// ==== Game State ====
let keys = {};
let mouse = { x: 0, y: 0 };
let projectiles = [];
let xpOrbs = [];
let damageNumbers = [];
let spawnTimer = 0;
let spawnInterval = 180;
let difficulty = 1;
let frameCount = 0;
let paused = false;
let menuActive = false;
let lastSessionStats = null;
let gameOver = false;

// Level-up / upgrades
let pendingChoices = null;

// ==== Player ====
let player;
let selectedSpriteSlot = 0;

// ==== Camera ====
let camera = {
  x: 0,
  y: 0,
  zoom: 1.5, // Adjust zoom factor
};

// ==== Input ====
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pendingChoices) paused = !paused;
  if (!menuActive) keys[e.key] = true;
});
window.addEventListener("keyup", (e) => { if (!menuActive) keys[e.key] = false; });

// ==== Spawning ====
function spawnEnemy() {
  if (!player) return;

  const minDistance = 5;
  for (let attempt = 0; attempt < 8; attempt++) {
    // Pick a random spawn edge
    const side = Math.floor(Math.random() * 4);
    let tx, ty;
    if (side === 0) { tx = 0; ty = Math.floor(Math.random() * (gameHeight / TILE_SIZE)); }
    else if (side === 1) { tx = Math.floor(gameWidth / TILE_SIZE) - 1; ty = Math.floor(Math.random() * (gameHeight / TILE_SIZE)); }
    else if (side === 2) { ty = 0; tx = Math.floor(Math.random() * (gameWidth / TILE_SIZE)); }
    else { ty = Math.floor(gameHeight / TILE_SIZE) - 1; tx = Math.floor(Math.random() * (gameWidth / TILE_SIZE)); }

    if (!map.isWalkable(tx, ty)) continue;
    if (Math.abs(tx - player.x) + Math.abs(ty - player.y) < minDistance) continue;

    // === Boss spawn (rare) ===
    if (Math.random() < 0.02 && !enemies.some(e => e.type === "boss")) {
      const bossTypes = ["mega", "storm", "berserk"];
      const type = bossTypes[Math.floor(Math.random() * bossTypes.length)];
      enemies.push(spawnBoss(tx, ty, type));
      return;
    }

    // === Mini-boss spawn (uncommon) ===
    if (Math.random() < 0.05) {
      const miniTypes = ["classic", "rain", "tracking"];
      const type = miniTypes[Math.floor(Math.random() * miniTypes.length)];
      enemies.push(spawnMiniBoss(tx, ty, type));
      return;
    }

    // === Normal enemy spawn ===
    let type = "normal";
    let spriteIndex = 0;
    const rand = Math.random();
    if (rand < 0.1) { type = "brute"; spriteIndex = 1; }
    else if (rand < 0.2) { type = "shooter"; spriteIndex = 2; }
    else if (rand < 0.3) { type = "fast"; spriteIndex = 3; }
    else if (rand < 0.4) { type = "tank"; spriteIndex = 4; }
    else if (rand < 0.5) { type = "spitter"; spriteIndex = 5; }
    else if (rand < 0.6) { type = "bossling"; spriteIndex = 6; }
    else if (rand < 0.7) { type = "assassin"; spriteIndex = 7; }
    else if (rand < 0.8) { type = "wizard"; spriteIndex = 8; }
    else if (rand < 0.9) { type = "golem"; spriteIndex = 9; }
    else { type = "archer"; spriteIndex = 10; }

    const e = new Enemy(tx, ty, spriteIndex, type);

    // Set stats based on type & difficulty
    switch (type) {
      case "brute": e.maxHp = 120 + 30*difficulty; e.hp = e.maxHp; e.touchDamage = 12 + 3*difficulty; e.speed = 0.8; break;
      case "shooter": e.maxHp = 80 + 25*difficulty; e.hp = e.maxHp; e.touchDamage = 6 + 2*difficulty; e.speed = 0.9; e.projectileSpeed=3; e.fireCooldownMax=120; e.fireCooldown=e.fireCooldownMax; break;
      case "fast": e.maxHp = 40 + 10*difficulty; e.hp = e.maxHp; e.touchDamage = 4 + difficulty; e.speed = 1.8; break;
      case "tank": e.maxHp = 150 + 50*difficulty; e.hp = e.maxHp; e.touchDamage = 10 + 2*difficulty; e.speed = 0.6; break;
      case "spitter": e.maxHp = 60 + 20*difficulty; e.hp = e.maxHp; e.touchDamage = 3 + difficulty; e.speed = 1.0; e.projectileSpeed=2.5; e.fireCooldownMax=90; e.fireCooldown=e.fireCooldownMax; break;
      case "bossling": e.maxHp = 200 + 50*difficulty; e.hp = e.maxHp; e.touchDamage = 15 + 4*difficulty; e.speed = 1.0; e.projectileSpeed=3; e.fireCooldownMax=100; e.fireCooldown=e.fireCooldownMax; break;
      case "assassin": e.maxHp = 50 + 15*difficulty; e.hp = e.maxHp; e.touchDamage = 8 + 2*difficulty; e.speed = 2.0; break;
      case "wizard": e.maxHp = 40 + 10*difficulty; e.hp = e.maxHp; e.touchDamage = 6 + 2*difficulty; e.speed = 1.2; e.projectileSpeed=3.5; e.fireCooldownMax=90; e.fireCooldown=e.fireCooldownMax; break;
      case "golem": e.maxHp = 180 + 60*difficulty; e.hp = e.maxHp; e.touchDamage = 14 + 4*difficulty; e.speed = 0.5; break;
      case "archer": e.maxHp = 70 + 20*difficulty; e.hp = e.maxHp; e.touchDamage = 5 + 1.5*difficulty; e.speed = 1.0; e.projectileSpeed=2.8; e.fireCooldownMax=100; e.fireCooldown=e.fireCooldownMax; break;
      default: e.maxHp = 50 + 15*difficulty; e.hp = e.maxHp; e.touchDamage = 5 + 1.5*difficulty; e.speed = 1.0;
    }

    e.entryDelay = 30;
    enemies.push(e);
    return;
  }
}


// ==== Initialization ====
function init() {
  canvas = document.getElementById("gameCanvas");
  ctx = canvas.getContext("2d");
  gameWidth = canvas.width;
  gameHeight = canvas.height;

  map.load("maps/map.json").then(() => showCharacterSelection());

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener("click", () => { if (gameOver) showCharacterSelection(); });
}

// ==== Character Selection ====
function showCharacterSelection() {
  paused = true;
  menuActive = true;
  const selectionUI = document.getElementById("characterSelect");
  selectionUI.style.display = "block";
  selectionUI.innerHTML = "";

  const characters = [
    { type: "warrior", name: "Warrior", desc: "High HP & damage" },
    { type: "archer", name: "Archer", desc: "Fires spread projectiles" },
    { type: "mage", name: "Mage", desc: "Fires homing projectiles" },
  ];

  const slotLabel = document.createElement("label");
  slotLabel.textContent = "Select Sprite Slot: ";
  const slotSelect = document.createElement("select");
  slotSelect.id = "spriteSlotSelect";
  for (let i = 0; i < 32; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Slot ${i}`;
    slotSelect.appendChild(opt);
  }
  slotSelect.addEventListener("change", () => { selectedSpriteSlot = parseInt(slotSelect.value); });
  selectionUI.appendChild(slotLabel);
  selectionUI.appendChild(slotSelect);
  selectionUI.appendChild(document.createElement("br"));

  characters.forEach((c) => {
    const btn = document.createElement("button");
    btn.textContent = `${c.name} - ${c.desc}`;
    btn.onclick = () => selectCharacter(c.type);
    selectionUI.appendChild(btn);
  });
}

// ==== Player Selection / Start ====
function selectCharacter(type) {
  const [px, py] = findValidSpawn(11, 10);
  player = new Player(type, selectedSpriteSlot);
  player.reset(px, py);

  document.getElementById("characterSelect").style.display = "none";
  paused = false;
  menuActive = false;

  enemies = [];
  projectiles = [];
  xpOrbs = [];
  damageNumbers = [];
  spawnTimer = 0;
  spawnInterval = 180;
  difficulty = 1;
  frameCount = 0;
  pendingChoices = null;
  gameOver = false;

  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

// ==== Upgrade UI ====
function showUpgradeMenu(choices) {
  const ui = document.getElementById("upgradeUI");
  const container = document.getElementById("upgradeButtons");
  container.innerHTML = "";
  choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.textContent = `${choice.name}: ${choice.desc}`;
    btn.onclick = () => applyChoice(choice);
    container.appendChild(btn);
  });
  ui.style.display = "block";
  menuActive = true;
  paused = true;
}

function hideUpgradeMenu() { 
  document.getElementById("upgradeUI").style.display = "none"; 
  menuActive = false;
  paused = false;
}

function onLevelUp() {
  pendingChoices = (player.level % 10 === 0) ? rollUberUpgrades(player) : rollUpgrades(player);
  showUpgradeMenu(pendingChoices);
}

function applyChoice(choice) {
  if (choice.apply) choice.apply(player);
  else applyUpgrade(player, choice);

  pendingChoices = null; 
  hideUpgradeMenu();
}

// ==== Game Loop ====
function gameLoop() {
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

// ==== Update ====
function update() {
  if (paused || gameOver) return;

  frameCount++;
  map.updateAnimation();
  if (frameCount % 300 === 0) { difficulty += 0.5; spawnInterval = Math.max(40, spawnInterval - 2); }

  if (!menuActive && player.hp > 0) player.update(projectiles, enemies);

  spawnTimer++;
  if (spawnTimer >= spawnInterval) { spawnTimer = 0; spawnEnemy(); }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.entryDelay > 0) { e.entryDelay--; continue; }
    e.update(player, frameCount, projectiles);
    map.applyTileEffects(e, Math.floor(e.px / TILE_SIZE), Math.floor(e.py / TILE_SIZE));

    const shooterTypes = ["shooter", "spitter", "wizard", "archer", "bossling"];
    if (shooterTypes.includes(e.type) && e.fireCooldown <= 0) {
      const dx = (player.px + TILE_SIZE/2) - (e.px + TILE_SIZE/2);
      const dy = (player.py + TILE_SIZE/2) - (e.py + TILE_SIZE/2);
      const dist = Math.hypot(dx, dy);
      const speed = e.projectileSpeed || 3;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;

      let projType = "normal";
      let maxRange = 150; // default distance
      switch(e.type) {
        case "spitter": projType = "bouncing"; maxRange=120; break;
        case "wizard": projType = "homing"; maxRange=180; break;
        case "archer": projType = "spread"; maxRange=200; break;
        case "bossling": projType = "heavy"; maxRange=250; break;
      }

      // Initialize pierce as 1 for enemy projectiles, add maxDistance
      projectiles.push(new Projectile(e.px + TILE_SIZE/2, e.py + TILE_SIZE/2, vx, vy, e.touchDamage*0.8, 60, 1, projType, maxRange));
      e.fireCooldown = e.fireCooldownMax;
    }
    if (e.fireCooldown > 0) e.fireCooldown--;

    if (e.hp <= 0) {
      const goldDrop = e.isMiniBoss ? Math.floor(50 + difficulty*5) : Math.floor(5 + difficulty*2);
      const xpDrop = e.isMiniBoss ? 10 + Math.floor(difficulty/2) : 1 + Math.floor(difficulty/2);
      xpOrbs.push({ x: e.px+TILE_SIZE/2, y: e.py+TILE_SIZE/2, r:4, value: xpDrop });
      player.gold += goldDrop;
      enemies.splice(i,1);
    }
  }

    // ==== Projectile Update with Pierce & Distance ====
for (let i = projectiles.length - 1; i >= 0; i--) {
  const p = projectiles[i];

  if (!(p instanceof Projectile)) {
    projectiles.splice(i, 1);
    continue;
  }

  p.update(enemies);

  // Distance check
  const dx = p.x - (p.startX ?? p.x);
  const dy = p.y - (p.startY ?? p.y);
  if (p.maxDistance && Math.hypot(dx, dy) >= p.maxDistance) {
    projectiles.splice(i, 1);
    continue;
  }

  // === Player projectiles ===
  if (p.owner === player) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (circleRectOverlap(p.x, p.y, p.radius, e.px, e.py, TILE_SIZE, TILE_SIZE)) {
        let dmg = p.damage * 1.5;
        const isCrit = Math.random() < player.critChance;
        if (isCrit) dmg *= 2;
        e.hp -= dmg;

        damageNumbers.push({
          x: e.px + TILE_SIZE / 2,
          y: e.py,
          value: Math.floor(dmg),
          life: 30,
          color: isCrit ? "#ff0" : "#fff",
          font: isCrit ? "bold 18px sans-serif" : "16px sans-serif",
          crit: isCrit
        });

        e.flashTimer = 5;

        p.pierce--;
        if (p.pierce <= 0) break;
      }
    }
  }

  // === Enemy projectiles ===
  else {
    if (
      p.owner !== player && // don’t hit their shooter
      circleRectOverlap(p.x, p.y, p.radius, player.px, player.py, TILE_SIZE, TILE_SIZE)
    ) {
      player.takeDamage(p.damage);
      projectiles.splice(i, 1);
      continue;
    }
  }

  // Remove projectile if life ended or pierce used up
  if (p.life <= 0 || p.pierce <= 0) {
    projectiles.splice(i, 1);
  }
}


  // XP pickup
  for (let i = xpOrbs.length-1; i>=0; i--) {
    const orb = xpOrbs[i];
    const dx = (player.px + TILE_SIZE/2) - orb.x;
    const dy = (player.py + TILE_SIZE/2) - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRange) { orb.x += dx/Math.max(d,1)*3; orb.y += dy/Math.max(d,1)*3; }
    if (d < 8) { player.gainXp(orb.value, onLevelUp); player.gold+=orb.value; xpOrbs.splice(i,1); }
  }

  // Damage numbers
  for (let i=damageNumbers.length-1; i>=0; i--) {
    const d = damageNumbers[i];
    d.y -= 0.5;
    d.life--;
    if (d.life<=0) damageNumbers.splice(i,1);
  }

  if (player.hp <= 0 && !gameOver) {
    gameOver = true;
    lastSessionStats = {
      level: player.level,
      gold: player.gold,
      time: Math.floor(frameCount / 60),
    };
	// Show the HTML overlay
  document.getElementById("deathOverlay").style.display = "block";
  }

  // ==== CAMERA UPDATE ====
  if (player) {
    camera.x = player.px + TILE_SIZE/2 - gameWidth/(2*camera.zoom);
    camera.y = player.py + TILE_SIZE/2 - gameHeight/(2*camera.zoom);
    camera.x = Math.max(0, Math.min(camera.x, map.width*TILE_SIZE - gameWidth/camera.zoom));
    camera.y = Math.max(0, Math.min(camera.y, map.height*TILE_SIZE - gameHeight/camera.zoom));
  }

  updateHUD();
}


// ==== Draw ====
function draw() {
  ctx.clearRect(0,0,gameWidth,gameHeight);

  let shakeX=0, shakeY=0, flashAlpha=0;
  if (player.contactIFrames>0) {
    const ratio = player.contactIFrames/30;
    const maxShake=6;
    shakeX=(Math.random()-0.5)*maxShake*ratio;
    shakeY=(Math.random()-0.5)*maxShake*ratio;
    flashAlpha = 0.3*ratio;
  }

  // ==== APPLY CAMERA & SHAKE ====
  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // ==== MAP ====
  map.draw(ctx);

  // XP orbs
  ctx.save();
  for (const orb of xpOrbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI*2);
    ctx.fillStyle="#3cf";
    ctx.fill();
  }
  ctx.restore();

  // Enemies
  enemies.forEach(e => {
    if (e.isMiniBoss && Array.isArray(e.rainTelegraph) && e.rainTelegraph.length > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
      e.rainTelegraph.forEach(t => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.restore();
    }
    e.draw(ctx);
  });

  // Player
  if (player) player.draw(ctx);

  // Floating damage numbers
  ctx.save();
  for (const d of damageNumbers) {
    ctx.fillStyle = d.color || "#fff";
    ctx.font = d.font || "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.value, d.x, d.y);
    if (d.crit) {
      ctx.fillStyle = "#ff0";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("Crit!", d.x, d.y - 16); 
    }
    d.x += d.dx||0; d.y += d.dy||0;
  }
  ctx.restore();

 // Projectiles
ctx.save();
for (const p of projectiles) {
  if (p instanceof Projectile) {
    p.draw(ctx); // let the Projectile class handle colors
  }
}
ctx.restore();


  if (flashAlpha>0) {
    ctx.fillStyle = `rgba(255,0,0,${flashAlpha})`;
    ctx.fillRect(0,0,gameWidth,gameHeight);
  }

  ctx.restore(); // restore camera & shake

  if (gameOver) {
  // Show the HTML overlay instead of drawing on canvas
  document.getElementById("deathOverlay").style.display = "block";
} else if (paused && !menuActive) {
  drawPauseScreen();
}

}

function drawPauseScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  ctx.fillStyle = "#fff";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Paused", gameWidth / 2, gameHeight / 2 - 40);

  ctx.font = "18px sans-serif";
  ctx.fillText(
    `Current Run: Lv ${player.level}, Gold ${player.gold}, Time ${(frameCount/60).toFixed(1)}s`,
    gameWidth / 2,
    gameHeight / 2
  );

  if (lastSessionStats) {
    ctx.fillText(
      `Last Run: Lv ${lastSessionStats.level}, Gold ${lastSessionStats.gold}, Time ${lastSessionStats.time}s`,
      gameWidth / 2,
      gameHeight / 2 + 30
    );
  }
}

// ==== HUD ====
function updateHUD() {
  if (!player) return;
  hudHp.textContent = `HP: ${Math.ceil(player.hp)} / ${player.maxHp}`;
  hudXp.textContent = `Lv ${player.level} | XP: ${player.xp} / ${player.xpToNext}`;
  hudGold.textContent = `Gold: ${player.gold}`;
  hudStats.textContent = `DMG ${player.damage} | ROF ${(60/player.fireCooldownMax).toFixed(1)}/s | SPD ${player.speed.toFixed(1)}`;
}



// ==== Helpers ====
function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx+rw));
  const ny = Math.max(ry, Math.min(cy, ry+rh));
  const dx = cx-nx, dy = cy-ny;
  return dx*dx+dy*dy <= r*r;
}

function findValidSpawn(startX, startY) {
  if (!map) return [startX, startY];
  if (map.isWalkable(startX, startY)) return [startX, startY];
  for (let r = 1; r <= 10; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const nx = startX + dx, ny = startY + dy;
        if (map.isWalkable(nx, ny)) return [nx, ny];
      }
  return [startX, startY];
}

window.addEventListener("load", init);
