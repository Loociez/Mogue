import { map, TILE_SIZE } from "./map.js";
import { Player } from "./player.js";
import { Projectile } from "./projectile.js";
import { Enemy, spawnMiniBoss, spawnBoss, ENEMY_SPEED_SCALE, rollRarity, applyRarity, getEnemyHitbox } from "./enemy.js";
import { skillTree } from "./skilltree.js";
import { drawGuardianShield } from "./skills.js";
import { tickEffects, drawEffect } from "./effects.js";
import { getMeta, computeMetaBonuses, awardRunEssence, getUpgradeCost, purchaseUpgrade, UPGRADE_DEFS } from "./meta.js";

// ============================================================
// Core game state
// ============================================================
let canvas, ctx, canvasWidth, canvasHeight;
let enemies = [
  new Enemy(5, 5, 0, "normal"),
  new Enemy(10, 5, 1, "brute"),
  new Enemy(15, 5, 2, "shooter")
];
let animationFrameId = null;

// All dynamically-created modals (skill tree, shop, meta upgrades) must be
// appended inside #gameWrapper rather than document.body directly. When the
// game is fullscreened, only the fullscreened element and its descendants
// are actually rendered - anything appended straight to body becomes
// invisible and unreachable until the player exits fullscreen.
function getOverlayRoot() {
  return document.getElementById("gameWrapper") || document.body;
}

const hpBarFill = document.getElementById("hpBarFill");
const hpLabel = document.getElementById("hpLabel");
const xpBarFill = document.getElementById("xpBarFill");
const xpLabel = document.getElementById("xpLabel");
const goldLabel = document.getElementById("gold");
const statsLabel = document.getElementById("stats");

let player;
let mouse = { x: 0, y: 0 };
let projectiles = [];
let xpOrbs = [];
let damageTexts = [];
let explosions = [];
let deathParticles = [];
let groundHazards = []; // timed floor-damage zones (e.g. miniboss rain), each fades out and removes itself

let spawnTimer = 0;
let spawnInterval = 180;
let difficulty = 1;
let frameCount = 0;

let paused = false;      // Escape-pause
let uiOpen = false;       // any modal UI blocking gameplay (shop/skills/char-select)
let lastRun = null;
let isDead = false;
let damageFlash = 0;
let skillTreeOpen = false;
let spriteSlot = 0;

// --- Map tier / warp state ---
// Tier 1 is the starting map (maps/map.json) and has no rarity modifiers.
// Tiers 2-5 share the "Deep Zone" enemy roster (see spawnWaveTierDeepZone)
// but get progressively harder via zonePower, and progressively introduce
// Rare -> Elite -> Legendary modifiers as requested: rare starts on tier 2,
// elite added on tier 3, legendary added on tier 4, and tier 5 keeps all
// three but spawns noticeably more enemies per wave.
const MAP1_PATH = "maps/map.json";
const DEFAULT_SPAWN_X = 15, DEFAULT_SPAWN_Y = 15;

const MAP_TIERS = [
  { tier: 1, path: "maps/map.json",  warpLevel: 0,  zonePower: 1,   rarity: null,                                            extraSpawns: false },
  { tier: 2, path: "maps/map2.json", warpLevel: 20, zonePower: 1,   rarity: { rare: 0.12 },                                  extraSpawns: false },
  { tier: 3, path: "maps/map3.json", warpLevel: 30, zonePower: 1.6, rarity: { rare: 0.14, elite: 0.05 },                     extraSpawns: false },
  { tier: 4, path: "maps/map4.json", warpLevel: 40, zonePower: 2.3, rarity: { rare: 0.16, elite: 0.06, legendary: 0.015 },   extraSpawns: false },
  { tier: 5, path: "maps/map5.json", warpLevel: 50, zonePower: 3.2, rarity: { rare: 0.24, elite: 0.10, legendary: 0.035 },   extraSpawns: true  }
];
function tierConfig(tier) { return MAP_TIERS.find(t => t.tier === tier) || MAP_TIERS[0]; }

let currentMapTier = 1;
let isWarping = false;
let warpMessage = "";
let warpMessageTimer = 0;

const camera = { x: 0, y: 0, zoom: 1.5 };

const effectsSheet = new Image();
effectsSheet.src = "assets/effects1.png";
const EFFECT_FRAME_SIZE = 32;

// ============================================================
// Skill Tree UI - compact, depth-aligned grid of tiny nodes.
// Renders as a small self-contained panel (not a full-page layout),
// so it always fits within the visible game window instead of forcing
// the whole page to scroll.
// ============================================================
function ensureSkillTreeUI() {
  let overlay = document.getElementById("skillTreeUI");
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.id = "skillTreeUI";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", display: "none",
    background: "rgba(0,0,0,0.75)", zIndex: 1000,
    font: "13px 'Inter', sans-serif",
    alignItems: "center", justifyContent: "center"
  });

  const panel = document.createElement("div");
  panel.id = "skillTreePanel";
  panel.className = "panel";
  Object.assign(panel.style, {
    width: "min(94vw, 620px)",
    maxHeight: "92vh",
    display: "flex", flexDirection: "column",
    padding: "12px", boxSizing: "border-box"
  });

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flex: "0 0 auto" });

  const title = document.createElement("h2");
  title.textContent = "🌳 Skill Tree";
  Object.assign(title.style, { color: "var(--border-gold-bright)", margin: "0", fontSize: "17px", textShadow: "0 2px 6px rgba(0,0,0,0.5)" });

  const pointsLabel = document.createElement("div");
  pointsLabel.id = "skillPointsLabel";
  Object.assign(pointsLabel.style, { color: "var(--accent-green)", fontSize: "13px", fontWeight: "700", fontFamily: "var(--font-display)" });
  pointsLabel.textContent = "Points: 0";

  header.appendChild(title);
  header.appendChild(pointsLabel);

  const hint = document.createElement("div");
  hint.textContent = "Tap a node to upgrade it \u2022 hover/long-press for details";
  Object.assign(hint.style, { color: "var(--text-dim)", fontSize: "10px", marginBottom: "6px", flex: "0 0 auto" });

  const scrollArea = document.createElement("div");
  scrollArea.id = "skillGridScroll";
  Object.assign(scrollArea.style, { overflowY: "auto", overflowX: "hidden", flex: "1 1 auto", minHeight: "0" });

  const grid = document.createElement("div");
  grid.id = "skillGrid";
  Object.assign(grid.style, { position: "relative" });
  scrollArea.appendChild(grid);

  const footer = document.createElement("div");
  Object.assign(footer.style, { display: "flex", justifyContent: "flex-end", marginTop: "8px", flex: "0 0 auto" });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close (L)";
  closeBtn.className = "btn";
  closeBtn.onclick = closeSkillTree;

  footer.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(hint);
  panel.appendChild(scrollArea);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  getOverlayRoot().appendChild(overlay);
}

function styleUIButton(btn) {
  btn.className = "btn";
}

function findSkillNode(id) {
  let node = skillTree.root.find(n => n.id === id);
  if (node) return node;
  for (const branch in skillTree.nodes) {
    node = skillTree.nodes[branch].find(n => n.id === id);
    if (node) return node;
  }
  return null;
}

// Depth = how many "requires" hops a node is from the root. Used to align
// every branch into the same tiny grid so the whole tree reads top-to-bottom
// without needing per-branch column heights.
function getNodeDepth(node, depthCache) {
  if (depthCache.has(node.id)) return depthCache.get(node.id);
  if (!node.requires) { depthCache.set(node.id, 0); return 0; }
  const parent = findSkillNode(node.requires);
  const depth = parent ? getNodeDepth(parent, depthCache) + 1 : 0;
  depthCache.set(node.id, depth);
  return depth;
}

const NODE_W = 78, NODE_H = 46, COL_W = 110, ROW_H = 58;

