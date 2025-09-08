export const TILE_SIZE = 32;

// --- Load all tilesets ---
const tilesetImages = [];
for (let i = 0; i <= 10; i++) {
  const img = new Image();
  img.src = `assets/tileset${i === 0 ? "" : i}.png`;
  tilesetImages.push(img);
}

// Attributes
export const ATTRIBUTE_KEYS = ["walkable", "damage", "trigger", "healing", "blocker"];
export const ATTRIBUTE_LETTERS = { walkable: "W", damage: "D", trigger: "T", healing: "H", blocker: "B" };

// --- Map ---
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

  weather: { type: "none", intensity: 100 },
  rainDrops: [],

  // --- Weather / Rain methods ---
  initRain(canvasWidth, canvasHeight) {
    this.rainDrops.length = 0;
    for (let i = 0; i < this.weather.intensity; i++) {
      this.rainDrops.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        length: 10 + Math.random() * 10,
        speed: 4 + Math.random() * 4
      });
    }
  },

  updateRain(canvasWidth, canvasHeight) {
    if (this.weather.type !== "rain") return;
    if (this.rainDrops.length !== this.weather.intensity) this.initRain(canvasWidth, canvasHeight);

    for (const drop of this.rainDrops) {
      drop.y += drop.speed;
      drop.x += Math.sin(drop.y * 0.05) * 2;
      if (drop.y > canvasHeight) {
        drop.y = -drop.length;
        drop.x = Math.random() * canvasWidth;
      }
    }
  },

  drawRain(ctx) {
    if (this.weather.type !== "rain") return;
    ctx.strokeStyle = "rgba(173,216,230,0.5)";
    ctx.lineWidth = 1;
    for (const drop of this.rainDrops) {
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.length * 0.2, drop.y + drop.length);
      ctx.stroke();
    }
  },

  async load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load map: ${path}`);
    const json = await res.json();

    this.width = json.width;
    this.height = json.height;
    ["ground","groundAnim","objects","objectAnim","object2","object2Anim"].forEach(layerName => {
      this.layers[layerName] = json.layers[layerName] || [];
      for (let y = 0; y < this.height; y++) {
        if (!this.layers[layerName][y]) this.layers[layerName][y] = [];
        for (let x = 0; x < this.width; x++) {
          let tile = this.layers[layerName][y][x];
          if (!tile) {
            this.layers[layerName][y][x] = null;
            continue;
          }
          if (!tile.attributes) tile.attributes = {};
          ATTRIBUTE_KEYS.forEach(key => {
            if (tile.attributes[key] === undefined) {
              tile.attributes[key] = key === "walkable" ? true : false;
            }
          });
          if (tile.tileset === undefined) tile.tileset = 0;
        }
      }
    });
  },

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const ground = this.layers.ground[y]?.[x];
    const obj = this.layers.objects[y]?.[x];
    const obj2 = this.layers.object2[y]?.[x];

    return ![ground, obj, obj2].some(tile => tile?.attributes?.blocker || tile?.attributes?.walkable === false);
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
      this.animFrame++;
      this.animTicker = 0;
      if (this.animFrame > 1000000) this.animFrame = 0;
    }
  },

  draw(ctx) {
    if (!this.layers.ground) return;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // --- Ground & GroundAnim ---
        ["ground","groundAnim"].forEach(layerName => {
          let tile = this.layers[layerName][y]?.[x];
          if (!tile) return;
          if (Array.isArray(tile.tileId) && tile.tileId.length > 0) {
            const frame = this.animFrame % tile.tileId.length;
            tile = { ...tile, tileId: tile.tileId[frame] };
          } else if (Array.isArray(tile.tileId) && tile.tileId.length === 0) {
            return;
          }
          this.drawTile(ctx, tile, x, y);
        });

        // --- Mid objects ---
        let baseObj = this.layers.objects[y]?.[x];
        let animObj = this.layers.objectAnim[y]?.[x];
        let objTile = baseObj && animObj ? (this.animFrame % 2 === 0 ? baseObj : animObj) : animObj || baseObj;
        if (objTile && Array.isArray(objTile.tileId) && objTile.tileId.length > 0)
          objTile = { ...objTile, tileId: objTile.tileId[this.animFrame % objTile.tileId.length] };
        if (objTile) this.drawTile(ctx, objTile, x, y);

        // --- Front objects ---
        let baseObj2 = this.layers.object2[y]?.[x];
        let animObj2 = this.layers.object2Anim[y]?.[x];
        let obj2Tile = baseObj2 && animObj2 ? (this.animFrame % 2 === 0 ? baseObj2 : animObj2) : animObj2 || baseObj2;
        if (obj2Tile && Array.isArray(obj2Tile.tileId) && obj2Tile.tileId.length > 0)
          obj2Tile = { ...obj2Tile, tileId: obj2Tile.tileId[this.animFrame % obj2Tile.tileId.length] };
        if (obj2Tile) this.drawTile(ctx, obj2Tile, x, y);
      }
    }

    // --- Lights ---
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        ["ground","groundAnim","objects","objectAnim","object2","object2Anim"].forEach(layerName => {
          const tile = this.layers[layerName][y]?.[x];
          if (tile?.attributes?.light) this.drawLight(ctx, tile, x, y);
        });
      }
    }

    // --- Draw rain after map ---
    this.drawRain(ctx);
  },

  drawTile(ctx, tile, x, y) {
    if (typeof tile.tileId !== "number") return;
    const tsIndex = tile.tileset ?? 0;
    const ts = tilesetImages[tsIndex];
    if (!ts || !ts.complete || !ts.naturalWidth) return;

    const tilesPerRow = Math.max(1, Math.floor(ts.naturalWidth / TILE_SIZE));
    const sx = (tile.tileId % tilesPerRow) * TILE_SIZE;
    const sy = Math.floor(tile.tileId / tilesPerRow) * TILE_SIZE;

    ctx.drawImage(ts, sx, sy, TILE_SIZE, TILE_SIZE, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  },

  drawLight(ctx, tile, x, y) {
    const light = tile.attributes.light;
    if (light._last === undefined) light._last = light.brightness ?? 1.0;

    if (light.flicker) light._last += (Math.random() - 0.5) * 0.05;
    else light._last += ((light.brightness ?? 1.0) - light._last) * 0.1;

    const minB = 0.2 * (light.brightness ?? 1.0);
    const maxB = 1.0 * (light.brightness ?? 1.0);
    light._last = Math.max(minB, Math.min(maxB, light._last));

    const color = light.color ?? "#ffffff";
    const r = parseInt(color.slice(1,3),16);
    const g = parseInt(color.slice(3,5),16);
    const b = parseInt(color.slice(5,7),16);

    const centerX = x * TILE_SIZE + TILE_SIZE/2;
    const centerY = y * TILE_SIZE + TILE_SIZE/2;
    const radius = TILE_SIZE * 3;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `rgba(${r},${g},${b},${light._last})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
    ctx.fill();
  }
};
