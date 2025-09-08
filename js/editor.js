import { TILE_SIZE, ATTRIBUTE_KEYS, ATTRIBUTE_LETTERS } from "./map.js";

// --- Canvas & Context ---
const canvas = document.getElementById("editorCanvas");
const ctx = canvas.getContext("2d");

// --- Tilesets ---
const tilesetNames = ["tileset","tileset1","tileset2","tileset3","tileset4","tileset5","tileset6","tileset7","tileset8","tileset9","tileset10"]; 
const tilesetImages = [];
let tilesetsLoaded = 0;

tilesetNames.forEach((name, i) => {
  const img = new Image();
  img.src = `assets/${name}.png`;
  img.onload = () => {
    tilesetsLoaded++;
    if (tilesetsLoaded === tilesetNames.length) {
      drawPalette();
      draw();
    }
  };
  tilesetImages.push(img);
});

let currentTilesetIndex = 0;

// --- Map dimensions ---
let width = canvas.width / TILE_SIZE;
let height = canvas.height / TILE_SIZE;

// --- Map Layers ---
let mapData = {
  ground: Array.from({ length: height }, () => Array(width).fill(null)),
  groundAnim: Array.from({ length: height }, () => Array(width).fill(null)),
  objects: Array.from({ length: height }, () => Array(width).fill(null)),
  objectAnim: Array.from({ length: height }, () => Array(width).fill(null)),
  object2: Array.from({ length: height }, () => Array(width).fill(null)),       
  object2Anim: Array.from({ length: height }, () => Array(width).fill(null))    
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
  paletteDiv.style.width = "600px";
  paletteDiv.style.height = "600px";
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

// --- Draw palette ---
function drawPalette() {
  const tileset = tilesetImages[currentTilesetIndex];
  if (!tileset.complete) return;

  const tilesAcrossInImage = Math.floor(tileset.width / TILE_SIZE);
  const tilesDownInImage = Math.floor(tileset.height / TILE_SIZE);
  const totalTiles = tilesAcrossInImage * tilesDownInImage;

  const tilesAcross = TILES_PER_ROW; 
  const tilesHigh = Math.ceil(totalTiles / tilesAcross);

  paletteCanvas.width = tilesAcross * TILE_DISPLAY_SIZE;
  paletteCanvas.height = tilesHigh * TILE_DISPLAY_SIZE;

  pctx.clearRect(0, 0, paletteCanvas.width, paletteCanvas.height);

  for (let i = 0; i < totalTiles; i++) {
    const sx = (i % tilesAcrossInImage) * TILE_SIZE;
    const sy = Math.floor(i / tilesAcrossInImage) * TILE_SIZE;
    const dx = (i % tilesAcross) * TILE_DISPLAY_SIZE;
    const dy = Math.floor(i / tilesAcross) * TILE_DISPLAY_SIZE;

    pctx.drawImage(
      tileset,
      sx, sy, TILE_SIZE, TILE_SIZE,
      dx, dy, TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE
    );
  }

  // highlight selected tiles
  pctx.strokeStyle = "red";
  pctx.lineWidth = 2;
  selectedTiles.forEach(row => {
    row.forEach(tileId => {
      const selX = (tileId % tilesAcross) * TILE_DISPLAY_SIZE;
      const selY = Math.floor(tileId / tilesAcross) * TILE_DISPLAY_SIZE;
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

// --- Controls below palette ---
let controlsDiv = document.getElementById("controlsContainer");
if(!controlsDiv){
  controlsDiv = document.createElement("div");
  controlsDiv.id = "controlsContainer";
  controlsDiv.style.marginTop = "10px";
  controlsDiv.style.width = "350px";
  document.body.appendChild(controlsDiv);
}

// --- Tileset selector ---
controlsDiv.appendChild(document.createTextNode("Tileset: "));
const tilesetSelect = document.createElement("select");
tilesetSelect.style.width = "150px";
tilesetNames.forEach((name, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.text = name;
  tilesetSelect.appendChild(opt);
});
tilesetSelect.onchange = () => {
  currentTilesetIndex = parseInt(tilesetSelect.value);
  drawPalette();
};
controlsDiv.appendChild(tilesetSelect);
controlsDiv.appendChild(document.createElement("br"));

// --- Layer selector ---
controlsDiv.appendChild(document.createTextNode("Layer: "));
const layerSelect = document.createElement("select");
["ground","groundAnim","objects","objectAnim","object2","object2Anim"].forEach(layer=>{
  const opt = document.createElement("option");
  opt.value = layer; 
  opt.text = layer;
  layerSelect.appendChild(opt);
});
layerSelect.onchange = () => currentLayer = layerSelect.value;
controlsDiv.appendChild(layerSelect);
controlsDiv.appendChild(document.createElement("br"));

// --- Attribute checkboxes ---
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

// --- Light Section ---
const lightSection = document.createElement("div");
lightSection.style.marginTop = "5px";
lightSection.appendChild(document.createTextNode("Light:"));
lightSection.appendChild(document.createElement("br"));

const lightChk = document.createElement("input");
lightChk.type = "checkbox";
lightChk.onchange = ()=>currentAttributes.light = lightChk.checked;
lightSection.appendChild(lightChk);
lightSection.appendChild(document.createTextNode("Enable Light"));
lightSection.appendChild(document.createElement("br"));

const lightColorInput = document.createElement("input");
lightColorInput.type = "color";
lightColorInput.value = lightSource.color;
lightColorInput.onchange = ()=>lightSource.color = lightColorInput.value;
lightSection.appendChild(document.createTextNode("Color:"));
lightSection.appendChild(lightColorInput);
lightSection.appendChild(document.createElement("br"));

const brightnessInput = document.createElement("input");
brightnessInput.type = "range";
brightnessInput.min = 0; brightnessInput.max = 1; brightnessInput.step = 0.01;
brightnessInput.value = lightSource.brightness;
brightnessInput.oninput = ()=>lightSource.brightness = parseFloat(brightnessInput.value);
lightSection.appendChild(document.createTextNode("Brightness:"));
lightSection.appendChild(brightnessInput);
lightSection.appendChild(document.createElement("br"));

const flickerChk = document.createElement("input");
flickerChk.type = "checkbox";
flickerChk.onchange = ()=>lightSource.flicker = flickerChk.checked;
lightSection.appendChild(document.createTextNode("Flicker:"));
lightSection.appendChild(flickerChk);
lightSection.appendChild(document.createElement("br"));

controlsDiv.appendChild(lightSection);

// --- Action Buttons ---
["Fill Layer","Clear Layer","Export Map"].forEach(text=>{
  const btn = document.createElement("button");
  btn.innerText = text;
  if(text==="Fill Layer") btn.onclick = () => { for(let y=0;y<height;y++){ for(let x=0;x<width;x++){ paintTile(x,y); } } draw(); };
  if(text==="Clear Layer") btn.onclick = () => { for(let y=0;y<height;y++){ for(let x=0;x<width;x++){ mapData[currentLayer][y][x] = null; } } draw(); };
  if(text==="Export Map") btn.onclick = () => {
    const json = { width, height, layers: mapData };
    const blob = new Blob([JSON.stringify(json,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "map.json";
    a.click();
  };
  controlsDiv.appendChild(btn);
});

// --- Load Map ---
const loadInput = document.createElement("input");
loadInput.type = "file";
loadInput.accept = ".json";
loadInput.style.display = "block";
loadInput.style.marginTop = "5px";

loadInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const json = JSON.parse(evt.target.result);

    // Resize canvas
    canvas.width = json.width * TILE_SIZE;
    canvas.height = json.height * TILE_SIZE;
    width = json.width;
    height = json.height;

    // Helper to fill missing tiles
    function fillLayer(layer, defaultValue = null) {
      const newLayer = [];
      for (let y = 0; y < height; y++) {
        newLayer[y] = [];
        for (let x = 0; x < width; x++) {
          newLayer[y][x] = layer?.[y]?.[x] ?? defaultValue;
        }
      }
      return newLayer;
    }

    // Load layers
    mapData.ground      = fillLayer(json.layers.ground);
    mapData.groundAnim  = fillLayer(json.layers.groundAnim);
    mapData.objects     = fillLayer(json.layers.objects);
    mapData.objectAnim  = fillLayer(json.layers.objectAnim);
    mapData.object2     = fillLayer(json.layers.object2);
    mapData.object2Anim = fillLayer(json.layers.object2Anim);

    draw();
  };
  reader.readAsText(file);
};

controlsDiv.appendChild(loadInput);
controlsDiv.appendChild(document.createElement("br"));

// --- Paint Tile ---
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

      // Handle animation layers
      if (currentLayer === "groundAnim" || currentLayer === "objectAnim" || currentLayer === "object2Anim") {
        if (!Array.isArray(tile.tileId)) tile.tileId = [tileId, tileId];
        tile.tileset = currentTilesetIndex;
      } else {
        tile.tileId = tileId;
        tile.tileset = currentTilesetIndex;
      }

      // Apply attributes
      tile.attributes = { ...currentAttributes };
      if (tile.attributes.walkable === undefined) tile.attributes.walkable = true;
      if ((currentLayer === "objects" || currentLayer === "objectAnim" || currentLayer === "object2" || currentLayer === "object2Anim") &&
          tile.attributes.blocker === undefined) tile.attributes.blocker = false;

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

// --- Canvas Drag Painting ---
let painting = false;
let erase = false;
canvas.addEventListener("mousedown", e => {
  painting = true;
  erase = (e.button === 2);
  handleCanvasPaint(e);
});
canvas.addEventListener("mousemove", e => { if (painting) handleCanvasPaint(e); });
canvas.addEventListener("mouseup", e => { painting = false; });
canvas.addEventListener("mouseleave", e => { painting = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());

function handleCanvasPaint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
  if (x < 0 || y < 0 || x >= width || y >= height) return;

  const rows = selectedTiles.length;
  const cols = selectedTiles[0].length;

  for (let ry = 0; ry < rows; ry++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = x + cx;
      const py = y + ry;
      if (px >= width || py >= height) continue;

      if (erase) {
        mapData[currentLayer][py][px] = null;
      } else {
        paintTile(px, py);
      }
    }
  }

  draw();
}

// --- Helper: convert hex color to rgba ---
function hexToRGBA(hex, alpha = 1) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- Map Options Panel (Rain) ---
let optionsDiv = document.createElement("div");
optionsDiv.id = "optionsPanel";
optionsDiv.style.position = "absolute";
optionsDiv.style.top = "10px";
optionsDiv.style.right = "10px";
optionsDiv.style.width = "200px";
optionsDiv.style.padding = "10px";
optionsDiv.style.border = "1px solid #aaa";
optionsDiv.style.backgroundColor = "#f0f0f0";
optionsDiv.style.display = "none";
optionsDiv.style.zIndex = 1000;

const optionsTitle = document.createElement("div");
optionsTitle.innerText = "Map Options";
optionsTitle.style.fontWeight = "bold";
optionsTitle.style.marginBottom = "5px";
optionsDiv.appendChild(optionsTitle);

const weatherSection = document.createElement("div");
weatherSection.style.marginTop = "5px";
weatherSection.appendChild(document.createTextNode("Weather:"));
weatherSection.appendChild(document.createElement("br"));

const rainChk = document.createElement("input");
rainChk.type = "checkbox";
rainChk.id = "rainToggle";
weatherSection.appendChild(rainChk);
weatherSection.appendChild(document.createTextNode("Rain"));
weatherSection.appendChild(document.createElement("br"));

const rainSlider = document.createElement("input");
rainSlider.type = "range";
rainSlider.min = 0;
rainSlider.max = 1;
rainSlider.step = 0.01;
rainSlider.value = 0.5;
rainSlider.style.width = "100%";
weatherSection.appendChild(document.createTextNode("Intensity:"));
weatherSection.appendChild(document.createElement("br"));
weatherSection.appendChild(rainSlider);

optionsDiv.appendChild(weatherSection);
document.body.appendChild(optionsDiv);

const toggleOptionsBtn = document.createElement("button");
toggleOptionsBtn.innerText = "Options";
toggleOptionsBtn.style.position = "absolute";
toggleOptionsBtn.style.top = "10px";
toggleOptionsBtn.style.right = "220px";
toggleOptionsBtn.style.zIndex = 1001;
document.body.appendChild(toggleOptionsBtn);

toggleOptionsBtn.onclick = () => {
  optionsDiv.style.display = optionsDiv.style.display === "none" ? "block" : "none";
};

const rainImg = new Image();
rainImg.src = "assets/rain.png";

let rainEnabled = false;
let rainIntensity = 0.5;

rainChk.onchange = () => { rainEnabled = rainChk.checked; draw(); };
rainSlider.oninput = () => { rainIntensity = parseFloat(rainSlider.value); draw(); };

// --- Draw Map with Rain ---
const originalDraw = draw || (()=>{}); // handle if draw is undefined
draw = function() {
  originalDraw();

  if (rainEnabled && rainImg.complete) {
    ctx.globalAlpha = rainIntensity;
    ctx.drawImage(rainImg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  }
};