function renderSkillTree() {
  const grid = document.getElementById("skillGrid");
  const pointsLabel = document.getElementById("skillPointsLabel");
  if (!grid || !pointsLabel || !player) return;

  grid.innerHTML = "";
  pointsLabel.textContent = `Points: ${player.skillPoints || 0}`;

  const allNodes = [];
  if (Array.isArray(skillTree.root) && skillTree.root.length > 0) {
    const rootNode = skillTree.root[0];
    rootNode.branch = rootNode.branch || "middle";
    allNodes.push(rootNode);
  }
  if (skillTree.nodes && typeof skillTree.nodes === "object") {
    for (const key in skillTree.nodes) {
      const branchNodes = skillTree.nodes[key];
      if (!Array.isArray(branchNodes)) continue;
      branchNodes.forEach(node => {
        if (!node || !node.id) return;
        if (node.level == null) node.level = 0;
        if (node.maxLevel == null) node.maxLevel = node.id.startsWith("uber_") ? 3 : 5;
        allNodes.push(node);
      });
    }
  }

  const depthCache = new Map();
  const branchIndex = { left: 0, middle: 1, right: 2 };
  const colOffset = { left: -1, middle: 0, right: 1 }; // sub-slot offset when 2 nodes share a cell

  // Group nodes that land on the exact same (branch, depth) cell so we can
  // spread them out slightly instead of stacking them on top of each other.
  const cellGroups = new Map();
  let maxDepth = 0;
  allNodes.forEach(node => {
    const depth = getNodeDepth(node, depthCache);
    maxDepth = Math.max(maxDepth, depth);
    const branch = node.branch && branchIndex[node.branch] != null ? node.branch : "middle";
    const key = `${branch}:${depth}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key).push(node);
  });

  grid.style.height = `${(maxDepth + 1) * ROW_H + 20}px`;
  grid.style.width = `${COL_W * 3}px`;
  grid.style.margin = "0 auto";

  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "skillTreeSVG";
  Object.assign(svg.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none" });
  grid.appendChild(svg);

  const cardPositions = {};

  cellGroups.forEach((nodesInCell, key) => {
    const [branch, depthStr] = key.split(":");
    const depth = parseInt(depthStr);
    const baseX = COL_W * (branchIndex[branch] + 0.5);
    const baseY = ROW_H * depth + ROW_H / 2 + 10;

    nodesInCell.forEach((node, i) => {
      // if 2+ nodes share a cell, spread them horizontally a bit
      const spread = nodesInCell.length > 1 ? (i - (nodesInCell.length - 1) / 2) * (NODE_W * 0.55) : 0;
      const cx = baseX + spread;
      const cy = baseY;

      const card = document.createElement("div");
      card.className = "skill-node";
      Object.assign(card.style, {
        position: "absolute",
        left: `${cx - NODE_W / 2}px`, top: `${cy - NODE_H / 2}px`,
        width: `${NODE_W}px`, height: `${NODE_H}px`,
        border: "1px solid var(--border-dim)", borderRadius: "6px",
        background: "linear-gradient(160deg, var(--bg-panel-3), #0c0e16)",
        textAlign: "center", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "2px", boxSizing: "border-box", userSelect: "none",
        transition: "box-shadow 0.15s ease"
      });

      let canUpgrade = node.level < node.maxLevel && player.skillPoints > 0;
      if (node.requires) {
        const req = findSkillNode(node.requires);
        if (!req || req.level === 0) canUpgrade = false;
      }
      const isMaxed = node.level >= node.maxLevel;
      if (isMaxed) { card.style.borderColor = "var(--accent-green)"; card.style.boxShadow = "0 0 6px rgba(126,224,138,0.35)"; }
      else if (!canUpgrade) card.style.opacity = "0.4";
      else { card.style.borderColor = "var(--border-gold-bright)"; card.style.boxShadow = "0 0 6px rgba(232,199,102,0.3)"; }

      card.title = `${node.name || node.id}\n${node.desc || ""}\nLevel ${node.level}/${node.maxLevel}`;

      const nameEl = document.createElement("div");
      nameEl.textContent = (node.name || node.id).split(" ")[0];
      Object.assign(nameEl.style, {
        fontWeight: "bold", fontSize: "9px", lineHeight: "1.05", fontFamily: "var(--font-display)",
        color: node.maxLevel === 1 ? "#ff9be0" : node.maxLevel === 3 ? "#ff8a6b" : "#ffe066",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%"
      });

      const levelEl = document.createElement("div");
      levelEl.textContent = isMaxed ? "MAX" : `${node.level}/${node.maxLevel}`;
      Object.assign(levelEl.style, { color: "var(--accent-green)", fontSize: "9px", marginTop: "2px" });

      card.appendChild(nameEl);
      card.appendChild(levelEl);

      card.addEventListener("click", () => {
        let ok = node.level < node.maxLevel && player.skillPoints > 0;
        if (node.requires) {
          const req = findSkillNode(node.requires);
          if (!req || req.level === 0) ok = false;
        }
        if (ok) {
          node.level++;
          player.skillPoints--;
          if (typeof node.apply === "function") node.apply(player, node.level);
          renderSkillTree();
          updateHUD();
        }
      });

      grid.appendChild(card);
      cardPositions[node.id] = { x: cx, y: cy };
    });
  });

  // Connector lines between prerequisite and child nodes
  allNodes.forEach(node => {
    if (!node.requires) return;
    const from = cardPositions[node.requires];
    const to = cardPositions[node.id];
    if (!from || !to) return;
    const req = findSkillNode(node.requires);
    const unlocked = req && req.level > 0;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y + NODE_H / 2);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y - NODE_H / 2);
    line.setAttribute("stroke", unlocked ? "#e8c766" : "#3a4552");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  });
}

function openSkillTree() {
  if (!player) return;
  closeShop(); // enforce only one modal (shop/skills) open at a time
  ensureSkillTreeUI();
  renderSkillTree();
  document.getElementById("skillTreeUI").style.display = "flex";
  skillTreeOpen = true;
  uiOpen = true;
  paused = true;
}

function closeSkillTree() {
  const overlay = document.getElementById("skillTreeUI");
  if (overlay) overlay.style.display = "none";
  skillTreeOpen = false;
  uiOpen = false;
  paused = false;
}

// ============================================================
// Character select / (re)start
// ============================================================
function showCharacterSelect() {
  paused = true;
  uiOpen = true;

  const container = document.getElementById("characterSelect");
  container.style.display = "block";
  container.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "⚔️ Choose Your Hero";
  Object.assign(title.style, { color: "var(--border-gold-bright)", fontSize: "22px", marginBottom: "14px", textShadow: "0 2px 8px rgba(0,0,0,0.6)" });
  container.appendChild(title);

  const previewRow = document.createElement("div");
  Object.assign(previewRow.style, { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "14px" });

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = 64;
  previewCanvas.height = 64;
  Object.assign(previewCanvas.style, {
    border: "2px solid var(--border-gold)", borderRadius: "6px",
    background: "var(--bg-panel-3)", imageRendering: "pixelated"
  });
  previewRow.appendChild(previewCanvas);

  const previewCtx = previewCanvas.getContext("2d");
  const previewImg = new Image();

  function drawPreview(slot) {
    const frameIndex = 12 * slot + 3;
    const cols = previewImg.naturalWidth / 32 || 32;
    const sx = (frameIndex % cols) * 32;
    const sy = 32 * Math.floor(frameIndex / cols);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (previewImg.complete) previewCtx.drawImage(previewImg, sx, sy, 32, 32, 0, 0, previewCanvas.width, previewCanvas.height);
  }
  previewImg.src = "assets/player.png";
  previewImg.onload = () => drawPreview(spriteSlot);

  const selectWrap = document.createElement("div");
  Object.assign(selectWrap.style, { textAlign: "left" });
  const label = document.createElement("div");
  label.textContent = "Sprite";
  Object.assign(label.style, { fontSize: "11px", color: "var(--text-dim)", marginBottom: "3px" });
  const select = document.createElement("select");
  select.id = "spriteSlotSelect";
  Object.assign(select.style, {
    background: "var(--bg-panel-3)", color: "var(--text-parchment)",
    border: "1px solid var(--border-gold)", borderRadius: "6px", padding: "5px 8px", fontFamily: "var(--font-body)"
  });
  for (let i = 0; i < 32; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Slot ${i}`;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => { spriteSlot = parseInt(select.value); drawPreview(spriteSlot); });
  selectWrap.appendChild(label);
  selectWrap.appendChild(select);
  previewRow.appendChild(selectWrap);
  container.appendChild(previewRow);

  const classRow = document.createElement("div");
  Object.assign(classRow.style, { display: "flex", flexDirection: "column", gap: "8px" });
  [
    { type: "warrior", icon: "🛡️", name: "Warrior", desc: "High HP & damage" },
    { type: "archer", icon: "🏹", name: "Archer", desc: "Fires spread projectiles" },
    { type: "mage", icon: "🔮", name: "Mage", desc: "Fires homing projectiles" }
  ].forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.padding = "10px";
    btn.style.fontSize = "14px";
    btn.innerHTML = `${choice.icon} ${choice.name} <span style="font-weight:400;font-family:var(--font-body);color:var(--text-dim);font-size:11px;">— ${choice.desc}</span>`;
    btn.onclick = () => beginRun(choice.type);
    classRow.appendChild(btn);
  });
  container.appendChild(classRow);

  const essenceLine = document.createElement("div");
  essenceLine.id = "charSelectEssence";
  Object.assign(essenceLine.style, { color: "var(--accent-purple)", margin: "14px 0 6px 0", fontSize: "14px", fontFamily: "var(--font-display)", fontWeight: "700" });
  essenceLine.textContent = `\u2726 Essence: ${getMeta().essence}`;
  container.appendChild(essenceLine);

  const metaBtn = document.createElement("button");
  metaBtn.className = "btn";
  metaBtn.style.width = "100%";
  metaBtn.textContent = "✦ Permanent Upgrades";
  metaBtn.onclick = openMetaUI;
  container.appendChild(metaBtn);

  const controlsInfo = document.createElement("div");
  Object.assign(controlsInfo.style, { marginTop: "18px", color: "var(--text-dim)", fontSize: "12px", fontFamily: "var(--font-body)", borderTop: "1px solid var(--border-dim)", paddingTop: "10px" });
  controlsInfo.innerHTML = `
    <div style="color:var(--text-parchment); font-family:var(--font-display); font-size:13px; margin-bottom:4px;">Controls</div>
    <p style="margin:2px 0;">WASD / Arrow Keys — Move</p>
    <p style="margin:2px 0;">Space / Tap Attack — Fire</p>
    <p style="margin:2px 0;">K — Shop &nbsp;·&nbsp; L — Skill Tree &nbsp;·&nbsp; Shift — Blink</p>
    <p style="margin:2px 0;">Esc — Pause</p>
  `;
  container.appendChild(controlsInfo);
}

