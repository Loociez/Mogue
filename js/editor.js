import { TILE_SIZE, ATTRIBUTE_KEYS, ATTRIBUTE_LETTERS } from "./map.js";

// --- Canvas & Context ---
const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

// --- Tilesets ---
const tilesetNames = ["tileset","tileset1","tileset2","tileset3","tileset4","tileset5"]; 
const tilesetImages = [];
tilesetNames.forEach(name => {
  const img = new Image();
  img.src = `assets/${name}.png`;
  tilesetImages.push(img);
});
let currentTilesetIndex = 0;

// --- Map dimensions ---
const width = canvas.width / TILE_SIZE;
const height = canvas.height / TILE_SIZE;

// --- Map Layers ---
let mapData = {
  ground: Array.from({ length: height }, () => Array(width).fill(null)),
  groundAnim: Array.from({ length: height }, () => Array(width).fill(null)),
  objects: Array.from({ length: height }, () => Array(width).fill(null))
};

// --- Current selections ---
let currentLayer = "ground";
let selectedTiles = [[0]]; 
let currentAttributes = ATTRIBUTE_KEYS.reduce((acc, key) => { acc[key]=false; return acc; }, { walkable:true });

// --- Light source defaults ---
let lightSource = { color:"#ffffff", brightness:0.5, flicker:false };

// --- Palette ---
const TILE_DISPLAY_SIZE = 32;
const TILES_PER_ROW = 8;

let paletteDiv = document.getElementById("paletteContainer");
if(!paletteDiv){
  paletteDiv = document.createElement("div");
  paletteDiv.id = "paletteContainer";
  paletteDiv.style.width = "300px";
  paletteDiv.style.height = "400px";
  paletteDiv.style.overflowY = "auto";
  paletteDiv.style.border = "1px solid #aaa";
  paletteDiv.style.marginTop = "10px";
  document.body.appendChild(paletteDiv);
}

const paletteCanvas = document.createElement("canvas");
paletteCanvas.id = "paletteCanvas";
paletteCanvas.style.display = "block";
paletteDiv.appendChild(paletteCanvas);
const pctx = paletteCanvas.getContext("2d");

// --- Tileset selection dropdown ---
const tilesetSelect = document.createElement("select");
tilesetNames.forEach((name,i)=>{
  const opt = document.createElement("option");
  opt.value = i;
  opt.text = name;
  tilesetSelect.appendChild(opt);
});
tilesetSelect.onchange = () => {
  currentTilesetIndex = parseInt(tilesetSelect.value);
  drawPalette();
};
paletteDiv.appendChild(document.createTextNode("Tileset: "));
paletteDiv.appendChild(tilesetSelect);
paletteDiv.appendChild(document.createElement("br"));

// --- Draw palette ---
function drawPalette() {
  const tileset = tilesetImages[currentTilesetIndex];
  const totalTiles = (tileset.width / TILE_SIZE) * (tileset.height / TILE_SIZE);
  const tilesAcross = TILES_PER_ROW;
  const tilesHigh = Math.ceil(totalTiles / tilesAcross);

  paletteCanvas.width = tilesAcross * TILE_DISPLAY_SIZE;
  paletteCanvas.height = tilesHigh * TILE_DISPLAY_SIZE;

  pctx.clearRect(0,0,paletteCanvas.width,paletteCanvas.height);

  for(let i=0;i<totalTiles;i++){
    const sx = (i % (tileset.width / TILE_SIZE)) * TILE_SIZE;
    const sy = Math.floor(i / (tileset.width / TILE_SIZE)) * TILE_SIZE;
    const dx = (i % tilesAcross) * TILE_DISPLAY_SIZE;
    const dy = Math.floor(i / tilesAcross) * TILE_DISPLAY_SIZE;

    pctx.drawImage(
      tileset,
      sx, sy, TILE_SIZE, TILE_SIZE,
      dx, dy, TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE
    );
  }

  // Highlight selected tiles
  pctx.strokeStyle = "red";
  pctx.lineWidth = 2;
  selectedTiles.forEach(row=>{
    row.forEach(tileId=>{
      const selX = (tileId % TILES_PER_ROW) * TILE_DISPLAY_SIZE;
      const selY = Math.floor(tileId / TILES_PER_ROW) * TILE_DISPLAY_SIZE;
      pctx.strokeRect(selX, selY, TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE);
    });
  });
}

