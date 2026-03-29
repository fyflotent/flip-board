import { Tile } from './Tile.js';
import { GRID_COLS, GRID_ROWS, STAGGER_DELAY } from './constants.js';
import { parseString } from './colorParser.js';

export class Board {
  constructor(containerEl, soundEngine, rows = GRID_ROWS) {
    this.cols = GRID_COLS;
    this.rows = rows;
    this.soundEngine = soundEngine;
    this.isTransitioning = false;
    this.tiles = [];
    this.currentGrid = [];

    // Build board DOM
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';
    this.boardEl.style.setProperty('--grid-cols', this.cols);
    this.boardEl.style.setProperty('--grid-rows', this.rows);

    // Tile grid
    this.gridEl = document.createElement('div');
    this.gridEl.className = 'tile-grid';

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      const charRow = [];
      for (let c = 0; c < this.cols; c++) {
        const tile = new Tile(r, c);
        tile.setChar(' ');
        this.gridEl.appendChild(tile.el);
        row.push(tile);
        charRow.push(' ');
      }
      this.tiles.push(row);
      this.currentGrid.push(charRow);
    }

    this.boardEl.appendChild(this.gridEl);

    // Keyboard hint icon (bottom-left)
    const hint = document.createElement('div');
    hint.className = 'keyboard-hint';
    hint.textContent = 'N';
    hint.title = 'Keyboard shortcuts';
    hint.addEventListener('click', (e) => {
      e.stopPropagation();
      const overlay = this.boardEl.querySelector('.shortcuts-overlay');
      if (overlay) overlay.classList.toggle('visible');
    });
    this.boardEl.appendChild(hint);

    // Shortcuts overlay
    const overlay = document.createElement('div');
    overlay.className = 'shortcuts-overlay';
    overlay.innerHTML = `
      <div><span>Next message</span><kbd>Enter</kbd></div>
      <div><span>Previous</span><kbd>\u2190</kbd></div>
      <div><span>Fullscreen</span><kbd>F</kbd></div>
      <div><span>Mute</span><kbd>M</kbd></div>
    `;
    this.boardEl.appendChild(overlay);

    containerEl.appendChild(this.boardEl);
  }

  // Total time (ms) for a full transition at the current board size.
  get transitionDuration() {
    return Math.min(this.rows, 5) * this.cols * STAGGER_DELAY + 1200;
  }

  displayMessage(lines) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Format lines into grid
    const newGrid = this._formatToGrid(lines);

    // Determine which tiles need to change
    let hasChanges = false;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const newChar = newGrid[r][c];
        const oldChar = this.currentGrid[r][c];

        if (newChar !== oldChar) {
          const delay = Math.random() * (Math.min(this.rows, 5) * this.cols * STAGGER_DELAY);
          this.tiles[r][c].scrambleTo(newChar, delay);
          hasChanges = true;
        }
      }
    }

    // Play the single transition audio clip once
    if (hasChanges && this.soundEngine) {
      this.soundEngine.playTransition();
    }

    // Update grid state
    this.currentGrid = newGrid;

    // Clear transitioning flag after animation completes
    setTimeout(() => {
      this.isTransitioning = false;
    }, this.transitionDuration);
  }

  _formatToGrid(lines) {
    const grid = [];
    for (let r = 0; r < this.rows; r++) {
      const cells = parseString(lines[r] || '');
      const padTotal = this.cols - cells.length;
      const padLeft = Math.max(0, Math.floor(padTotal / 2));
      const row = Array(padLeft).fill(' ').concat(cells);
      while (row.length < this.cols) row.push(' ');
      grid.push(row.slice(0, this.cols));
    }
    return grid;
  }
}
