export const TILE_SIZE = 32;

// --- Load all tilesets ---
const tilesetImages = [];
for (let i = 0; i <= 10; i++) {  // <-- change 5 → 10
  const img = new Image();
  img.src = `assets/tileset${i === 0 ? "" : i}.png`;
  tilesetImages.push(img);
}


// Attributes
export const ATTRIBUTE_KEYS = ["walkable", "damage", "trigger", "healing", "blocker"];
export const ATTRIBUTE_LETTERS = { walkable: "W", damage: "D", trigger: "T", healing: "H", blocker: "B" };

export const map = {
  width: 0,
  height: 0,
  layers: {
  ground: [],
  groundAnim: [],
  objects: [],
  objectAnim: [],
  object2: [],       
  object2Anim: []    
},

  animFrame: 0,
  animTicker: 0,
  animSpeed: 60, // ticks per switch

  async load(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load map: ${path}`);
  const json = await res.json();

  this.width = json.width;
  this.height = json.height;
  this.layers.ground = json.layers.ground || [];
  this.layers.groundAnim = json.layers.groundAnim || [];
  this.layers.objects = json.layers.objects || [];
  this.layers.objectAnim = json.layers.objectAnim || [];
  this.layers.object2 = json.layers.object2 || [];       // NEW
  this.layers.object2Anim = json.layers.object2Anim || []; // NEW

  // Ensure arrays have full rows/cols and initialize attributes
  ["ground","groundAnim","objects","objectAnim","object2","object2Anim"].forEach(layerName => {
    if (!this.layers[layerName]) this.layers[layerName] = [];
    for (let y = 0; y < this.height; y++) {
      if (!this.layers[layerName][y]) this.layers[layerName][y] = [];
      for (let x = 0; x < this.width; x++) {
        if (typeof this.layers[layerName][y][x] === "undefined") {
          this.layers[layerName][y][x] = null;
          continue;
        }
        const tile = this.layers[layerName][y][x];
        if (!tile) continue;
        if (!tile.attributes) tile.attributes = {};
        const attr = tile.attributes;
        if (attr.walkable === undefined) attr.walkable = true;
        if (attr.blocker === undefined) attr.blocker = false;
        if (attr.damage === undefined) attr.damage = false;
        if (attr.healing === undefined) attr.healing = false;
        if (attr.trigger === undefined) attr.trigger = false;
        if (tile.tileset === undefined) tile.tileset = 0;
      }
    }
  });
},


  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const ground = this.layers.ground[y]?.[x];
    const obj = this.layers.objects[y]?.[x];

    if (ground?.attributes) {
      if (ground.attributes.blocker) return false;
      if (ground.attributes.walkable === false) return false;
    }
    if (obj?.attributes) {
      if (obj.attributes.blocker) return false;
      if (obj.attributes.walkable === false) return false;
    }
    return true;
  },

  applyTileEffects(entity, x, y) {
    const ground = this.layers.ground[y]?.[x];
    const obj = this.layers.objects[y]?.[x];

    [ground, obj].forEach(tile => {
      if (!tile?.attributes) return;
      if (tile.attributes.damage) entity.hp -= 10;
      if (tile.attributes.healing) entity.hp = Math.min(entity.hp + 10, entity.maxHp);
    });
  },

  updateAnimation() {
    this.animTicker++;
    if (this.animTicker >= this.animSpeed) {
      this.animFrame = (this.animFrame + 1) % 2;
      this.animTicker = 0;
    }
  },

  draw(ctx) {
  if (!this.layers.ground) return;

  const renderOrder = ["ground","groundAnim","objects","objectAnim","object2","object2Anim"]; // object2 layers on top

  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      let tileToDraw = null;

      // Determine which tile to draw for objects/animations
      const baseObj = this.layers.objects[y]?.[x];
      const animObj = this.layers.objectAnim[y]?.[x];
      const baseObj2 = this.layers.object2[y]?.[x];         // NEW
      const animObj2 = this.layers.object2Anim[y]?.[x];     // NEW

      // Always draw object2 layers on top if present
      if (baseObj2 && animObj2) tileToDraw = (this.animFrame % 2 === 0) ? baseObj2 : animObj2;
      else if (animObj2) tileToDraw = animObj2;
      else if (baseObj2) tileToDraw = baseObj2;
      else if (baseObj && animObj) tileToDraw = (this.animFrame % 2 === 0) ? baseObj : animObj;
      else if (animObj) tileToDraw = animObj;
      else if (baseObj) tileToDraw = baseObj;

      // Draw ground and groundAnim first
      for (const layerName of ["ground","groundAnim"]) {
        let tile = this.layers[layerName][y]?.[x];
        if (!tile) continue;
        if (Array.isArray(tile.tileId)) {
          const idx = this.animFrame % tile.tileId.length;
          tile = { ...tile, tileId: tile.tileId[idx] };
        }
        this.drawTile(ctx, tile, x, y);
      }

      if (tileToDraw) {
        if (Array.isArray(tileToDraw.tileId)) {
          const idx = this.animFrame % tileToDraw.tileId.length;
          tileToDraw = { ...tileToDraw, tileId: tileToDraw.tileId[idx] };
        }
        this.drawTile(ctx, tileToDraw, x, y);
      }
    }
  }

  // --- Draw lights on all layers including object2 ---
  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      for (const layerName of ["ground","groundAnim","objects","objectAnim","object2","object2Anim"]) {
        const tile = this.layers[layerName][y]?.[x];
        if (!tile?.attributes?.light) continue;
        this.drawLight(ctx, tile, x, y);
      }
    }
  }
},



// --- helper functions ---
drawTile(ctx, tile, x, y) {
  const tsIndex = tile.tileset ?? 0;
  const ts = tilesetImages[tsIndex];
  if (!ts || !ts.complete || !ts.naturalWidth) return;

  const tilesPerRow = Math.max(1, Math.floor(ts.naturalWidth / TILE_SIZE));
  const sx = (tile.tileId % tilesPerRow) * TILE_SIZE;
  const sy = Math.floor(tile.tileId / tilesPerRow) * TILE_SIZE;

  ctx.drawImage(
    ts,
    sx, sy, TILE_SIZE, TILE_SIZE,
    x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE
  );
},

drawLight(ctx, tile, x, y) {
  const light = tile.attributes.light;
  if (light._last === undefined) light._last = light.brightness ?? 1.0;

  if (light.flicker) {
    light._last += (Math.random() - 0.5) * 0.05;
  } else {
    light._last += ((light.brightness ?? 1.0) - light._last) * 0.1;
  }

  const minB = 0.2 * (light.brightness ?? 1.0);
  const maxB = 1.0 * (light.brightness ?? 1.0);
  light._last = Math.max(minB, Math.min(maxB, light._last));

  const r = parseInt((light.color ?? "#ffffff").slice(1, 3), 16);
  const g = parseInt((light.color ?? "#ffffff").slice(3, 5), 16);
  const b = parseInt((light.color ?? "#ffffff").slice(5, 7), 16);

  const centerX = x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 3;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${light._last})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}


};