// --- Palette selection ---
let paletteDragging = false;
let multiSelectStart = null;

paletteCanvas.addEventListener("mousedown", e => {
  paletteDragging = true;
  const tile = getTileFromPalette(e);
  if (!tile) return;
  if (!e.shiftKey) selectedTiles = [[tile]]; 
  multiSelectStart = {x: tile % TILES_PER_ROW, y: Math.floor(tile / TILES_PER_ROW)};
  handlePaletteDrag(e);
});

paletteCanvas.addEventListener("mousemove", e => { if(paletteDragging) handlePaletteDrag(e); });
paletteCanvas.addEventListener("mouseup", e => { paletteDragging=false; multiSelectStart=null; drawPalette(); });
paletteCanvas.addEventListener("mouseleave", e => { paletteDragging=false; multiSelectStart=null; drawPalette(); });

function getTileFromPalette(e){
  const rect = paletteCanvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left)/TILE_DISPLAY_SIZE);
  const y = Math.floor((e.clientY - rect.top)/TILE_DISPLAY_SIZE);
  if(x<0 || y<0) return null;
  return y * TILES_PER_ROW + x;
}

function handlePaletteDrag(e){
  if(!multiSelectStart) return;
  const endTile = getTileFromPalette(e);
  if(!endTile) return;

  const startX = multiSelectStart.x;
  const startY = multiSelectStart.y;
  const endX = endTile % TILES_PER_ROW;
  const endY = Math.floor(endTile / TILES_PER_ROW);

  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);

  const newSelection = [];
  for(let y=minY;y<=maxY;y++){
    const row=[];
    for(let x=minX;x<=maxX;x++){
      row.push(y * TILES_PER_ROW + x);
    }
    newSelection.push(row);
  }
  selectedTiles = newSelection;
  drawPalette();
}

// --- Controls (moved below palette) ---
let controlsDiv = document.getElementById("controlsContainer");
if(!controlsDiv){
  controlsDiv = document.createElement("div");
  controlsDiv.id = "controlsContainer";
  controlsDiv.style.marginTop = "10px";
  document.body.appendChild(controlsDiv); // place under paletteDiv
}

// --- Tileset selector ---
controlsDiv.appendChild(document.createTextNode("Tileset: "));
controlsDiv.appendChild(tilesetSelect);
controlsDiv.appendChild(document.createElement("br"));

// --- Layer selector ---
const layerSelect = document.createElement("select");
["ground","groundAnim","objects"].forEach(layer=>{
  const opt = document.createElement("option");
  opt.value = layer; opt.text = layer;
  layerSelect.appendChild(opt);
});
layerSelect.onchange = () => currentLayer = layerSelect.value;
controlsDiv.appendChild(document.createTextNode("Layer: "));
controlsDiv.appendChild(layerSelect);
controlsDiv.appendChild(document.createElement("br"));

// --- Attribute checkboxes (no "light source" checkbox) ---
ATTRIBUTE_KEYS.forEach(attr=>{
  const chk = document.createElement("input");
  chk.type = "checkbox"; chk.id = attr;
  chk.onchange = ()=>currentAttributes[attr] = chk.checked;
  const lbl = document.createElement("label");
  lbl.innerText = attr; lbl.htmlFor = attr;
  controlsDiv.appendChild(chk);
  controlsDiv.appendChild(lbl);
  controlsDiv.appendChild(document.createElement("br"));
});

// --- Light section ---
const lightSection = document.createElement("div");
lightSection.style.marginTop = "5px";
lightSection.appendChild(document.createTextNode("Light:"));
lightSection.appendChild(document.createElement("br"));

// Light enable checkbox
const lightChk = document.createElement("input");
lightChk.type = "checkbox";
lightChk.onchange = ()=>currentAttributes.light = lightChk.checked;
lightSection.appendChild(lightChk);
lightSection.appendChild(document.createTextNode("Enable Light"));
lightSection.appendChild(document.createElement("br"));

