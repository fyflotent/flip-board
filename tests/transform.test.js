import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseString, serializeCells, countVisualChars } from '../js/colorParser.js';
import { COLOR_MAP, GRID_COLS } from '../js/constants.js';

// Mirror of MessageEditor._expandRow — center-pads a simple row to GRID_COLS cells
function expandRow(str) {
  const cells = parseString(str.trim());
  const padLeft = Math.max(0, Math.floor((GRID_COLS - cells.length) / 2));
  const padded = Array(padLeft).fill(' ')
    .concat(cells)
    .concat(Array(Math.max(0, GRID_COLS - padLeft - cells.length)).fill(' '))
    .slice(0, GRID_COLS);
  while (padded.length < GRID_COLS) padded.push(' ');
  return serializeCells(padded);
}

// Mirror of the restoration logic in MessageEditor._toggleAdvanced
function contractRow(advancedRow, originalSimpleRow) {
  return advancedRow === expandRow(originalSimpleRow) ? originalSimpleRow : advancedRow;
}

// ── parseString ────────────────────────────────────────────

describe('parseString', () => {
  it('splits plain text into individual chars', () => {
    assert.deepEqual(parseString('HELLO'), ['H', 'E', 'L', 'L', 'O']);
  });

  it('uppercases chars', () => {
    assert.deepEqual(parseString('hello'), ['H', 'E', 'L', 'L', 'O']);
  });

  it('parses a color code as a single cell', () => {
    assert.deepEqual(parseString('\\r'), ['\\r']);
  });

  it('parses mixed text and color codes', () => {
    assert.deepEqual(parseString('HE\\rLO'), ['H', 'E', '\\r', 'L', 'O']);
  });

  it('handles all 8 color codes', () => {
    for (const key of Object.keys(COLOR_MAP)) {
      const cells = parseString('\\' + key);
      assert.equal(cells.length, 1);
      assert.equal(cells[0], '\\' + key);
    }
  });

  it('silently drops a trailing lone backslash', () => {
    assert.deepEqual(parseString('A\\'), ['A']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseString(''), []);
  });

  it('treats spaces as literal cells', () => {
    assert.deepEqual(parseString('A B'), ['A', ' ', 'B']);
  });

  it('multiple adjacent color codes each count as one cell', () => {
    const cells = parseString('\\r\\g\\b');
    assert.deepEqual(cells, ['\\r', '\\g', '\\b']);
  });
});

// ── serializeCells ─────────────────────────────────────────

describe('serializeCells', () => {
  it('joins chars back to a string', () => {
    assert.equal(serializeCells(['H', 'E', 'L', 'L', 'O']), 'HELLO');
  });

  it('round-trips with parseString for plain text', () => {
    const str = 'HELLO WORLD';
    assert.equal(serializeCells(parseString(str)), str.toUpperCase());
  });

  it('round-trips with parseString for mixed content', () => {
    const str = 'HE\\rLO';
    assert.equal(serializeCells(parseString(str)), str);
  });

  it('round-trips with parseString for all-colors', () => {
    const str = '\\k\\r\\g\\b';
    assert.equal(serializeCells(parseString(str)), str);
  });

  it('returns empty string for empty array', () => {
    assert.equal(serializeCells([]), '');
  });
});

// ── countVisualChars ───────────────────────────────────────

describe('countVisualChars', () => {
  it('counts plain characters', () => {
    assert.equal(countVisualChars('HELLO'), 5);
  });

  it('counts a color code as 1', () => {
    assert.equal(countVisualChars('\\r'), 1);
  });

  it('counts mixed content correctly', () => {
    assert.equal(countVisualChars('HE\\rLO'), 5); // 4 chars + 1 color = 5
  });
});

// ── expandRow ──────────────────────────────────────────────

