import { Board } from './Board.js';
import { SoundEngine } from './SoundEngine.js';
import { MessageRotator } from './MessageRotator.js';
import { KeyboardController } from './KeyboardController.js';
import { MessageEditor, loadMessages } from './MessageEditor.js';
import { getGridRows, setGridRows } from './settings.js';
import { GRID_ROWS_MIN, GRID_ROWS_MAX } from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
  const boardContainer = document.getElementById('board-container');
  const currentRows = getGridRows();

  const soundEngine = new SoundEngine();
  const board = new Board(boardContainer, soundEngine, currentRows);
  const rotator = new MessageRotator(board, loadMessages() || undefined);
  const keyboard = new KeyboardController(rotator, soundEngine);

  // Initialize audio on first user interaction (browser autoplay policy)
  let audioInitialized = false;
  const initAudio = async () => {
    if (audioInitialized) return;
    audioInitialized = true;
    await soundEngine.init();
    soundEngine.resume();
    document.removeEventListener('click', initAudio);
    document.removeEventListener('keydown', initAudio);
  };
  document.addEventListener('click', initAudio);
  document.addEventListener('keydown', initAudio);

  // Message editor
  const editor = new MessageEditor(rotator);
  document.getElementById('edit-btn')?.addEventListener('click', () => editor.open());

  // Start message rotation
  rotator.start();

  // Volume toggle button in header
  const volumeBtn = document.getElementById('volume-btn');
  if (volumeBtn) {
    volumeBtn.classList.add('muted');
    volumeBtn.addEventListener('click', async () => {
      await initAudio();
      const muted = soundEngine.toggleMute();
      volumeBtn.classList.toggle('muted', muted);
    });
  }

  // Row count controls
  const rowsDisplay = document.getElementById('rows-count');
  const rowsDec = document.getElementById('rows-dec');
  const rowsInc = document.getElementById('rows-inc');

  if (rowsDisplay) rowsDisplay.textContent = currentRows;
  if (rowsDec) {
    rowsDec.disabled = currentRows <= GRID_ROWS_MIN;
    rowsDec.addEventListener('click', () => {
      setGridRows(currentRows - 1);
      location.reload();
    });
  }
  if (rowsInc) {
    rowsInc.disabled = currentRows >= GRID_ROWS_MAX;
    rowsInc.addEventListener('click', () => {
      setGridRows(currentRows + 1);
      location.reload();
    });
  }
});