// ============================================================
// Meta Upgrades UI - permanent, cross-run bonuses bought with Essence.
// Only accessible from the character-select screen (between runs).
// ============================================================
function ensureMetaUI() {
  let overlay = document.getElementById("metaUI");
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.id = "metaUI";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", display: "none",
    background: "rgba(0,0,0,0.75)", zIndex: 1000,
    alignItems: "center", justifyContent: "center", font: "13px 'Inter', sans-serif"
  });

  const panel = document.createElement("div");
  panel.id = "metaPanel";
  panel.className = "panel";
  Object.assign(panel.style, {
    width: "min(94vw, 480px)", maxHeight: "88vh", overflowY: "auto",
    padding: "16px", boxSizing: "border-box"
  });

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" });
  const title = document.createElement("h2");
  title.textContent = "✦ Permanent Upgrades";
  Object.assign(title.style, { color: "var(--border-gold-bright)", margin: "0", fontSize: "17px", textShadow: "0 2px 6px rgba(0,0,0,0.5)" });
  const essenceLabel = document.createElement("div");
  essenceLabel.id = "metaEssenceLabel";
  Object.assign(essenceLabel.style, { color: "var(--accent-purple)", fontWeight: "700", fontFamily: "var(--font-display)" });
  header.appendChild(title);
  header.appendChild(essenceLabel);

  const hint = document.createElement("div");
  hint.textContent = "Bought with Essence, earned at the end of every run. These are small, permanent bonuses meant to help you push into harder zones over time.";
  Object.assign(hint.style, { color: "var(--text-dim)", fontSize: "11px", marginBottom: "10px" });

  const list = document.createElement("div");
  list.id = "metaList";
  Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "8px" });

  const footer = document.createElement("div");
  Object.assign(footer.style, { display: "flex", justifyContent: "flex-end", marginTop: "12px" });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.className = "btn";
  closeBtn.onclick = closeMetaUI;
  footer.appendChild(closeBtn);

  panel.appendChild(header);
  panel.appendChild(hint);
  panel.appendChild(list);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  getOverlayRoot().appendChild(overlay);
}

function renderMetaUI() {
  const list = document.getElementById("metaList");
  const essenceLabel = document.getElementById("metaEssenceLabel");
  if (!list || !essenceLabel) return;

  const meta = getMeta();
  essenceLabel.textContent = `\u2726 ${meta.essence}`;
  list.innerHTML = "";

  for (const key in UPGRADE_DEFS) {
    const def = UPGRADE_DEFS[key];
    const level = meta.upgrades[key] || 0;
    const cost = getUpgradeCost(key);
    const maxed = cost === null;

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      border: "1px solid var(--border-dim)", borderRadius: "8px", padding: "8px 10px",
      background: "var(--bg-panel-3)"
    });

    const info = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.textContent = `${def.name} (${level}/${def.max})`;
    Object.assign(nameEl.style, { color: "#ffe066", fontWeight: "bold", fontSize: "13px", fontFamily: "var(--font-display)" });
    const descEl = document.createElement("div");
    descEl.textContent = def.desc;
    Object.assign(descEl.style, { color: "var(--text-dim)", fontSize: "11px" });
    info.appendChild(nameEl);
    info.appendChild(descEl);

    const btn = document.createElement("button");
    btn.textContent = maxed ? "MAX" : `Buy (\u2726${cost})`;
    btn.className = "btn";
    btn.disabled = maxed || meta.essence < cost;
    btn.onclick = () => {
      if (purchaseUpgrade(key)) renderMetaUI();
    };

    row.appendChild(info);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function openMetaUI() {
  ensureMetaUI();
  renderMetaUI();
  document.getElementById("metaUI").style.display = "flex";
}

function closeMetaUI() {
  const overlay = document.getElementById("metaUI");
  if (overlay) overlay.style.display = "none";
  const charSelectEssence = document.getElementById("charSelectEssence");
  if (charSelectEssence) charSelectEssence.textContent = `\u2726 Essence: ${getMeta().essence}`;
}

function findNearestWalkable(tx, ty) {
  if (map.isWalkable(tx, ty)) return [tx, ty];
  for (let r = 1; r <= 10; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = tx + dx, ny = ty + dy;
        if (map.isWalkable(nx, ny)) return [nx, ny];
      }
    }
  }
  return [tx, ty];
}

async function beginRun(characterType) {
  // If the previous run warped to the tier-2 map, load map1 back in before
  // starting a fresh run on it.
  if (currentMapTier !== 1) {
    uiOpen = true;
    await map.load(MAP1_PATH);
    currentMapTier = 1;
  }

  const [sx, sy] = findNearestWalkable(11, 10);
  player = new Player(characterType, spriteSlot);
  player.reset(sx, sy);
  player.applyMetaBonuses(computeMetaBonuses());
  window.player = player;

  document.getElementById("characterSelect").style.display = "none";
  paused = false;
  uiOpen = false;
  closeShop();
  closeSkillTree();

  enemies = [];
  projectiles = [];
  xpOrbs = [];
  damageTexts = [];
  explosions = [];
  deathParticles = [];
  groundHazards = [];
  spawnTimer = 0;
  spawnInterval = 180;
  difficulty = 1;
  frameCount = 0;
  isDead = false;
  isWarping = false;
  warpMessageTimer = 0;

  const deathOverlay = document.getElementById("deathOverlay");
  if (deathOverlay) deathOverlay.style.display = "none";

  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  lastFrameTime = 0;
  simAccumulator = 0;
  animationFrameId = requestAnimationFrame(mainLoop);
}

// === Warps the player into the next map tier once they hit its level requirement ===
async function warpToNextTier() {
  if (isWarping) return;
  const next = tierConfig(currentMapTier + 1);
  if (!next || next.tier <= currentMapTier) return; // already at the highest configured tier

  isWarping = true;
  paused = true;
  uiOpen = true;
  warpMessage = `Entering Zone ${next.tier}...`;
  warpMessageTimer = 999999; // held until the load finishes

  await map.load(next.path);
  currentMapTier = next.tier;

  // Clear the board for the new zone
  enemies = [];
  projectiles = [];
  xpOrbs = [];
  damageTexts = [];
  explosions = [];
  deathParticles = [];
  groundHazards = [];
  spawnTimer = 0;
  spawnInterval = Math.max(80, 150 - (next.tier - 2) * 12);
  difficulty = Math.max(difficulty, 6 * next.tier); // immediate difficulty spike for the new zone

  const [sx, sy] = findNearestWalkable(DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y);
  player.x = sx; player.y = sy;
  player.targetX = sx; player.targetY = sy;
  player.px = sx * TILE_SIZE; player.py = sy * TILE_SIZE;

  warpMessage = `Zone ${next.tier}`;
  warpMessageTimer = 150; // ~2.5s banner then fade

  paused = false;
  uiOpen = false;
  isWarping = false;
}

// ============================================================
// Rain (map weather hook)
// ============================================================
map.rainDrops = [];
map.rainEnabled = true;
map.updateRain = function (w, h) {
  if (!this.rainEnabled) return;
  this.rainDrops ??= [];
  for (let i = 0; i < 3; i++) {
    this.rainDrops.push({
      x: Math.random() * w, y: -5,
      length: 8 + 4 * Math.random(), speed: 4 + 4 * Math.random(),
      alpha: 0.2 + 0.3 * Math.random()
    });
  }
  for (let i = this.rainDrops.length - 1; i >= 0; i--) {
    const drop = this.rainDrops[i];
    drop.y += drop.speed;
    drop.x += 0.5 * Math.sin(frameCount / 10 + drop.y / 20);
    if (drop.y > h) this.rainDrops.splice(i, 1);
  }
};
map.drawRain = function (ctx2) {
  if (!this.rainEnabled || !this.rainDrops) return;
  ctx2.save();
  ctx2.strokeStyle = "rgba(100,100,255,0.4)";
  ctx2.lineWidth = 1;
  ctx2.beginPath();
  for (const drop of this.rainDrops) {
    ctx2.moveTo(drop.x, drop.y);
    ctx2.lineTo(drop.x + 0.3 * drop.length, drop.y + drop.length);
  }
  ctx2.stroke();
  ctx2.restore();
};