describe('expandRow', () => {
  it('always produces exactly GRID_COLS visual characters', () => {
    const cases = ['', 'HI', 'HELLO WORLD', '\\r\\g\\b', 'ABCDEFGHIJKLMNOPQRSTUV'];
    for (const str of cases) {
      assert.equal(countVisualChars(expandRow(str)), GRID_COLS, `failed for: ${str}`);
    }
  });

  it('preserves the original content within the padding', () => {
    const original = 'HELLO';
    const cells = parseString(expandRow(original));
    const trimmed = cells.filter(c => c !== ' ').join('');
    assert.equal(trimmed, 'HELLO');
  });

  it('center-pads shorter content', () => {
    const cells = parseString(expandRow('HI'));
    const firstNonSpace = cells.findIndex(c => c !== ' ');
    const lastNonSpace = cells.findLastIndex(c => c !== ' ');
    const leftPad = firstNonSpace;
    const rightPad = GRID_COLS - 1 - lastNonSpace;
    assert.ok(Math.abs(leftPad - rightPad) <= 1, 'content should be roughly centered');
  });

  it('produces all spaces for an empty row', () => {
    const cells = parseString(expandRow(''));
    assert.ok(cells.every(c => c === ' '));
    assert.equal(cells.length, GRID_COLS);
  });

  it('trims leading/trailing whitespace before expanding', () => {
    assert.equal(expandRow('  HELLO  '), expandRow('HELLO'));
  });

  it('preserves color codes in expanded output', () => {
    const cells = parseString(expandRow('\\r'));
    assert.ok(cells.includes('\\r'));
  });

  it('truncates content longer than GRID_COLS to GRID_COLS', () => {
    const long = 'A'.repeat(GRID_COLS + 5);
    assert.equal(countVisualChars(expandRow(long)), GRID_COLS);
  });

  it('does not double-pad a row that is already GRID_COLS cells', () => {
    const full = 'A'.repeat(GRID_COLS);
    const expanded = expandRow(full);
    assert.equal(countVisualChars(expanded), GRID_COLS);
    // All cells should be 'A', no padding
    const cells = parseString(expanded);
    assert.ok(cells.every(c => c === 'A'));
  });
});

// ── round-trip: simple → advanced → simple ────────────────

describe('simple ↔ advanced round-trip', () => {
  it('contractRow restores the original when content is unchanged', () => {
    const cases = [
      '',
      'HELLO',
      'HELLO WORLD',
      '\\r\\g\\b',
      'HE\\rLO',
      'ABCDEFGHIJ',
    ];
    for (const original of cases) {
      const expanded = expandRow(original);
      assert.equal(contractRow(expanded, original), original, `failed for: "${original}"`);
    }
  });

  it('contractRow keeps the advanced row when content was modified', () => {
    const original = 'HELLO';
    const expanded = expandRow(original);
    // Simulate user editing: change first non-space cell to 'X'
    const cells = parseString(expanded);
    const firstContent = cells.findIndex(c => c !== ' ');
    cells[firstContent] = 'X';
    const modified = serializeCells(cells);

    assert.equal(contractRow(modified, original), modified);
  });

  it('round-trip preserves visual content for plain text', () => {
    const original = 'STAY HUNGRY';
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    // Visual content of contracted should match original
    assert.deepEqual(parseString(contracted), parseString(original));
  });

  it('round-trip preserves visual content for color codes', () => {
    const original = 'HE\\rLO';
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    assert.deepEqual(parseString(contracted), parseString(original));
  });

  it('round-trip preserves visual content for all-color rows', () => {
    const original = '\\r\\g\\b\\y';
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    assert.deepEqual(parseString(contracted), parseString(original));
  });

  it('round-trip preserves an empty row', () => {
    const original = '';
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    assert.equal(contracted, original);
  });

  it('expanded row has same visual cells as original (ignoring padding)', () => {
    const original = 'LESS IS MORE';
    const expandedCells = parseString(expandRow(original));
    const originalCells = parseString(original);
    const contentCells = expandedCells.filter(c => c !== ' ');
    assert.deepEqual(contentCells, originalCells.filter(c => c !== ' '));
  });

  it('applying expandRow twice is idempotent', () => {
    // An already-expanded 22-cell row should not change when expanded again
    const original = 'HELLO';
    const once = expandRow(original);
    const twice = expandRow(once);
    assert.equal(once, twice);
  });

  it('handles default MESSAGES without data loss', () => {
    // Spot-check real message content from constants
    const rows = ['GOD IS IN', 'THE DETAILS .', '- LUDWIG MIES'];
    for (const row of rows) {
      const expanded = expandRow(row);
      const contracted = contractRow(expanded, row);
      assert.equal(contracted, row, `round-trip failed for: "${row}"`);
    }
  });
});

// ── color-specific round-trip tests ───────────────────────

