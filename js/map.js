export const TILE_SIZE = 32;
const TILES_PER_ROW = 1024 / TILE_SIZE;

// --- Load all tilesets ---
const tilesetImages = [];
for (let i = 0; i <= 5; i++) {
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
    groundAnim: [], // animation layer
    objects: []
  },
  animFrame: 0,        // current animation frame
  animTicker: 0,       // counts ticks for animation
  animSpeed: 60,       // frames per switch (1 per second at 60fps)

  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load map: ${path}`);
    const json = await res.json();

    this.width = json.width;
    this.height = json.height;
    this.layers.ground = json.layers.ground;
    this.layers.groundAnim = json.layers.groundAnim || [];
    this.layers.objects = json.layers.objects;

    // Initialize missing attributes and default tileset index
    ["ground", "groundAnim", "objects"].forEach(layerName => {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const tile = this.layers[layerName][y]?.[x];
          if (!tile) continue;
          if (!tile.attributes) tile.attributes = { walkable: true };
          if (tile.attributes.walkable === undefined) tile.attributes.walkable = true;
          if (tile.attributes.blocker === undefined) tile.attributes.blocker = false;
          if (tile.attributes.damage === undefined) tile.attributes.damage = false;
          if (tile.attributes.healing === undefined) tile.attributes.healing = false;
          if (tile.attributes.trigger === undefined) tile.attributes.trigger = false;
          if (tile.tileset === undefined) tile.tileset = 0; // default to first tileset
        }
      }
    });
  },

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;

    const ground = this.layers.ground[y][x];
    const obj = this.layers.objects[y][x];

    if (ground && ground.attributes) {
      if (ground.attributes.blocker) return false;
      if (ground.attributes.walkable === false) return false;
    }
    if (obj && obj.attributes) {
      if (obj.attributes.blocker) return false;
      if (obj.attributes.walkable === false) return false;
    }

    return true;
  },

 applyTileEffects(entity, x, y) {
  const ground = this.layers.ground[y]?.[x];
  const obj = this.layers.objects[y]?.[x];

  [ground, obj].forEach(tile => {
    if (!tile || !tile.attributes) return;
    if (tile.attributes.damage) entity.hp -= 10;
    if (tile.attributes.healing) entity.hp = Math.min(entity.hp + 10, entity.maxHp);
  });
}, // <--- COMMA HERE

updateAnimation() {
  this.animTicker++;
  if (this.animTicker >= this.animSpeed) {
    this.animFrame = (this.animFrame + 1) % 2; // flicker between 0 and 1
    this.animTicker = 0;
  }
},



 draw(ctx) {
  if (!this.layers.ground) return;

  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      const baseTile = this.layers.ground[y][x]; // static ground
      const animTile = this.layers.groundAnim[y]?.[x]; // animated overlay

      let tileToDraw = baseTile;

      if (animTile && Array.isArray(animTile.tileId)) {
        // Only draw the animated tile on even animFrames, otherwise show baseTile
        if (this.animFrame % 2 === 1) {
          tileToDraw = { tileId: animTile.tileId[this.animFrame % animTile.tileId.length], tileset: animTile.tileset ?? 0 };
        }
      }

      if (!tileToDraw) continue;

      const tsIndex = tileToDraw.tileset ?? 0;
      const ts = tilesetImages[tsIndex];

      const sx = (tileToDraw.tileId % TILES_PER_ROW) * TILE_SIZE;
      const sy = Math.floor(tileToDraw.tileId / TILES_PER_ROW) * TILE_SIZE;

      ctx.drawImage(
        ts,
        sx, sy, TILE_SIZE, TILE_SIZE,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE
      );
    }
  }

  // Draw objects on top
  const objects = this.layers.objects;
  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      const tile = objects[y][x];
      if (!tile) continue;

      const tsIndex = tile.tileset ?? 0;
      const ts = tilesetImages[tsIndex];

      const sx = (tile.tileId % TILES_PER_ROW) * TILE_SIZE;
      const sy = Math.floor(tile.tileId / TILES_PER_ROW) * TILE_SIZE;

      ctx.drawImage(
        ts,
        sx, sy, TILE_SIZE, TILE_SIZE,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE
      );
    }
  }
}


};