// ============================================================
// Input
// ============================================================
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && !uiOpen) paused = !paused;

  if (e.key.toLowerCase() === "l") {
    if (skillTreeOpen) closeSkillTree();
    else if (!isDead) openSkillTree();
  }

  if (e.key === "Shift" && player && player.unlockedSkills.includes("blink") && player.blinkCharges > 0) {
    doBlink();
  }
});

function doBlink() {
  const oldX = player.px, oldY = player.py;
  const distance = player.blinkDistance || 150;

  // Line dash in the direction the player is currently facing/moving -
  // simple and predictable, not dependent on mouse position (which is what
  // made this feel "random" on mobile/keyboard-only play, since the mouse
  // never moves there).
  let dx = 0, dy = 0;
  switch (player.dir) {
    case "up": dy = -1; break;
    case "down": dy = 1; break;
    case "left": dx = -1; break;
    case "right": dx = 1; break;
    default: dy = 1;
  }

  // Raymarch along the dash line in small steps, stopping just before a
  // blocked tile so the player doesn't teleport through walls.
  const steps = 12;
  let landX = oldX, landY = oldY;
  for (let i = 1; i <= steps; i++) {
    const testPx = oldX + dx * distance * (i / steps);
    const testPy = oldY + dy * distance * (i / steps);
    const testTileX = Math.floor((testPx + TILE_SIZE / 2) / TILE_SIZE);
    const testTileY = Math.floor((testPy + TILE_SIZE / 2) / TILE_SIZE);
    if (!map.isWalkable(testTileX, testTileY)) break;
    landX = testPx;
    landY = testPy;
  }

  landX = Math.max(0, Math.min(landX, map.width * TILE_SIZE - TILE_SIZE));
  landY = Math.max(0, Math.min(landY, map.height * TILE_SIZE - TILE_SIZE));

  player.px = landX;
  player.py = landY;

  // Critical: sync the tile-grid position AND movement target to the new
  // spot. Without this, the movement-interpolation code in Player.update()
  // thinks it still needs to walk from here back to the old tile (since
  // targetX/targetY never moved), which is exactly what caused blink to
  // look like it "snapped back" to where you started a moment later.
  player.x = Math.round(player.px / TILE_SIZE);
  player.y = Math.round(player.py / TILE_SIZE);
  player.targetX = player.x;
  player.targetY = player.y;

  if (typeof player.createBlinkTrail === "function") player.createBlinkTrail(oldX, oldY, player.px, player.py);
  player.blinkCharges--;
  player.blinkCooldownTimer = player.blinkCooldown || 180;

  // Dash Shot: firing a burst of projectiles from the blink point
  if (player.dashShot > 0) {
    const shots = 4 + player.dashShot * 2;
    for (let i = 0; i < shots; i++) {
      const angle = (Math.PI * 2 / shots) * i;
      projectiles.push(new Projectile(
        player.px + TILE_SIZE / 2, player.py + TILE_SIZE / 2,
        Math.cos(angle) * 4, Math.sin(angle) * 4,
        Math.max(1, Math.round(player.damage * 0.6)),
        60, 1, "dashshot", 200, player
      ));
    }
  }
}

// Debug helpers (available from the browser console)
window.giveGold = (amount = 1000000) => {
  if (!player) return console.warn("Player not defined yet.");
  player.gold += amount;
  console.log(`Gave player ${amount} gold! Total: ${player.gold}`);
  updateHUD();
};
window.setMaxHP = (amount = 9999999) => {
  if (!player) return console.warn("Player not defined yet.");
  player.hp = amount;
  player.maxHp = amount;
  console.log(`Player HP set to ${amount}`);
  updateHUD();
};
window.setLevel = (level = 40) => {
  if (!player) return console.warn("Player not defined yet.");
  player.level = level;
  player.xp = 0;
  console.log(`Player level set to ${level}`);
  updateHUD();
};

// ============================================================
// Shop
// ============================================================
let shopOpen = false;
const shopItems = [
  { icon: "✨", name: "XP Boost", desc: "Instantly gain a chunk of XP", cost: 70, xpAmount: 10, stackable: true,
    action() { player.gainXp(this.xpAmount, onLevelUp); this.xpAmount = Math.floor(this.xpAmount * 1.2); this.cost = Math.floor(this.cost * 2); } },
  { icon: "🏹", name: "Spread Projectile", desc: "Switch to a 3-way spread shot", cost: 100, action() { player.unlockProjectile("spread"); } },
  { icon: "🔮", name: "Homing Projectile", desc: "Switch to a homing bolt", cost: 150, action() { player.unlockProjectile("homing"); } },
  { icon: "💥", name: "Heavy Projectile", desc: "Switch to a slow, hard-hitting shot", cost: 150, action() { player.unlockProjectile("heavy"); } },
  { icon: "🥾", name: "Speed Boost", desc: "+0.65 move speed", cost: 12000, stackable: true,
    action() { player.speed += 0.65; this.cost = Math.floor(this.cost * 1.5); } },
  { icon: "🎆", name: "Exploding Projectiles", desc: "Shots splash nearby enemies on hit", cost: 250, action() { player.projectileExplosion = true; } },
  { icon: "🩸", name: "Life Leech", desc: "Heal on damage dealt", cost: 30000, action() { player.lifeLeech = Math.max(player.lifeLeech, 0.2); } },
  { icon: "🎯", name: "Critical Boost", desc: "+10% crit chance, +0.5x crit damage", cost: 18000,
    action() { player.critChance = Math.min((player.critChance || 0) + 0.1, 1); player.critMultiplier = (player.critMultiplier || 1.5) + 0.5; } },
  { icon: "📏", name: "Max Range Increase", desc: "+100 projectile range", cost: 150, action() { player.maxDistance += 100; } }
];

function buyShopItem(idx) {
  const item = shopItems[idx];
  if (!item || (!item.stackable && item.bought)) return;
  if (!player || player.gold < item.cost) return;
  player.gold -= item.cost;
  item.action();
  if (!item.stackable) item.bought = true;
  updateHUD();
  renderShopUI();
  if (!item.stackable) closeShop();
}

function ensureShopUI() {
  let overlay = document.getElementById("shopModalUI");
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.id = "shopModalUI";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", display: "none",
    background: "rgba(0,0,0,0.75)", zIndex: 1000,
    alignItems: "center", justifyContent: "center", font: "13px sans-serif"
  });

  const panel = document.createElement("div");
  panel.className = "panel";
  Object.assign(panel.style, {
    width: "min(94vw, 560px)", maxHeight: "88vh", overflowY: "auto",
    padding: "16px", boxSizing: "border-box"
  });

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" });
  const title = document.createElement("h2");
  title.textContent = "🛒 Shop";
  Object.assign(title.style, { color: "var(--border-gold-bright)", fontSize: "18px" });
  const goldLabelEl = document.createElement("div");
  goldLabelEl.id = "shopGoldLabel";
  Object.assign(goldLabelEl.style, { color: "#f0c95c", fontWeight: "700", fontFamily: "var(--font-display)" });
  header.appendChild(title);
  header.appendChild(goldLabelEl);

  const hint = document.createElement("div");
  hint.textContent = "Click an item to buy, or press its number (1-9).";
  Object.assign(hint.style, { color: "var(--text-dim)", fontSize: "11px", marginBottom: "10px" });

  const list = document.createElement("div");
  list.id = "shopList";
  Object.assign(list.style, { display: "flex", flexDirection: "column", gap: "8px" });

  const footer = document.createElement("div");
  Object.assign(footer.style, { display: "flex", justifyContent: "flex-end", marginTop: "12px" });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close (K)";
  closeBtn.className = "btn";
  closeBtn.onclick = closeShop;
  footer.appendChild(closeBtn);

  panel.appendChild(header);
  panel.appendChild(hint);
  panel.appendChild(list);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  getOverlayRoot().appendChild(overlay);
}

function renderShopUI() {
  const list = document.getElementById("shopList");
  const goldLabelEl = document.getElementById("shopGoldLabel");
  if (!list || !goldLabelEl || !player) return;

  goldLabelEl.textContent = `🪙 ${player.gold}`;
  list.innerHTML = "";

  shopItems.forEach((item, i) => {
    const maxed = !item.stackable && item.bought;
    const affordable = player.gold >= item.cost;

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex", alignItems: "center", gap: "10px",
      border: "1px solid var(--border-dim)", borderRadius: "8px", padding: "8px 10px",
      background: "var(--bg-panel-3)", cursor: maxed || !affordable ? "default" : "pointer",
      opacity: maxed ? "0.45" : affordable ? "1" : "0.65"
    });

    const iconEl = document.createElement("div");
    iconEl.textContent = item.icon;
    Object.assign(iconEl.style, { fontSize: "22px", width: "30px", textAlign: "center" });

    const info = document.createElement("div");
    Object.assign(info.style, { flex: "1" });
    const nameEl = document.createElement("div");
    nameEl.textContent = `${i + 1}. ${item.name}`;
    Object.assign(nameEl.style, { color: "#ffe066", fontWeight: "bold", fontSize: "13px" });
    const descEl = document.createElement("div");
    descEl.textContent = item.desc || "";
    Object.assign(descEl.style, { color: "var(--text-dim)", fontSize: "11px" });
    info.appendChild(nameEl);
    info.appendChild(descEl);

    const costEl = document.createElement("div");
    costEl.className = "btn";
    costEl.style.pointerEvents = "none";
    costEl.style.fontSize = "12px";
    costEl.textContent = maxed ? "MAX" : `🪙 ${item.cost}`;

    row.appendChild(iconEl);
    row.appendChild(info);
    row.appendChild(costEl);

    if (!maxed && affordable) row.onclick = () => buyShopItem(i);

    list.appendChild(row);
  });
}