describe('color handling in advanced ↔ simple conversion', () => {
  it('each of the 8 colors round-trips individually', () => {
    for (const key of Object.keys(COLOR_MAP)) {
      const original = '\\' + key;
      const expanded = expandRow(original);
      const contracted = contractRow(expanded, original);
      assert.equal(contracted, original, `round-trip failed for color \\${key}`);
    }
  });

  it('preserves specific color identity, not just presence', () => {
    // Checks that \\r stays \\r and \\g stays \\g, not just "some color"
    for (const key of Object.keys(COLOR_MAP)) {
      const code = '\\' + key;
      const cells = parseString(expandRow(code));
      const colorCells = cells.filter(c => c.startsWith('\\'));
      assert.equal(colorCells.length, 1);
      assert.equal(colorCells[0], code, `color code changed during expansion: \\${key}`);
    }
  });

  it('padding cells added during expansion are spaces, not colors', () => {
    const cases = ['\\r', '\\r\\g', 'A\\bC', '\\k\\w'];
    for (const original of cases) {
      const cells = parseString(expandRow(original));
      const padCells = cells.filter(c => !parseString(original).includes(c) || c === ' ');
      const colorPadCells = padCells.filter(c => c.startsWith('\\'));
      assert.equal(colorPadCells.length, 0, `non-space padding found for "${original}"`);
    }
  });

  it('color codes count as 1 cell for padding calculation', () => {
    // 4 color codes = 4 visual cells, should get (22-4)/2 = 9 spaces of left padding
    const original = '\\r\\g\\b\\y';
    const cells = parseString(expandRow(original));
    assert.equal(cells.length, GRID_COLS);
    const firstColor = cells.findIndex(c => c.startsWith('\\'));
    assert.equal(firstColor, 9, 'left padding should be 9 spaces for 4 color cells');
  });

  it('mixed text and color: correct cell count and padding', () => {
    // 'HE\\rLO' = 5 visual cells → (22-5)/2 = 8 left pad, 9 right pad
    const original = 'HE\\rLO';
    const cells = parseString(expandRow(original));
    assert.equal(cells.length, GRID_COLS);
    const firstNonSpace = cells.findIndex(c => c !== ' ');
    assert.equal(cells[firstNonSpace], 'H');
    assert.equal(cells[firstNonSpace + 2], '\\r', 'color should be at correct position');
    assert.equal(cells[firstNonSpace + 4], 'O');
  });

  it('contractRow detects a color substitution and keeps the advanced row', () => {
    const original = 'HE\\rLO'; // contains red
    const expanded = expandRow(original);
    // Replace \\r with \\g in the expanded form
    const modified = expanded.replace('\\r', '\\g');
    assert.notEqual(modified, expanded); // sanity check — replacement happened
    assert.equal(contractRow(modified, original), modified);
  });

  it('contractRow detects a color addition and keeps the advanced row', () => {
    const original = 'HELLO';
    const expanded = expandRow(original);
    const cells = parseString(expanded);
    // Set the first cell to a color
    cells[0] = '\\r';
    const modified = serializeCells(cells);
    assert.equal(contractRow(modified, original), modified);
  });

  it('contractRow detects a color removal and keeps the advanced row', () => {
    const original = '\\r\\g\\b';
    const expanded = expandRow(original);
    const cells = parseString(expanded);
    // Replace the \\r cell with a space
    const colorIdx = cells.findIndex(c => c === '\\r');
    cells[colorIdx] = ' ';
    const modified = serializeCells(cells);
    assert.equal(contractRow(modified, original), modified);
  });

  it('full-density color row: all 22 cells are colors', () => {
    // Build a row of 22 color codes (cycling through all 8)
    const colorKeys = Object.keys(COLOR_MAP);
    const cells = Array.from({ length: GRID_COLS }, (_, i) => '\\' + colorKeys[i % colorKeys.length]);
    const original = serializeCells(cells);
    assert.equal(countVisualChars(original), GRID_COLS);
    // expandRow should not add any padding (already at max width)
    const expanded = expandRow(original);
    assert.equal(countVisualChars(expanded), GRID_COLS);
    assert.deepEqual(parseString(expanded), cells);
    // Round-trip
    assert.equal(contractRow(expanded, original), original);
  });

  it('colors at boundary positions (column 0 and column 21) survive round-trip', () => {
    // Build a row with colors at the first and last position
    const cells = Array(GRID_COLS).fill(' ');
    cells[0] = '\\r';
    cells[GRID_COLS - 1] = '\\g';
    const original = serializeCells(cells);
    // Already 22 cells — expandRow should leave it unchanged
    const expanded = expandRow(original);
    const expandedCells = parseString(expanded);
    assert.equal(expandedCells[0], '\\r', 'color at col 0 should survive');
    assert.equal(expandedCells[GRID_COLS - 1], '\\g', 'color at col 21 should survive');
    assert.equal(contractRow(expanded, original), original);
  });

  it('all 8 colors together in one row round-trip correctly', () => {
    const original = Object.keys(COLOR_MAP).map(k => '\\' + k).join('');
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    assert.equal(contracted, original);
    // Verify each color is present in the expanded form
    for (const key of Object.keys(COLOR_MAP)) {
      assert.ok(expanded.includes('\\' + key), `\\${key} missing from expanded row`);
    }
  });

  it('color followed immediately by text (no space) round-trips correctly', () => {
    const original = '\\rHELLO\\g';
    const expanded = expandRow(original);
    const contracted = contractRow(expanded, original);
    assert.equal(contracted, original);
    const cells = parseString(contracted);
    assert.equal(cells[0], '\\r');
    assert.equal(cells[cells.length - 1], '\\g');
  });
});
