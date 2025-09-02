import { map, TILE_SIZE } from "./map.js";
import { Player } from "./player.js";
import { Projectile } from "./projectile.js";
import { rollUpgrades, applyUpgrade, rollUberUpgrades } from "./upgrades.js";
import { Enemy } from "./enemy.js";

// Create some enemies
let enemies = [
  new Enemy(5, 5, 0, "normal"),   // frames 8–19
  new Enemy(10, 5, 1, "brute"),   // frames 20–31
  new Enemy(15, 5, 2, "shooter"), // frames 32–43
];


let canvas, ctx, gameWidth, gameHeight;

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
let spawnTimer = 0;
let spawnInterval = 180;
let difficulty = 1;
let frameCount = 0;
let paused = false;
let gameOver = false;

// Level-up / upgrades
let pendingChoices = null;

// Player
const player = new Player(1, 1);
player.maxHp = 100;
player.hp = player.maxHp;

// ==== Input ====
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pendingChoices) paused = !paused;
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => keys[e.key] = false);

// ==== Spawning ====
function spawnEnemy() {
  const minDistance = 5; // tiles
  for (let i = 0; i < 8; i++) {
    const side = Math.floor(Math.random() * 4);
    let tx, ty;
    if (side === 0) { tx = 0; ty = Math.floor(Math.random() * (gameHeight / TILE_SIZE)); }
    else if (side === 1) { tx = Math.floor(gameWidth / TILE_SIZE) - 1; ty = Math.floor(Math.random() * (gameHeight / TILE_SIZE)); }
    else if (side === 2) { ty = 0; tx = Math.floor(Math.random() * (gameWidth / TILE_SIZE)); }
    else { ty = Math.floor(gameHeight / TILE_SIZE) - 1; tx = Math.floor(Math.random() * (gameWidth / TILE_SIZE)); }

    const distX = Math.abs(tx - player.x);
    const distY = Math.abs(ty - player.y);
    if (!map.isWalkable(tx, ty) || (distX + distY) < minDistance) continue;

    let type = "normal";
    let spriteIndex = 0;
    const rand = Math.random();
    if (rand < 0.15) {
      type = "brute";
      spriteIndex = 1; // frames 20–31
    } else if (rand < 0.30) {
      type = "shooter";
      spriteIndex = 2; // frames 32–43
    } else {
      type = "normal";
      spriteIndex = 0; // frames 8–19
    }

    const e = new Enemy(tx, ty, spriteIndex, type);

    switch(type){
      case "brute":
        e.maxHp = Math.round(120 + 30 * difficulty);
        e.hp = e.maxHp;
        e.touchDamage = Math.round(12 + 3 * difficulty);
        e.speed = 0.8;
        break;
      case "shooter":
        e.maxHp = Math.round(80 + 25 * difficulty);
        e.hp = e.maxHp;
        e.touchDamage = Math.round(6 + 2 * difficulty);
        e.speed = 0.9;
        e.projectileSpeed = 3;
        e.fireCooldownMax = 120;
        e.fireCooldown = e.fireCooldownMax;
        break;
      default: // normal
        e.maxHp = Math.round(50 + 15 * difficulty);
        e.hp = e.maxHp;
        e.touchDamage = Math.round(5 + 1.5 * difficulty);
        e.speed = Math.min(1.2 + 0.05 * difficulty, 2.5);
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

  map.load("maps/map.json").then(() => requestAnimationFrame(gameLoop));

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener("click", (e) => {
    if (gameOver) restartGame();
  });
}

// ==== Upgrade UI ====
function showUpgradeMenu(choices) {
  const ui = document.getElementById("upgradeUI");
  const container = document.getElementById("upgradeButtons");
  container.innerHTML = "";
  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = `${choice.name}: ${choice.desc}`;
    btn.onclick = () => applyChoice(choice);
    container.appendChild(btn);
  });
  ui.style.display = "block";
}

function hideUpgradeMenu() {
  const ui = document.getElementById("upgradeUI");
  ui.style.display = "none";
}

// ==== Level Up ====
function onLevelUp() {
  paused = true;
  if (player.level % 10 === 0) pendingChoices = rollUberUpgrades(player);
  else pendingChoices = rollUpgrades(player);
  showUpgradeMenu(pendingChoices);
}

function applyChoice(choice) {
  if (choice.apply) choice.apply(player);
  else applyUpgrade(player, choice);
  pendingChoices = null;
  hideUpgradeMenu();
  paused = false;
}

// ==== Restart ====
function restartGame() {
  enemies = [];
  projectiles = [];
  xpOrbs = [];
  spawnTimer = 0;
  difficulty = 1;
  frameCount = 0;
  pendingChoices = null;
  gameOver = false;

  // Reset player stats
  player.hp = player.maxHp;
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 10;
  player.gold = 0;

  // Reset upgrades
  player.upgrades = [];
  player.uberUpgrades = [];

  const [px, py] = findValidSpawn(1, 1);
  player.reset(px, py);
}