function openShop() {
  if (!player || isDead) return;
  if (shopOpen) { closeShop(); return; }
  closeSkillTree(); // enforce only one modal (shop/skills) open at a time
  ensureShopUI();
  renderShopUI();
  document.getElementById("shopModalUI").style.display = "flex";
  shopOpen = true;
  paused = true;
  uiOpen = true;
}

function closeShop() {
  const overlay = document.getElementById("shopModalUI");
  if (overlay) overlay.style.display = "none";
  shopOpen = false;
  paused = false;
  uiOpen = false;
}

window.addEventListener("keydown", e => {
  if (!shopOpen || !player) return;
  const idx = parseInt(e.key) - 1;
  if (idx >= 0 && idx < shopItems.length) buyShopItem(idx);
});

window.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "k") openShop();
});

// ============================================================
// Level up
// ============================================================
function onLevelUp() {
  if (!player) return;
  player.skillPoints = (player.skillPoints || 0) + 1;
  openSkillTree();
}

// ============================================================
// Main loop
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rectCircleCollide(cx, cy, radius, rx, ry, rw, rh) {
  const dx = cx - Math.max(rx, Math.min(cx, rx + rw));
  const dy = cy - Math.max(ry, Math.min(cy, ry + rh));
  return dx * dx + dy * dy <= radius * radius;
}

const SIM_HZ = 60;
const SIM_DT = 1000 / SIM_HZ; // ms per simulation tick
const MAX_FRAME_TIME = SIM_DT * 5; // clamp huge gaps (tab backgrounded, debugger pause, etc.)

let lastFrameTime = 0;
let simAccumulator = 0;

function mainLoop(timestamp) {
  if (isDead) return;

  try {
    if (!lastFrameTime) lastFrameTime = timestamp;
    let frameTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    simAccumulator += frameTime;

    // Run the simulation at a fixed cadence (60 ticks/sec) no matter how often
    // the browser actually calls requestAnimationFrame. This is what keeps
    // movement speed, cooldowns, spawn rate, and animations identical across
    // 60Hz, 120Hz, 144Hz+ displays instead of scaling with refresh rate.
    let ticks = 0;
    while (simAccumulator >= SIM_DT && ticks < 5) {
      if (!paused) updateWorld();
      simAccumulator -= SIM_DT;
      ticks++;
    }

    render();
  } catch (err) {
    console.error("mainLoop error (recovered):", err);
  }

  animationFrameId = requestAnimationFrame(mainLoop);
}

function updateWorld() {
  frameCount++;
  tickEffects();
  map.updateAnimation();
  map.updateRain(canvasWidth, canvasHeight);
  if (player?.blinkCooldownTimer > 0) player.blinkCooldownTimer--;

  if (frameCount % 300 === 0) {
    difficulty += 0.5;
    spawnInterval = Math.max(40, spawnInterval - 2);
  }

  const nextTier = tierConfig(currentMapTier + 1);
  if (player && nextTier && nextTier.tier > currentMapTier && player.level >= nextTier.warpLevel && !isWarping) {
    warpToNextTier();
    return;
  }
  if (isWarping) return;

  if (!uiOpen && player?.hp > 0) player.update(projectiles, enemies, xpOrbs, explosions);

  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnWave();
  }

  updateEnemies();
  updateProjectiles();
  updatePickups();
  updateDamageTexts();
  updateExplosionEffects();
  updateGroundHazards();
  updateDeathParticles();
  checkPlayerDeath();
}

// Finds a walkable tile near a given map edge, searching inward if the exact
// edge is blocked (e.g. maps with a perimeter wall). Without this, spawn
// selection that only ever tries the literal edge coordinate (0, width-1,
// etc) silently fails forever on any map with a border wall - nothing ever
// spawns, since every attempt lands on a blocked tile.
function findEdgeSpawnTile(side) {
  const maxCols = Math.floor(canvasWidth / TILE_SIZE);
  const maxRows = Math.floor(canvasHeight / TILE_SIZE);
  const maxSearch = 8;

  if (side === 0) { // left edge, searching rightward
    const ty = Math.floor(Math.random() * maxRows);
    for (let tx = 0; tx < maxSearch && tx < maxCols; tx++) if (map.isWalkable(tx, ty)) return [tx, ty];
  } else if (side === 1) { // right edge, searching leftward
    const ty = Math.floor(Math.random() * maxRows);
    for (let tx = maxCols - 1; tx >= 0 && tx > maxCols - 1 - maxSearch; tx--) if (map.isWalkable(tx, ty)) return [tx, ty];
  } else if (side === 2) { // top edge, searching downward
    const tx = Math.floor(Math.random() * maxCols);
    for (let ty = 0; ty < maxSearch && ty < maxRows; ty++) if (map.isWalkable(tx, ty)) return [tx, ty];
  } else { // bottom edge, searching upward
    const tx = Math.floor(Math.random() * maxCols);
    for (let ty = maxRows - 1; ty >= 0 && ty > maxRows - 1 - maxSearch; ty--) if (map.isWalkable(tx, ty)) return [tx, ty];
  }
  return null;
}

function spawnWave() {
  if (!player) return;
  if (currentMapTier >= 2) { spawnWaveTier2(); return; }
  for (let i = 0; i < 8; i++) {
    const side = Math.floor(4 * Math.random());
    const pos = findEdgeSpawnTile(side);
    if (!pos) continue;
    const [tx, ty] = pos;

    if (Math.abs(tx - player.x) + Math.abs(ty - player.y) < 5) continue;

    if (player.level >= 40 && Math.random() < 0.02 && !enemies.some(en => en.type === "lateBoss")) {
      const boss = new Enemy(tx, ty, 15, "lateBoss");
      boss.maxHp = 1000 + 50 * difficulty;
      boss.hp = boss.maxHp;
      boss.touchDamage = 25 + 5 * difficulty;
      boss.speed = 1.5 * ENEMY_SPEED_SCALE;
      boss.entryDelay = 60;
      boss.isLateBoss = true;
      enemies.push(boss);
      return;
    }

    if (Math.random() < 0.02 && !enemies.some(en => en.type === "boss")) {
      const types = ["mega", "storm", "berserk"];
      const t = types[Math.floor(Math.random() * types.length)];
      enemies.push(spawnBoss(tx, ty, t, false, 18));
      return;
    }

    if (Math.random() < 0.04) {
      const types = ["classic", "rain", "tracking"];
      const t = types[Math.floor(Math.random() * types.length)];
      enemies.push(spawnMiniBoss(tx, ty, t, 20));
      return;
    }

    let type = "normal", spriteIdx = 0;
    const roll = Math.random();
    if (roll < 0.1) { type = "brute"; spriteIdx = 5; }
    else if (roll < 0.2) { type = "shooter"; spriteIdx = 8; }
    else if (roll < 0.3) { type = "fast"; spriteIdx = 50; }
    else if (roll < 0.4) { type = "tank"; spriteIdx = 4; }
    else if (roll < 0.5) { type = "spitter"; spriteIdx = 10; }
    else if (roll < 0.6) { type = "bossling"; spriteIdx = 6; }
    else if (roll < 0.7) { type = "assassin"; spriteIdx = 7; }
    else if (roll < 0.8) { type = "wizard"; spriteIdx = 25; }
    else if (roll < 0.9) { type = "golem"; spriteIdx = 3; }
    else { type = "archer"; spriteIdx = 21; }

    const enemy = new Enemy(tx, ty, spriteIdx, type);
    switch (type) {
      case "assassin": enemy.aiType = "ambusher"; break;
      case "shooter": enemy.aiType = "ranged-kiter"; break;
      default: enemy.aiType = type;
    }
    switch (type) {
      case "brute": enemy.maxHp = 120 + 30 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 12 + 3 * difficulty; enemy.speed = 0.8; break;
      case "shooter": enemy.maxHp = 80 + 25 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 6 + 2 * difficulty; enemy.speed = 0.9; enemy.projectileSpeed = 3; enemy.fireCooldownMax = 120; enemy.fireCooldown = 0; enemy.fireProjectile = true; break;
      case "fast": enemy.maxHp = 40 + 10 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 4 + difficulty; enemy.speed = 1.8; break;
      case "tank": enemy.maxHp = 150 + 50 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 10 + 2 * difficulty; enemy.speed = 0.6; break;
      case "spitter": enemy.maxHp = 60 + 20 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 3 + difficulty; enemy.speed = 1; enemy.projectileSpeed = 2.5; enemy.fireCooldownMax = 90; enemy.fireCooldown = 0; enemy.fireProjectile = true; break;
      case "bossling": enemy.maxHp = 200 + 50 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 15 + 4 * difficulty; enemy.speed = 1; enemy.projectileSpeed = 3; enemy.fireCooldownMax = 100; enemy.fireCooldown = 0; enemy.fireProjectile = true; break;
      case "assassin": enemy.maxHp = 50 + 15 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 8 + 2 * difficulty; enemy.speed = 2; break;
      case "wizard": enemy.maxHp = 40 + 10 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 6 + 2 * difficulty; enemy.speed = 1.2; enemy.projectileSpeed = 3.5; enemy.fireCooldownMax = 90; enemy.fireCooldown = 0; enemy.fireProjectile = true; break;
      case "golem": enemy.maxHp = 180 + 60 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 14 + 4 * difficulty; enemy.speed = 0.5; break;
      case "archer": enemy.maxHp = 70 + 20 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 5 + 1.5 * difficulty; enemy.speed = 1; enemy.projectileSpeed = 2.8; enemy.fireCooldownMax = 100; enemy.fireCooldown = 0; enemy.fireProjectile = true; break;
      default: enemy.maxHp = 50 + 15 * difficulty; enemy.hp = enemy.maxHp; enemy.touchDamage = 5 + 1.5 * difficulty; enemy.speed = 1;
    }
    enemy.speed *= ENEMY_SPEED_SCALE;
    enemy.entryDelay = 30;
    enemies.push(enemy);
  }
}

