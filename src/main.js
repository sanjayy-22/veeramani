import { loadCharacterAssets } from "./actors/HeroModel.js";
import "./ui/style.css";
import { Game } from "./Game.js";
import { $ } from "./core/primitives.js";
try {
  await loadCharacterAssets();
  const game = new Game();
  /* Read-only-friendly inspection entry point for browser QA. */ window.marsSweetHeist =
    game;
} catch (error) {
  clearTimeout(window.bootTimer);
  console.error(error);
  $("loadingText").textContent =
    "Unable to load the game graphics or character asset. Use Start Game.cmd with the complete dist folder, then reload in a WebGL-enabled browser.";
}