function findValidSpawn(startX, startY) {
  if (map.isWalkable(startX, startY)) return [startX, startY];
  const radius = 10;
  for (let r = 1; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (map.isWalkable(nx, ny)) return [nx, ny];
      }
    }
  }
  return [startX, startY];
}

// ==== Game Loop ====
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// ==== Update ====
function update() {
  if (paused || gameOver || pendingChoices) return;

  // Advance animation frame (do not draw here)
  map.updateAnimation();

  frameCount++;

  if (frameCount % 300 === 0) {
    difficulty += 0.5;
    spawnInterval = Math.max(40, spawnInterval - 2);
  }

  if (player.hp > 0) player.update(keys, projectiles);

  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
  }

  // Enemy updates
 for (let i = enemies.length - 1; i >= 0; i--) {
  const e = enemies[i];

  if (e.entryDelay > 0) { e.entryDelay--; continue; }

  e.update(player);

  // --- Apply tile effects to enemy ---
  map.applyTileEffects(e, Math.floor(e.px / TILE_SIZE), Math.floor(e.py / TILE_SIZE));

  if (e.type === "shooter") {
    if (e.fireCooldown > 0) e.fireCooldown--;
    if (e.fireCooldown <= 0) {
      const vx = ((player.px + TILE_SIZE/2) - (e.px + TILE_SIZE/2)) / 60 * e.projectileSpeed;
      const vy = ((player.py + TILE_SIZE/2) - (e.py + TILE_SIZE/2)) / 60 * e.projectileSpeed;
      projectiles.push(new Projectile(e.px + TILE_SIZE/2, e.py + TILE_SIZE/2, vx, vy, e.touchDamage*0.8, 90, 1));
      e.fireCooldown = e.fireCooldownMax;
    }
  }

  if (e.hp <= 0) {
    xpOrbs.push({ x: e.px + TILE_SIZE / 2, y: e.py + TILE_SIZE / 2, r: 4, value: 1 + Math.floor(difficulty / 2) });
    player.gold += Math.floor(5 + difficulty * 2);
    enemies.splice(i, 1);
  }
}


  // Projectile updates
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update();
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (circleRectOverlap(p.x, p.y, p.r, e.px, e.py, TILE_SIZE, TILE_SIZE)) {
        e.hp -= p.damage * 1.5;
        p.pierce -= 1;
        if (p.pierce <= 0) projectiles.splice(i, 1);
        if (e.hp <= 0) {
          xpOrbs.push({ x: e.px + TILE_SIZE / 2, y: e.py + TILE_SIZE / 2, r: 4, value: 1 + Math.floor(difficulty / 2) });
          player.gold += Math.floor(5 + difficulty * 2);
          enemies.splice(j, 1);
        }
        break;
      }
    }
    if (p.life <= 0 && projectiles.includes(p)) projectiles.splice(i, 1);
  }

  // XP pickup
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    const dx = (player.px + TILE_SIZE / 2) - orb.x;
    const dy = (player.py + TILE_SIZE / 2) - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < player.pickupRange) {
      orb.x += (dx / Math.max(d, 1)) * 3;
      orb.y += (dy / Math.max(d, 1)) * 3;
    }
    if (d < 8) {
      player.gainXp(orb.value, onLevelUp);
      player.gold += orb.value;
      xpOrbs.splice(i, 1);
    }
  }

  if (player.hp <= 0 && !gameOver) gameOver = true;

  updateHUD();
}


// ==== Draw ====
function draw() {
  ctx.clearRect(0, 0, gameWidth, gameHeight);
  map.draw(ctx);

  ctx.save();
  for (const orb of xpOrbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fillStyle = "#3cf";
    ctx.fill();
  }
  ctx.restore();

  enemies.forEach(e => e.draw(ctx));
  player.draw(ctx);

  ctx.save();
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  ctx.restore();

  if (gameOver) drawGameOverScreen();
}

// ==== HUD Helpers ====
function updateHUD() {
  hudHp.textContent = `HP: ${Math.ceil(player.hp)} / ${player.maxHp}`;
  hudXp.textContent = `Lv ${player.level} | XP: ${player.xp} / ${player.xpToNext}`;
  hudGold.textContent = `Gold: ${player.gold}`;
  hudStats.textContent = `DMG ${player.damage} | ROF ${(60 / player.fireCooldownMax).toFixed(1)}/s | SPD ${player.speed.toFixed(1)}`;
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, gameWidth, gameHeight);
  ctx.fillStyle = "#fff";
  ctx.font = "32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", gameWidth / 2, gameHeight / 2 - 40);
  ctx.font = "20px sans-serif";
  ctx.fillText("Click to Restart", gameWidth / 2, gameHeight / 2 + 20);
}

// ==== Helpers ====
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx*dx + dy*dy <= r*r;
}

window.addEventListener("load", init);