// --- Shared "Deep Zone" roster used by every tier from 2 upward, scaled by
// each tier's zonePower and layered with that tier's rarity modifier table
// (see MAP_TIERS). NOTE: sprite indices 30-36 are new - make sure
// assets/enemy.png has frames there, or these enemies will fall back to
// plain red squares (still fully functional, just unstyled) until art is added.
function spawnWaveTier2() {
  const cfg = tierConfig(currentMapTier);
  const zp = cfg.zonePower;
  const spawnCount = cfg.extraSpawns ? 14 : 8;

  for (let i = 0; i < spawnCount; i++) {
    const side = Math.floor(4 * Math.random());
    const pos = findEdgeSpawnTile(side);
    if (!pos) continue;
    const [tx, ty] = pos;

    if (Math.abs(tx - player.x) + Math.abs(ty - player.y) < 5) continue;

    // Rare, brutal boss - noticeably stronger than anything in the first zone
    if (Math.random() < 0.015 && !enemies.some(en => en.type === "boss")) {
      const types = ["mega", "storm", "berserk"];
      const t = types[Math.floor(Math.random() * types.length)];
      enemies.push(spawnBoss(tx, ty, t, true, 19, 2.2 * zp));
      continue;
    }

    if (Math.random() < 0.05 && !enemies.some(en => en.isMiniBoss)) {
      const types = ["classic", "rain", "tracking"];
      const t = types[Math.floor(Math.random() * types.length)];
      enemies.push(spawnMiniBoss(tx, ty, t, 26, 2 * zp));
      continue;
    }

    // Swarm burst: a pack of fast little threats instead of a single enemy
    if (Math.random() < 0.15) {
      for (let s = 0; s < 3; s++) {
        const ox = tx + Math.floor(Math.random() * 3) - 1;
        const oy = ty + Math.floor(Math.random() * 3) - 1;
        if (!map.isWalkable(ox, oy)) continue;
        const swarmling = new Enemy(ox, oy, 33, "swarmling");
        swarmling.aiType = "swarmling";
        swarmling.maxHp = Math.round((35 + 10 * difficulty) * zp);
        swarmling.hp = swarmling.maxHp;
        swarmling.touchDamage = Math.round((6 + 2 * difficulty) * zp);
        swarmling.speed = 2.3 * ENEMY_SPEED_SCALE;
        swarmling.entryDelay = 20;
        enemies.push(swarmling);
      }
      continue;
    }

    let type = "reaper", spriteIdx = 30;
    const roll = Math.random();
    if (roll < 0.2) { type = "reaper"; spriteIdx = 30; }        // sniper AI: kites at range, hard-hitting shots
    else if (roll < 0.4) { type = "juggernaut"; spriteIdx = 31; }  // berserker AI: slow tank that enrages
    else if (roll < 0.6) { type = "voidcaster"; spriteIdx = 32; }  // homing casters
    else if (roll < 0.78) { type = "phantom"; spriteIdx = 35; }    // ambusher AI, hits hard
    else { type = "warlock"; spriteIdx = 36; }                     // ranged-kiter AI: closes in, explodes on death, also casts

    const enemy = new Enemy(tx, ty, spriteIdx, type);
    switch (type) {
      case "reaper": enemy.aiType = "sniper"; break;
      case "juggernaut": enemy.aiType = "berserker"; break;
      case "phantom": enemy.aiType = "ambusher"; break;
      case "warlock": enemy.aiType = "ranged-kiter"; break;
      default: enemy.aiType = type;
    }

    switch (type) {
      case "reaper":
        enemy.maxHp = Math.round((90 + 30 * difficulty) * zp); enemy.hp = enemy.maxHp;
        enemy.touchDamage = Math.round((18 + 4 * difficulty) * zp); enemy.speed = 1.1;
        enemy.projectileSpeed = 5.5; enemy.fireCooldownMax = 70; enemy.fireCooldown = 0; enemy.fireProjectile = true;
        break;
      case "juggernaut":
        enemy.maxHp = Math.round((400 + 80 * difficulty) * zp); enemy.hp = enemy.maxHp;
        enemy.touchDamage = Math.round((20 + 5 * difficulty) * zp); enemy.speed = 0.55;
        break;
      case "voidcaster":
        enemy.maxHp = Math.round((150 + 40 * difficulty) * zp); enemy.hp = enemy.maxHp;
        enemy.touchDamage = Math.round((10 + 3 * difficulty) * zp); enemy.speed = 1;
        enemy.projectileSpeed = 4.5; enemy.fireCooldownMax = 85; enemy.fireCooldown = 0; enemy.fireProjectile = true;
        break;
      case "phantom":
        enemy.maxHp = Math.round((120 + 35 * difficulty) * zp); enemy.hp = enemy.maxHp;
        enemy.touchDamage = Math.round((18 + 4 * difficulty) * zp); enemy.speed = 2.2;
        break;
      case "warlock":
        enemy.maxHp = Math.round((200 + 45 * difficulty) * zp); enemy.hp = enemy.maxHp;
        enemy.touchDamage = Math.round((14 + 3 * difficulty) * zp); enemy.speed = 1;
        enemy.projectileSpeed = 4; enemy.fireCooldownMax = 100; enemy.fireCooldown = 0; enemy.fireProjectile = true;
        break;
    }
    enemy.speed *= ENEMY_SPEED_SCALE;

    // Roll a rarity modifier per this tier's table (null on tier 1, which
    // never calls this function anyway). Bigger, tougher, worth much more.
    const rarity = rollRarity(cfg.rarity);
    if (rarity) applyRarity(enemy, rarity);

    enemy.entryDelay = 30;
    enemies.push(enemy);
  }
}

