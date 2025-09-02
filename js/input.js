export function setupInput(player) {
  const keys = {};

  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();
  });

  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  player.inputKeys = keys;
  player.attackPressed = false; // placeholder for gamepad RT
}
