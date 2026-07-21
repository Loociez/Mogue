// effects.js
//
// Central place that maps game abilities/projectiles to specific icons on
// assets/effects3.png. The sheet is a 32x32 grid (1024x1024 total).
//
// Every entry below is [row, col] into that grid, plus how many frames to
// animate through (frames sit side-by-side starting at that column) and how
// fast to step through them. If any of these look like the wrong icon once
// you see it in-game, just change the row/col here - nothing else needs to
// change.

export const EFFECTS3 = new Image();
EFFECTS3.src = "assets/effects3.png";

export const CELL = 32;

// row, col, frameCount, frameSpeed (ticks per frame), rotates (whether the
// sprite should be rotated to face its direction of travel - for icons that
// are inherently "pointy"/directional like arrows or beams)
export const SPRITES = {
  // --- Projectile types (Projectile.draw) ---
  boltNormal:   { row: 15, col: 0, frames: 4, frameSpeed: 4, rotates: false },  // pulsing magic orb
  boltSpread:   { row: 1,  col: 25, frames: 1, frameSpeed: 1, rotates: true },  // arrow icon
  boltHoming:   { row: 9,  col: 11, frames: 1, frameSpeed: 1, rotates: false, spin: true }, // purple pinwheel, self-spins
  boltHeavy:    { row: 6,  col: 7, frames: 3, frameSpeed: 5, rotates: false }, // flame
  boltBouncing: { row: 10, col: 20, frames: 1, frameSpeed: 1, rotates: false }, // green blob
  boltRain:     { row: 9,  col: 2,  frames: 1, frameSpeed: 1, rotates: false }, // splash/ripple
  boltLightning:{ row: 12, col: 20, frames: 1, frameSpeed: 1, rotates: false }, // small spark burst
  boltDashshot: { row: 20, col: 4,  frames: 1, frameSpeed: 1, rotates: true },  // beam streak
  boltBossBurst:{ row: 17, col: 28, frames: 1, frameSpeed: 1, rotates: false, spin: true }, // big sunburst

  // --- Ability visuals ---
  explosionBurst:   { row: 6, col: 0, frames: 4, frameSpeed: 4, rotates: false },  // explosion cloud puff
  guardianShieldRing:{ row: 30, col: 0, frames: 1, frameSpeed: 1, rotates: false }, // plain ring (tinted blue at draw time)
  stoneformRing:     { row: 30, col: 4, frames: 1, frameSpeed: 1, rotates: false }, // plain ring (tinted white/gray)
  energyShieldRing:  { row: 30, col: 8, frames: 1, frameSpeed: 1, rotates: false }, // plain ring (tinted cyan)
};

let globalTick = 0;
export function tickEffects() { globalTick++; }

function frameFor(spriteKey) {
  const s = SPRITES[spriteKey];
  if (!s) return null;
  const frameIndex = s.frames > 1 ? Math.floor(globalTick / s.frameSpeed) % s.frames : 0;
  return { sx: (s.col + frameIndex) * CELL, sy: s.row * CELL, spin: !!s.spin };
}

export function sheetReady() {
  return EFFECTS3.complete && EFFECTS3.naturalWidth > 0;
}

/**
 * Draw a mapped effect sprite centered at (dx, dy) with the given on-screen
 * size. angle (radians) is used for directional sprites (rotates:true) or
 * self-spinning ones (spin:true). tint, if given, is an "rgba(...)" string
 * multiplied over the sprite (useful for recoloring the plain ring icons).
 * Returns false if the sheet isn't loaded yet, so callers can fall back to
 * their old vector-drawn shape.
 */
export function drawEffect(ctx, spriteKey, dx, dy, size, angle = 0, tint = null, tintAlpha = 0.75, opacity = 1) {
  if (!sheetReady()) return false;
  const s = SPRITES[spriteKey];
  const frame = frameFor(spriteKey);
  if (!s || !frame) return false;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(dx, dy);
  if (s.rotates) ctx.rotate(angle + Math.PI / 2);
  else if (frame.spin) ctx.rotate(globalTick * 0.05);

  ctx.drawImage(EFFECTS3, frame.sx, frame.sy, CELL, CELL, -size / 2, -size / 2, size, size);

  if (tint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = opacity * tintAlpha;
    ctx.fillStyle = tint;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
  return true;
}