function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.entryDelay > 0) { enemy.entryDelay--; continue; }

    enemy.update(player, frameCount, projectiles, groundHazards);
    map.applyTileEffects(enemy, Math.floor(enemy.px / TILE_SIZE), Math.floor(enemy.py / TILE_SIZE));

    const firingTypes = ["shooter", "spitter", "wizard", "archer", "bossling", "reaper", "voidcaster", "warlock"];
    if (firingTypes.includes(enemy.type) && enemy.fireCooldown <= 0) {
      const dx = player.px + TILE_SIZE / 2 - (enemy.px + TILE_SIZE / 2);
      const dy = player.py + TILE_SIZE / 2 - (enemy.py + TILE_SIZE / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const spd = enemy.projectileSpeed || 3;
      const vx = (dx / dist) * spd;
      const vy = (dy / dist) * spd;

      let type = "normal", range = 150;
      switch (enemy.type) {
        case "spitter": type = "bouncing"; range = 120; break;
        case "wizard": type = "homing"; range = 180; break;
        case "archer": type = "spread"; range = 200; break;
        case "bossling": type = "heavy"; range = 250; break;
        case "reaper": type = "heavy"; range = 320; break;
        case "voidcaster": type = "homing"; range = 260; break;
        case "warlock": type = "spread"; range = 220; break;
      }

      projectiles.push(new Projectile(
        enemy.px + TILE_SIZE / 2, enemy.py + TILE_SIZE / 2, vx, vy,
        0.8 * enemy.touchDamage, 60, 1, type, range, enemy
      ));
      enemy.fireCooldown = enemy.fireCooldownMax;
    }

    if (enemy.hp <= 0) {
      let goldDrop = enemy.isMiniBoss ? Math.floor(50 + 5 * difficulty) : Math.floor(5 + 2 * difficulty);
      let xpValue = enemy.isMiniBoss ? 10 + Math.floor(difficulty / 2) : 1 + Math.floor(difficulty / 2);
      goldDrop = Math.round(goldDrop * (enemy.goldMult || 1) * (player._metaGoldMult || 1));
      xpValue = Math.round(xpValue * (enemy.xpMult || 1) * (player._metaXpMult || 1));
      const particleCount = 2 + Math.floor(3 * Math.random());

      for (let p = 0; p < particleCount; p++) {
        deathParticles.push({
          x: enemy.px + (Math.random() - 0.5) * TILE_SIZE,
          y: enemy.py + (Math.random() - 0.5) * TILE_SIZE,
          life: 30 + Math.floor(30 * Math.random()),
          frame: Math.floor(8 * Math.random()),
          frameTimer: 0,
          frameSpeed: 4 + Math.floor(3 * Math.random())
        });
      }

      if (Math.random() < 0.15) xpOrbs.push({ x: enemy.px + TILE_SIZE / 2, y: enemy.py + TILE_SIZE / 2, r: 6, value: 3 * xpValue, mega: true });
      else xpOrbs.push({ x: enemy.px + TILE_SIZE / 2, y: enemy.py + TILE_SIZE / 2, r: 4, value: xpValue, mega: false });

      player.gold += goldDrop;
      enemies.splice(i, 1);
    } else if (enemy.remove) {
      enemies.splice(i, 1);
    }
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (!(proj instanceof Projectile)) { projectiles.splice(i, 1); continue; }

    proj.update(enemies, { width: canvasWidth, height: canvasHeight }, projectiles);

    const dx = proj.x - (proj.startX ?? proj.x);
    const dy = proj.y - (proj.startY ?? proj.y);
    if (proj.maxDistance && Math.hypot(dx, dy) >= proj.maxDistance) { projectiles.splice(i, 1); continue; }

    if (proj.owner === player) {
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const enemy = enemies[ei];
        if (!proj.canDamage(enemy)) continue;
        const hb = getEnemyHitbox(enemy);
        if (!rectCircleCollide(proj.x, proj.y, proj.radius, hb.x, hb.y, hb.size, hb.size)) continue;

        let hitDamage = 1.5 * proj.damage;
        const isCrit = Math.random() < (player.critChance || 0);
        if (isCrit) hitDamage *= 2;
        hitDamage = Math.floor(hitDamage);

        const baseDamage = proj.damage;
        proj.damage = hitDamage;
        proj.dealDamage(enemy, projectiles, enemies);
        proj.damage = baseDamage;

        damageTexts.push({
          x: enemy.px + TILE_SIZE / 2, y: enemy.py,
          value: hitDamage, life: 30,
          color: isCrit ? "#ff0" : "#fff",
          font: isCrit ? "bold 18px sans-serif" : "16px sans-serif",
          crit: isCrit
        });

        if (player.projectileExplosion) {
          const radius = 60;
          explosions.push({ x: proj.x, y: proj.y, radius, life: 20, maxLife: 20 });
          for (const other of enemies) {
            if (other === enemy) continue;
            if (Math.hypot(other.px + TILE_SIZE / 2 - proj.x, other.py + TILE_SIZE / 2 - proj.y) <= radius) {
              const splashDmg = Math.floor(0.5 * hitDamage);
              other.hp -= splashDmg;
              if (player.healFromDamage) player.healFromDamage(splashDmg);
              damageTexts.push({ x: other.px + TILE_SIZE / 2, y: other.py, value: splashDmg, life: 20, color: "#f66", font: "14px sans-serif" });
              other.flashTimer = 5;
            }
          }
        }

        if (proj.pierce <= 0) break;
      }
    } else if (rectCircleCollide(proj.x, proj.y, proj.radius, player.px, player.py, TILE_SIZE, TILE_SIZE)) {
      if (typeof player.takeDamage === "function") player.takeDamage(proj.damage);
      projectiles.splice(i, 1);
      continue;
    }

    if (proj.life <= 0 || proj.pierce <= 0) projectiles.splice(i, 1);
  }
}

function updatePickups() {
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    const dx = player.px + TILE_SIZE / 2 - orb.x;
    const dy = player.py + TILE_SIZE / 2 - orb.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.pickupRange) {
      orb.x += (dx / Math.max(dist, 1)) * 3;
      orb.y += (dy / Math.max(dist, 1)) * 3;
    }
    if (dist < 8) {
      player.gainXp(orb.value, onLevelUp);
      player.gold += orb.value;
      xpOrbs.splice(i, 1);
    }
  }
}

function updateDamageTexts() {
  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const t = damageTexts[i];
    t.y -= 0.5;
    t.life--;
    if (t.life <= 0) damageTexts.splice(i, 1);
  }
}

function updateExplosionEffects() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life--;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }
}

function updateGroundHazards() {
  for (let i = groundHazards.length - 1; i >= 0; i--) {
    const h = groundHazards[i];
    h.life--;
    if (h.life <= 0) { groundHazards.splice(i, 1); continue; }

    h.tickTimer--;
    if (h.tickTimer <= 0 && player) {
      const dist = Math.hypot(player.px + TILE_SIZE / 2 - h.x, player.py + TILE_SIZE / 2 - h.y);
      if (dist <= h.radius) {
        player.takeDamage(h.damage);
        h.tickTimer = h.tickInterval;
      } else {
        h.tickTimer = 6; // player's outside it for now, recheck again soon
      }
    }
  }
}

function updateDeathParticles() {
  for (let i = deathParticles.length - 1; i >= 0; i--) {
    const p = deathParticles[i];
    p.life--;
    if (p.life <= 0) { deathParticles.splice(i, 1); continue; }
    p.frameTimer++;
    if (p.frameTimer >= p.frameSpeed) { p.frame = (p.frame + 1) % 8; p.frameTimer = 0; }
  }
}

function checkPlayerDeath() {
  if (player.hp <= 0 && !isDead) {
    isDead = true;
    lastRun = { level: player.level, gold: player.gold, time: Math.floor(frameCount / 60) };
    const earned = awardRunEssence({ level: player.level, mapTier: currentMapTier, gold: player.gold });
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    const overlay = document.getElementById("deathOverlay");
    if (overlay) overlay.style.display = "flex";
    const essenceLabel = document.getElementById("essenceEarned");
    if (essenceLabel) essenceLabel.textContent = `+${earned} Essence earned (Total: ${getMeta().essence})`;
  }
}

