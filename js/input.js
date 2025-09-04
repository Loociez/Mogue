export function setupInput(player) {
  const keys = {};

  // --- Keyboard events ---
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) {
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
  });

  player.inputKeys = keys;
  player.attackPressed = false;

  // --- Gamepad polling ---
  function pollGamepad() {
    const gp = navigator.getGamepads()[0];
    if (gp) {
      // Map A button (index 0) to attack
      if (gp.buttons[0].pressed) {
        player.attackPressed = true;
      }

      // Example: map B (index 1) to pause if you want
      // if (gp.buttons[1].pressed) {
      //   togglePause();
      // }
    }
    requestAnimationFrame(pollGamepad);
  }
  pollGamepad();
}
