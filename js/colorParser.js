import { COLOR_MAP } from './constants.js';

const COLOR_KEYS = new Set(Object.keys(COLOR_MAP));

/**
 * Parses a message string into an array of tile values.
 * Each value is either a single uppercase char ('A') or a 2-char color code ('\\r').
 * \<letter> is its own standalone color tile — it does NOT apply to the next char.
 */
export function parseString(str) {
  const cells = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length && COLOR_KEYS.has(str[i + 1].toLowerCase())) {
      cells.push('\\' + str[i + 1].toLowerCase());
      i++;
    } else if (str[i] !== '\\') {
      cells.push(str[i].toUpperCase());
    }
    // trailing lone backslash is silently dropped
  }
  return cells;
}

/**
 * Counts visual tiles — both single chars and \letter codes count as 1.
 */
export function countVisualChars(str) {
  return parseString(str).length;
}

/**
 * Serializes an array of tile values back to a string.
 * ['H', 'E', '\\r', 'L', 'O'] → 'HE\\rLO'
 */
export function serializeCells(cells) {
  return cells.join('');
}
