export function setupInput(player) {
  window.addEventListener("keydown", e => {
    switch(e.key){
      case "ArrowUp": player.direction="up"; player.tryMove(0,-1); break;
      case "ArrowDown": player.direction="down"; player.tryMove(0,1); break;
      case "ArrowLeft": player.direction="left"; player.tryMove(-1,0); break;
      case "ArrowRight": player.direction="right"; player.tryMove(1,0); break;
    }
  });

  window.addEventListener("keyup", () => player.moving=false);
}
