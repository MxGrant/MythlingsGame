import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Exposed for debugging and for anyone curious about the machinery.
window.mythlings = game;

window.addEventListener('resize', () => {
  game.ctx.imageSmoothingEnabled = false;
});