// ============================================================
// Render
// ============================================================
function render() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  let shakeX = 0, shakeY = 0;
  if (player?.contactIFrames > 0) {
    const t = player.contactIFrames / 30;
    shakeX = (Math.random() - 0.5) * 6 * t;
    shakeY = (Math.random() - 0.5) * 6 * t;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  map.draw(ctx); // note: map.draw() ends by calling drawRain() itself

  ctx.save();
  for (const p of deathParticles) {
    const sx = p.frame * EFFECT_FRAME_SIZE;
    ctx.drawImage(effectsSheet, sx, 0, EFFECT_FRAME_SIZE, EFFECT_FRAME_SIZE, p.x, p.y, TILE_SIZE, TILE_SIZE);
  }
  ctx.restore();

  ctx.save();
  for (const orb of xpOrbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fillStyle = orb.mega ? "#ff0" : "#3cf";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (const h of groundHazards) {
    const t = h.life / h.maxLife;
    const drew = drawEffect(ctx, "explosionBurst", h.x, h.y, h.radius * 2, 0, "#ff3300", 0.55, Math.min(1, t * 1.5));
    if (!drew) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 60, 20, ${0.3 * t})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 150, 0, ${0.5 * t})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();

  enemies.forEach(enemy => {
    if (enemy.isMiniBoss && Array.isArray(enemy.rainTelegraph) && enemy.rainTelegraph.length > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
      enemy.rainTelegraph.forEach(t => { ctx.beginPath(); ctx.arc(t.x, t.y, 6, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    }
    enemy.draw(ctx);
  });

  if (player) {
    player.draw(ctx);
    drawGuardianShield(ctx, player);
  }

  ctx.save();
  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const t = damageTexts[i];
    ctx.fillStyle = t.color ?? "#fff";
    ctx.font = t.font ?? "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.value, t.x, t.y);
    if (t.crit) { ctx.fillStyle = "#ff0"; ctx.font = "bold 14px sans-serif"; ctx.fillText("Crit!", t.x, t.y - 16); }
  }
  ctx.restore();

  ctx.save();
  for (const e of explosions) {
    const t = e.life / e.maxLife;
    const size = e.radius * (1 - 0.5 * t) * 2.2;
    const drew = drawEffect(ctx, e.sprite || "explosionBurst", e.x, e.y, size, 0, e.tint || null, 0.75, Math.min(1, t * 1.4));
    if (!drew) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1 - 0.5 * t), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 0, ${0.4 * t})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 200, 0, ${0.6 * t})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  for (const p of projectiles) if (p instanceof Projectile) p.draw(ctx);
  ctx.restore();

  ctx.restore();

  if (damageFlash === undefined) damageFlash = 0;
  if (damageFlash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,0,0,${damageFlash})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
    damageFlash -= 0.02;
    if (damageFlash < 0) damageFlash = 0;
  }

  if (warpMessageTimer > 0 && player) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvasHeight / 2 - 50, canvasWidth, 100);
    ctx.fillStyle = "#9fe0ff";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(warpMessage, canvasWidth / 2, canvasHeight / 2 + 10);
    ctx.restore();
    if (warpMessageTimer < 999999) warpMessageTimer--;
  }

  if (paused && !uiOpen && player) {
    ctx.fillStyle = "rgba(5,6,10,0.72)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const boxW = 460, boxH = 260;
    const boxX = canvasWidth / 2 - boxW / 2, boxY = canvasHeight / 2 - boxH / 2;
    ctx.save();
    ctx.fillStyle = "rgba(18,20,31,0.92)";
    ctx.strokeStyle = "#a9812f";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(169,129,47,0.35)";
    ctx.lineWidth = 1;
    roundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 9);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#e8c766";
    ctx.font = "bold 26px Cinzel, serif";
    ctx.textAlign = "center";
    ctx.fillText("Paused", canvasWidth / 2, boxY + 44);

    ctx.fillStyle = "#ece4cf";
    ctx.font = "15px Inter, sans-serif";
    ctx.fillText(`Current Run — Lv ${player.level} · ${player.gold} Gold · ${(frameCount / 60).toFixed(0)}s`, canvasWidth / 2, boxY + 78);
    if (lastRun) {
      ctx.fillStyle = "#8890a6";
      ctx.font = "13px Inter, sans-serif";
      ctx.fillText(`Last Run — Lv ${lastRun.level} · ${lastRun.gold} Gold · ${lastRun.time}s`, canvasWidth / 2, boxY + 100);
    }

    ctx.strokeStyle = "rgba(169,129,47,0.3)";
    ctx.beginPath();
    ctx.moveTo(boxX + 40, boxY + 120);
    ctx.lineTo(boxX + boxW - 40, boxY + 120);
    ctx.stroke();

    ctx.fillStyle = "#8890a6";
    ctx.font = "13px Inter, sans-serif";
    const controlLines = [
      "WASD / Arrows — Move      Space — Attack",
      "K — Shop      L — Skill Tree      Shift — Blink",
      "Esc — Resume"
    ];
    controlLines.forEach((line, i) => ctx.fillText(line, canvasWidth / 2, boxY + 150 + i * 24));
  }

  if (player) {
    camera.x = player.px + TILE_SIZE / 2 - canvasWidth / (2 * camera.zoom);
    camera.y = player.py + TILE_SIZE / 2 - canvasHeight / (2 * camera.zoom);
    camera.x = Math.max(0, Math.min(camera.x, map.width * TILE_SIZE - canvasWidth / camera.zoom));
    camera.y = Math.max(0, Math.min(camera.y, map.height * TILE_SIZE - canvasHeight / camera.zoom));
  }

  updateHUD();
}

function updateHUD() {
  if (!player) return;
  const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100));
  hpBarFill.style.width = `${hpPct}%`;
  hpLabel.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  xpBarFill.style.width = `${xpPct}%`;
  xpLabel.textContent = `Lv ${player.level} · ${player.xp}/${player.xpToNext}${player.skillPoints ? ` · ${player.skillPoints} SP` : ""}`;
  goldLabel.textContent = `🪙 ${player.gold}`;
  statsLabel.textContent = `DMG ${player.damage} · ROF ${(60 / player.fireCooldownMax).toFixed(1)}/s · SPD ${player.speed.toFixed(1)}`;
}

// ============================================================
// Boot
// ============================================================
window.addEventListener("load", () => {
  try {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    map.load(MAP1_PATH).then(() => showCharacterSelect()).catch(err => {
      console.error("Failed to load map:", err);
      const container = document.getElementById("characterSelect");
      if (container) {
        container.classList.add("panel");
        container.style.display = "block";
        container.innerHTML = `<h2 style="color:#ff6b6b;">Failed to load</h2><p style="color:var(--text-dim); font-size:13px;">Could not load the map. Check your connection and reload the page.</p><button class="btn" onclick="location.reload()">Reload</button>`;
      }
    });

    canvas.addEventListener("mousemove", e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    canvas.addEventListener("click", () => {
      if (isDead) showCharacterSelect();
    });

    ensureSkillTreeUI();

    // Wire the on-screen Shop / Skill Tree buttons (added in index.html)
    const shopBtn = document.getElementById("shopBtn");
    if (shopBtn) shopBtn.addEventListener("click", openShop);

    const skillsBtn = document.getElementById("skillsBtn");
    if (skillsBtn) skillsBtn.addEventListener("click", () => {
      if (skillTreeOpen) closeSkillTree();
      else if (!isDead) openSkillTree();
    });

    const mobileShopBtn = document.getElementById("btnShop");
    if (mobileShopBtn) mobileShopBtn.addEventListener("touchstart", e => { e.preventDefault(); openShop(); });

    const mobileSkillsBtn = document.getElementById("btnSkills");
    if (mobileSkillsBtn) mobileSkillsBtn.addEventListener("touchstart", e => {
      e.preventDefault();
      if (skillTreeOpen) closeSkillTree();
      else if (!isDead) openSkillTree();
    });

    const mobileBlinkBtn = document.getElementById("btnSpecial");
    if (mobileBlinkBtn) mobileBlinkBtn.addEventListener("touchstart", e => {
      e.preventDefault();
      if (player && player.unlockedSkills.includes("blink") && player.blinkCharges > 0 && !uiOpen) doBlink();
    });

    setupJoystick();
  } catch (err) {
    console.error("Boot sequence error:", err);
  }
});

// ============================================================
// Mobile joystick - replaces the old 4-button D-pad. Drags map to one of
// the 4 cardinal directions (the movement system is grid-based and only
// understands up/down/left/right, same as arrow keys), with a small
// deadzone near center so tiny jitters don't register as input.
//
// Uses Pointer Events + setPointerCapture rather than raw touch events:
// once a pointer is captured, every subsequent move/up for that exact
// pointer is routed straight to this element automatically, so there's no
// need to track touch identifiers manually or attach listeners to window.
// ============================================================
function setupJoystick() {
  try {
    const base = document.getElementById("joystickBase");
    const knob = document.getElementById("joystickKnob");
    if (!base || !knob) return;

    const maxRadius = 38;
    const deadzone = 12;
    let activePointerId = null;

    function clearDirections() {
      if (!player) return;
      player.inputKeys["arrowup"] = false;
      player.inputKeys["arrowdown"] = false;
      player.inputKeys["arrowleft"] = false;
      player.inputKeys["arrowright"] = false;
    }

    function setDirection(dx, dy) {
      if (!player) return;
      clearDirections();
      if (Math.hypot(dx, dy) < deadzone) return;
      const deg = Math.atan2(dy, dx) * 180 / Math.PI; // 0=right, 90=down, ±180=left, -90=up
      if (deg >= -45 && deg < 45) player.inputKeys["arrowright"] = true;
      else if (deg >= 45 && deg < 135) player.inputKeys["arrowdown"] = true;
      else if (deg >= -135 && deg < -45) player.inputKeys["arrowup"] = true;
      else player.inputKeys["arrowleft"] = true;
    }

    function updateKnobVisual(dx, dy) {
      const dist = Math.min(Math.hypot(dx, dy), maxRadius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * dist, ky = Math.sin(angle) * dist;
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    }

    function resetKnob() { knob.style.transform = "translate(-50%, -50%)"; }

    function handleMove(clientX, clientY) {
      const rect = base.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      updateKnobVisual(dx, dy);
      setDirection(dx, dy);
    }

    base.addEventListener("pointerdown", e => {
      e.preventDefault();
      activePointerId = e.pointerId;
      if (base.setPointerCapture) {
        try { base.setPointerCapture(e.pointerId); } catch (err) { /* ignore capture failures */ }
      }
      handleMove(e.clientX, e.clientY);
    });

    base.addEventListener("pointermove", e => {
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    });

    function releasePointer(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      resetKnob();
      clearDirections();
    }
    base.addEventListener("pointerup", releasePointer);
    base.addEventListener("pointercancel", releasePointer);
    base.addEventListener("lostpointercapture", releasePointer);
  } catch (err) {
    console.error("Joystick setup failed:", err);
  }
}