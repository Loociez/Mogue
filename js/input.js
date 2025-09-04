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
  player.attackPressed = false;

  // --- gamepad polling ---
  function pollGamepad() {
    const gp = navigator.getGamepads()[0];
    if (gp) {
      // A button is index 0 (instead of RT which is 7)
      player.attackPressed = gp.buttons[0].pressed;
      // You can also map dpad/axes here if needed
    }
    requestAnimationFrame(pollGamepad);
  }
  pollGamepad();
}