// Color picker
const lightColorInput = document.createElement("input");
lightColorInput.type = "color";
lightColorInput.value = lightSource.color;
lightColorInput.onchange = ()=>lightSource.color = lightColorInput.value;
lightSection.appendChild(document.createTextNode("Color:"));
lightSection.appendChild(lightColorInput);
lightSection.appendChild(document.createElement("br"));

// Brightness slider
const brightnessInput = document.createElement("input");
brightnessInput.type = "range";
brightnessInput.min = 0; brightnessInput.max = 1; brightnessInput.step = 0.01;
brightnessInput.value = lightSource.brightness;
brightnessInput.oninput = ()=>lightSource.brightness = parseFloat(brightnessInput.value);
lightSection.appendChild(document.createTextNode("Brightness:"));
lightSection.appendChild(brightnessInput);
lightSection.appendChild(document.createElement("br"));

// Flicker checkbox
const flickerChk = document.createElement("input");
flickerChk.type = "checkbox";
flickerChk.onchange = ()=>lightSource.flicker = flickerChk.checked;
lightSection.appendChild(document.createTextNode("Flicker:"));
lightSection.appendChild(flickerChk);
lightSection.appendChild(document.createElement("br"));

controlsDiv.appendChild(lightSection);

// --- Action buttons ---
const fillBtn = document.createElement("button");
fillBtn.innerText = "Fill Layer";
fillBtn.onclick = () => {
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      paintTile(x,y);
    }
  }
  draw();
};
controlsDiv.appendChild(fillBtn);

const clearBtn = document.createElement("button");
clearBtn.innerText = "Clear Layer";
clearBtn.onclick = () => {
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      mapData[currentLayer][y][x] = null;
    }
  }
  draw();
};
controlsDiv.appendChild(clearBtn);

const exportBtn = document.createElement("button");
exportBtn.innerText = "Export Map";
exportBtn.onclick = () => {
  const json = { width, height, layers: mapData };
  const blob = new Blob([JSON.stringify(json,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "map.json";
  a.click();
};
controlsDiv.appendChild(exportBtn);
// --- Load map button ---
const loadInput = document.createElement("input");
loadInput.type = "file";
loadInput.accept = ".json";
loadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const json = JSON.parse(evt.target.result);
    mapData.ground = json.layers.ground || mapData.ground;
    mapData.groundAnim = json.layers.groundAnim || mapData.groundAnim;
    mapData.objects = json.layers.objects || mapData.objects;
    draw();
  };
  reader.readAsText(file);
};
controlsDiv.appendChild(loadInput);
controlsDiv.appendChild(document.createElement("br"));


// --- Paint Tile Batch ---
function paintTile(x, y) {
  const rows = selectedTiles.length;
  const cols = selectedTiles[0].length;

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const tileId = selectedTiles[ry][cx];
      const px = x + cx;
      const py = y + ry;
      if (px >= width || py >= height) continue;

      if (!mapData[currentLayer][py][px]) {
        mapData[currentLayer][py][px] = { tileId, tileset: currentTilesetIndex, attributes: {} };
      }

      const tile = mapData[currentLayer][py][px];

      if (currentLayer === "groundAnim") {
        if (!Array.isArray(tile.tileId)) tile.tileId = [tileId, tileId];
        tile.tileset = currentTilesetIndex;
      } else {
        tile.tileId = tileId;
        tile.tileset = currentTilesetIndex;

        // Copy attributes for ground, objects separately
        if (currentLayer === "ground" || currentLayer === "groundAnim") {
          tile.attributes = { ...currentAttributes };
          if (tile.attributes.walkable === undefined) tile.attributes.walkable = true;
        } else if (currentLayer === "objects") {
          tile.attributes = { ...currentAttributes };
          if (tile.attributes.blocker === undefined) tile.attributes.blocker = false; // objects default non-blocker
          if (tile.attributes.walkable === undefined) tile.attributes.walkable = true;  // optional
        }

        // Light attribute
        if (currentAttributes.light) {
          tile.attributes.light = {
            color: lightSource.color,
            brightness: lightSource.brightness,
            flicker: lightSource.flicker,
            _last: lightSource.brightness
          };
        } else {
          delete tile.attributes.light;
        }
      }
    }
  }
}



