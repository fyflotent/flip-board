import { GRID_ROWS, GRID_ROWS_MIN, GRID_ROWS_MAX } from './constants.js';

const ROWS_KEY = 'flipoff_rows';
const MESSAGES_KEY = 'flipoff_messages';

export function getGridRows() {
  const saved = parseInt(localStorage.getItem(ROWS_KEY), 10);
  return (saved >= GRID_ROWS_MIN && saved <= GRID_ROWS_MAX) ? saved : GRID_ROWS;
}

export function setGridRows(n) {
  const clamped = Math.max(GRID_ROWS_MIN, Math.min(GRID_ROWS_MAX, n));
  _adjustStoredMessages(clamped);
  localStorage.setItem(ROWS_KEY, clamped);
}

// Pad or truncate each stored message to match the new row count.
function _adjustStoredMessages(newRows) {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return;
    const messages = JSON.parse(raw);
    if (!Array.isArray(messages)) return;
    const adjusted = messages.map(msg => {
      if (!Array.isArray(msg)) return msg;
      if (msg.length < newRows) return [...msg, ...Array(newRows - msg.length).fill('')];
      return msg.slice(0, newRows);
    });
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(adjusted));
  } catch { /* ignore corrupt data */ }
}