// --- Canvas Drag Painting ---
let painting = false;
let erase = false;
canvas.addEventListener("mousedown", e=>{
  painting = true;
  erase = (e.button === 2);
  handleCanvasPaint(e);
});
canvas.addEventListener("mousemove", e=>{
  if(painting) handleCanvasPaint(e);
});
canvas.addEventListener("mouseup", e=>{ painting=false; });
canvas.addEventListener("mouseleave", e=>{ painting=false; });
canvas.addEventListener("contextmenu", e=> e.preventDefault());

function handleCanvasPaint(e){
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left)/TILE_SIZE);
  const y = Math.floor((e.clientY - rect.top)/TILE_SIZE);
  if(x<0||y<0||x>=width||y>=height) return;

  if(erase){
    const rows = selectedTiles.length;
    const cols = selectedTiles[0].length;
    for(let ry=0; ry<rows; ry++){
      for(let cx=0; cx<cols; cx++){
        const px = x+cx;
        const py = y+ry;
        if(px>=width || py>=height) continue;
        mapData[currentLayer][py][px] = null;
      }
    }
  } else {
    paintTile(x,y);
  }
  draw();
}

// --- Draw Map ---
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      // Ground / groundAnim first
      let tile = mapData.ground[y][x];
      const animTile = mapData.groundAnim[y][x];
      if(animTile && Array.isArray(animTile.tileId)) tile = { ...animTile, tileId: animTile.tileId[0] };

      if(tile){
        const ts = tilesetImages[tile.tileset || 0];
        const sx = (tile.tileId % (1024/TILE_SIZE)) * TILE_SIZE;
        const sy = Math.floor(tile.tileId/(1024/TILE_SIZE))*TILE_SIZE;
        ctx.drawImage(ts,sx,sy,TILE_SIZE,TILE_SIZE,x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE);
      }

      // Objects on top
const obj = mapData.objects[y][x];
if(obj){
  const ts = tilesetImages[obj.tileset || 0];
  const sx = (obj.tileId % (1024/TILE_SIZE)) * TILE_SIZE;
  const sy = Math.floor(obj.tileId/(1024/TILE_SIZE))*TILE_SIZE;
  ctx.drawImage(ts,sx,sy,TILE_SIZE,TILE_SIZE,x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE);

  if(obj.attributes){
    if(obj.attributes.blocker) { ctx.fillStyle = "rgba(255,0,0,0.3)"; ctx.fillRect(x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE); }
    if(obj.attributes.damage) { ctx.fillStyle = "rgba(255,165,0,0.3)"; ctx.fillRect(x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE); }
    if(obj.attributes.healing) { ctx.fillStyle = "rgba(0,255,0,0.3)"; ctx.fillRect(x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE); }
    if(obj.attributes.trigger) { ctx.fillStyle = "rgba(0,0,255,0.3)"; ctx.fillRect(x*TILE_SIZE,y*TILE_SIZE,TILE_SIZE,TILE_SIZE); }

    // Draw light source overlay if present
    if(obj.attributes.light){
      const light = obj.attributes.light;
      if(light._last === undefined) light._last = light.brightness;

      // Smooth random flicker step
      light._last += (Math.random() - 0.5) * 0.02; // ±0.01 per frame
      light._last = Math.min(Math.max(light._last, 0.7*light.brightness), 1.0*light.brightness); // clamp
      const brightness = light._last;

      ctx.fillStyle = hexToRGBA(light.color, brightness);
      ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

    }
  }
}

// --- Utility: convert hex color to rgba with alpha ---
function hexToRGBA(hex, alpha){
  const r = parseInt(hex.substring(1,3),16);
  const g = parseInt(hex.substring(3,5),16);
  const b = parseInt(hex.substring(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Initial draw when first tileset loads
tilesetImages[0].onload = () => {
  drawPalette();
  draw();
};
