import { MESSAGES, COLOR_MAP } from './constants.js';
import { parseString, countVisualChars, serializeCells } from './colorParser.js';
import { getGridRows } from './settings.js';

const COLOR_NAMES = {
  k: 'Black', r: 'Red', o: 'Orange', y: 'Yellow',
  g: 'Green', b: 'Blue', p: 'Purple', w: 'White'
};
const COLOR_KEYS = new Set(Object.keys(COLOR_MAP));

const STORAGE_KEY = 'flipoff_messages';
const ADVANCED_KEY = 'flipoff_advanced_cards';

function loadAdvancedCards() {
  try {
    const raw = localStorage.getItem(ADVANCED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(n => typeof n === 'number');
  } catch {
    return [];
  }
}

export function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every(m => Array.isArray(m) && m.length === getGridRows() && m.every(r => typeof r === 'string'))
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export class MessageEditor {
  constructor(rotator) {
    this.rotator = rotator;
    this._draft = [];
    this._advancedCards = new Set(loadAdvancedCards());
    this._preAdvancedRows = new Map(); // idx → original rows before entering advanced
    this._modal = null;
    this._backdrop = null;
    this._cardsEl = null;
  }

  open() {
    if (!this._modal) this._buildModal();
    // Init draft from whatever is currently live in the rotator
    this._draft = this.rotator.messages.map(m => [...m]);
    this._renderCards();
    this._backdrop.classList.add('visible');
    this._modal.classList.add('visible');
    this.rotator._paused = true;
  }

  close() {
    if (!this._modal) return;
    this._modal.classList.remove('visible');
    this._backdrop.classList.remove('visible');
    this.rotator._paused = false;
  }

  _buildModal() {
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'me-backdrop';
    this._backdrop.addEventListener('click', () => this.close());

    this._modal = document.createElement('div');
    this._modal.className = 'me-modal';
    this._modal.setAttribute('role', 'dialog');
    this._modal.setAttribute('aria-modal', 'true');
    this._modal.setAttribute('aria-label', 'Edit Messages');

    // Header
    const header = document.createElement('div');
    header.className = 'me-header';
    const title = document.createElement('h2');
    title.className = 'me-title';
    title.textContent = 'Messages';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'me-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body (scrollable card list)
    const body = document.createElement('div');
    body.className = 'me-body';
    this._cardsEl = document.createElement('div');
    this._cardsEl.className = 'me-cards';
    this._cardsEl.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    // Delegated input listener: handles both simple inputs and cell grids
    this._cardsEl.addEventListener('input', (e) => {
      if (e.target.matches('.me-row-input')) {
        e.target.value = e.target.value.toUpperCase();
        e.target.classList.remove('error');
        const counter = e.target.nextElementSibling;
        if (counter) counter.textContent = `${countVisualChars(e.target.value)}/22`;
      } else if (e.target.matches('.me-cell')) {
        const val = e.target.value;

        if (val.length === 2 && val[0] === '\\') {
          const key = val[1].toLowerCase();
          if (COLOR_KEYS.has(key)) {
            // \<colorKey> typed — activate color mode and advance
            const code = '\\' + key;
            e.target.value = '';
            e.target.dataset.colorCode = code;
            e.target.style.backgroundColor = COLOR_MAP[key];
            e.target.classList.add('me-cell--colored');
            this._moveCellFocus(e.target, 1);
          } else {
            // \<non-color> — drop the backslash, keep the second char
            if (e.target.dataset.colorCode) this._clearCellColor(e.target);
            e.target.value = val[1].toUpperCase();
            this._moveCellFocus(e.target, 1);
          }
        } else if (val === '\\') {
          // Partial — waiting for the color key, don't advance yet
        } else {
          if (e.target.dataset.colorCode) this._clearCellColor(e.target);
          e.target.value = val.toUpperCase().slice(-1);
          if (e.target.value !== '') this._moveCellFocus(e.target, 1);
        }
      }
    });

    // Delegated keydown listener for cell grid keyboard navigation
    this._cardsEl.addEventListener('keydown', (e) => {
      if (e.target.matches('.me-cell')) this._onCellKeydown(e);
    });

    // Prevent focus when clicking a colored cell (so click cycles color instead)
    this._cardsEl.addEventListener('mousedown', (e) => {
      if (e.target.matches('.me-cell') && e.target.dataset.colorCode) {
        e.preventDefault();
      }
    });

    // Click a colored cell to cycle through colors; shift+click to go backwards
    this._cardsEl.addEventListener('click', (e) => {
      if (e.target.matches('.me-cell') && e.target.dataset.colorCode) {
        this._cycleInputColor(e.target, e.shiftKey ? -1 : 1);
      }
    });

    body.appendChild(this._cardsEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'me-footer';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'me-btn me-btn--ghost';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => this._onReset());

    const exportBtn = document.createElement('button');
    exportBtn.className = 'me-btn me-btn--ghost';
    exportBtn.textContent = 'Export JSON';
    exportBtn.addEventListener('click', () => this._onExport());

    const importBtn = document.createElement('button');
    importBtn.className = 'me-btn me-btn--ghost';
    importBtn.textContent = 'Import JSON';
    importBtn.addEventListener('click', () => this._onImport());

    const footerRight = document.createElement('div');
    footerRight.className = 'me-footer-right';

    const addBtn = document.createElement('button');
    addBtn.className = 'me-btn me-btn--ghost';
    addBtn.textContent = '+ Add message';
    addBtn.addEventListener('click', () => this._onAddMessage());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'me-btn me-btn--primary';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => this._onSave());

    footerRight.appendChild(addBtn);
    footerRight.appendChild(saveBtn);
    const footerLeft = document.createElement('div');
    footerLeft.style.cssText = 'display:flex;gap:8px;';
    footerLeft.appendChild(resetBtn);
    footerLeft.appendChild(exportBtn);
    footerLeft.appendChild(importBtn);
    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);

    this._modal.appendChild(header);
    this._modal.appendChild(body);
    this._modal.appendChild(footer);

    document.body.appendChild(this._backdrop);
    document.body.appendChild(this._modal);

    // Escape closes the modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._modal.classList.contains('visible')) {
        e.stopImmediatePropagation();
        this.close();
      }
    });
  }

  _renderCards() {
    this._cardsEl.innerHTML = '';
    this._draft.forEach((message, idx) => {
      this._cardsEl.appendChild(
        this._buildCard(message, idx, this._advancedCards.has(idx))
      );
    });
  }

  _buildCard(message, idx, advanced = false) {
    const card = document.createElement('div');
    card.className = 'me-card';
    card.dataset.advanced = advanced ? '1' : '0';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'me-card-header';

    const num = document.createElement('span');
    num.className = 'me-card-num';
    num.textContent = `Message ${idx + 1}`;

    // Group advanced toggle + delete on the right side of the header
    const headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const advBtn = document.createElement('button');
    advBtn.className = 'me-advanced-toggle' + (advanced ? ' active' : '');
    advBtn.textContent = '··· Advanced';
    advBtn.title = advanced ? 'Switch to simple mode' : 'Switch to advanced mode';
    advBtn.addEventListener('click', () => this._toggleAdvanced(idx));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'me-card-delete';
    deleteBtn.textContent = '✕';

    if (this._draft.length <= 1) {
      deleteBtn.title = 'Clear message';
      deleteBtn.addEventListener('click', () => {
        if (advanced) {
          card.querySelectorAll('.me-cell').forEach(input => {
            input.value = '';
            if (input.dataset.colorCode) this._clearCellColor(input);
          });
        } else {
          card.querySelectorAll('.me-row-input').forEach(input => {
            input.value = '';
            const counter = input.nextElementSibling;
            if (counter) counter.textContent = '0/22';
          });
        }
      });
    } else {
      deleteBtn.title = 'Delete message';
      deleteBtn.addEventListener('click', () => this._onDeleteCard(idx));
    }

    headerRight.appendChild(advBtn);
    headerRight.appendChild(deleteBtn);
    cardHeader.appendChild(num);
    cardHeader.appendChild(headerRight);
    card.appendChild(cardHeader);

    if (advanced) {
      card.appendChild(this._buildUnifiedGrid(message));
    } else {
      message.forEach((rowValue, rowIdx) => {
        const row = document.createElement('div');
        row.className = 'me-row';

        const label = document.createElement('span');
        label.className = 'me-row-label';
        label.textContent = `Row ${rowIdx + 1}`;
        row.appendChild(label);

        const input = document.createElement('input');
        input.className = 'me-row-input';
        input.type = 'text';
        input.placeholder = '(blank)';
        input.value = rowValue;

        const counter = document.createElement('span');
        counter.className = 'me-row-counter';
        counter.textContent = `${countVisualChars(rowValue)}/22`;

        row.appendChild(input);
        row.appendChild(counter);
        card.appendChild(row);
      });
    }

    return card;
  }

  _buildUnifiedGrid(message) {
    const section = document.createElement('div');
    section.className = 'me-adv-section';

    const wrap = document.createElement('div');
    wrap.className = 'me-adv-grid-wrap';
    wrap.dataset.paintColor = '';

    const toolbar = this._buildPaletteToolbar(wrap);
    section.appendChild(toolbar);

    const gridInner = document.createElement('div');
    gridInner.className = 'me-grid-inner';

    message.forEach((rowValue, rowIdx) => {
      // Row label (first CSS grid column)
      const label = document.createElement('div');
      label.className = 'me-adv-row-label';
      label.textContent = rowIdx + 1;
      gridInner.appendChild(label);

      // Parse row into 22 cells, center-padded
      const parsed = parseString(rowValue);
      const padLeft = Math.max(0, Math.floor((22 - parsed.length) / 2));
      const cells = Array(padLeft).fill(' ')
        .concat(parsed)
        .concat(Array(Math.max(0, 22 - padLeft - parsed.length)).fill(' '))
        .slice(0, 22);
      while (cells.length < 22) cells.push(' ');

      for (let col = 0; col < 22; col++) {
        const cellValue = cells[col];
        const isColor = cellValue.length === 2 && cellValue[0] === '\\';

        const colDiv = document.createElement('div');
        colDiv.className = 'me-cell-col';
        colDiv.dataset.row = rowIdx;
        colDiv.dataset.col = col;

        const input = document.createElement('input');
        input.className = 'me-cell';
        input.type = 'text';
        input.maxLength = 2;
        input.dataset.col = col;
        input.dataset.row = rowIdx;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'characters');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('aria-label', `Row ${rowIdx + 1} column ${col + 1}`);

        if (isColor) {
          const key = cellValue[1];
          input.dataset.colorCode = cellValue;
          input.style.backgroundColor = COLOR_MAP[key];
          input.classList.add('me-cell--colored');
        } else {
          input.value = cellValue === ' ' ? '' : cellValue;
          input.dataset.colorCode = '';
        }

        colDiv.appendChild(input);
        gridInner.appendChild(colDiv);
      }

      // Row separator (not after last row)
      if (rowIdx < message.length - 1) {
        const rule = document.createElement('div');
        rule.className = 'me-row-rule';
        gridInner.appendChild(rule);
      }
    });

    wrap.appendChild(gridInner);
    wrap.appendChild(this._buildPaintOverlay(wrap, gridInner));
    section.appendChild(wrap);

    return section;
  }

  _buildPaletteToolbar(wrap) {
    const toolbar = document.createElement('div');
    toolbar.className = 'me-palette-toolbar';

    const entries = [
      { code: '', label: 'T', title: 'Text mode', bg: null },
      { code: 'erase', label: '✕', title: 'Erase', bg: null },
      ...Object.entries(COLOR_MAP).map(([key, hex]) => ({
        code: '\\' + key, label: '', title: COLOR_NAMES[key], bg: hex
      }))
    ];

    entries.forEach(({ code, label, title, bg }) => {
      const btn = document.createElement('button');
      btn.className = 'me-palette-swatch' + (code === '' ? ' me-palette-swatch--active' : '');
      btn.type = 'button';
      btn.dataset.color = code;
      btn.title = title;
      if (label) btn.textContent = label;
      if (bg) btn.style.backgroundColor = bg;

      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.me-palette-swatch')
          .forEach(s => s.classList.remove('me-palette-swatch--active'));
        btn.classList.add('me-palette-swatch--active');
        wrap.dataset.paintColor = code;
        wrap.classList.toggle('me-adv-grid--painting', code !== '');
      });

      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  _buildPaintOverlay(wrap, gridInner) {
    const overlay = document.createElement('div');
    overlay.className = 'me-adv-overlay';

    let painting = false;
    let lastPainted = null;

    const hitCell = (e) => {
      overlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = '';
      return el?.closest('.me-cell-col') ?? null;
    };

    overlay.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      painting = true;
      lastPainted = null;
      overlay.setPointerCapture(e.pointerId);
      const colDiv = hitCell(e);
      if (colDiv) {
        lastPainted = colDiv;
        this._paintCell(wrap, colDiv);
      }
    });

    overlay.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const colDiv = hitCell(e);
      if (colDiv && colDiv !== lastPainted) {
        lastPainted = colDiv;
        this._paintCell(wrap, colDiv);
      }
    });

    const stopPainting = () => { painting = false; lastPainted = null; };
    overlay.addEventListener('pointerup', stopPainting);
    overlay.addEventListener('pointercancel', stopPainting);

    return overlay;
  }

  _paintCell(wrap, colDiv) {
    const colorCode = wrap.dataset.paintColor;
    const input = colDiv.querySelector('.me-cell');
    if (!input) return;

    if (colorCode && colorCode[0] === '\\') {
      const key = colorCode[1];
      input.dataset.colorCode = colorCode;
      input.style.backgroundColor = COLOR_MAP[key];
      input.value = '';
      input.classList.add('me-cell--colored');
    } else {
      this._clearCellColor(input);
      input.value = '';
    }
  }

  _clearCellColor(input) {
    input.dataset.colorCode = '';
    input.style.backgroundColor = '';
    input.classList.remove('me-cell--colored');
  }

  _cycleInputColor(input, direction) {
    const cycle = Object.keys(COLOR_MAP).map(k => '\\' + k);
    const idx = cycle.indexOf(input.dataset.colorCode);
    const next = idx + direction;
    if (next < 0 || next >= cycle.length) {
      this._clearCellColor(input);
    } else {
      const code = cycle[next];
      input.dataset.colorCode = code;
      input.style.backgroundColor = COLOR_MAP[code[1]];
      input.classList.add('me-cell--colored');
    }
  }

  _expandRow(str) {
    const cells = parseString(str.trim());
    const padLeft = Math.max(0, Math.floor((22 - cells.length) / 2));
    const padded = Array(padLeft).fill(' ')
      .concat(cells)
      .concat(Array(Math.max(0, 22 - padLeft - cells.length)).fill(' '))
      .slice(0, 22);
    while (padded.length < 22) padded.push(' ');
    return serializeCells(padded);
  }

  _saveAdvancedCards() {
    localStorage.setItem(ADVANCED_KEY, JSON.stringify([...this._advancedCards]));
  }

  _toggleAdvanced(idx) {
    this._draft = this._readDraftFromDOM();

    if (!this._advancedCards.has(idx)) {
      // Entering advanced mode: store originals, expand each row to 22 chars
      this._preAdvancedRows.set(idx, [...this._draft[idx]]);
      this._draft[idx] = this._draft[idx].map(r => this._expandRow(r));
      this._advancedCards.add(idx);
    } else {
      // Leaving advanced mode: restore originals if nothing was changed
      const originals = this._preAdvancedRows.get(idx);
      this._preAdvancedRows.delete(idx);
      if (originals) {
        const unchanged = this._draft[idx].every(
          (row, i) => row === this._expandRow(originals[i])
        );
        if (unchanged) this._draft[idx] = originals;
      }
      this._advancedCards.delete(idx);
    }

    this._saveAdvancedCards();
    this._renderCards();
  }

  _moveCellFocus(cell, delta) {
    const gridInner = cell.closest('.me-grid-inner');
    if (!gridInner) return;
    const cells = Array.from(gridInner.querySelectorAll('.me-cell'));
    const idx = cells.indexOf(cell);
    const next = cells[idx + delta];
    if (next) {
      next.focus();
      next.select();
    }
  }

  _onCellKeydown(e) {
    const cell = e.target;

    switch (e.key) {
      case 'Backspace':
        if (cell.dataset.colorCode) {
          this._clearCellColor(cell);
        } else if (cell.value !== '') {
          cell.value = '';
        } else {
          e.preventDefault();
          this._moveCellFocus(cell, -1);
        }
        break;

      case 'Delete':
        if (cell.dataset.colorCode) this._clearCellColor(cell);
        cell.value = '';
        break;

      case 'ArrowRight':
        e.preventDefault();
        this._moveCellFocus(cell, 1);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this._moveCellFocus(cell, -1);
        break;

      case 'ArrowDown': {
        e.preventDefault();
        const col = parseInt(cell.dataset.col, 10);
        const row = parseInt(cell.dataset.row, 10);
        cell.closest('.me-card')
          ?.querySelector(`.me-cell[data-row="${row + 1}"][data-col="${col}"]`)
          ?.focus();
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const col = parseInt(cell.dataset.col, 10);
        const row = parseInt(cell.dataset.row, 10);
        cell.closest('.me-card')
          ?.querySelector(`.me-cell[data-row="${row - 1}"][data-col="${col}"]`)
          ?.focus();
        break;
      }

      case ' ':
        e.preventDefault();
        if (cell.dataset.colorCode) this._clearCellColor(cell);
        cell.value = ''; // empty = space on read-back
        this._moveCellFocus(cell, 1);
        break;
    }
  }

  _readDraftFromDOM() {
    const cards = this._cardsEl.querySelectorAll('.me-card');
    return Array.from(cards).map(card => {
      if (card.dataset.advanced === '1') {
        const numRows = getGridRows();
        return Array.from({ length: numRows }, (_, r) =>
          serializeCells(
            Array.from(card.querySelectorAll(`.me-cell-col[data-row="${r}"]`)).map(colDiv => {
              const input = colDiv.querySelector('.me-cell');
              if (input.dataset.colorCode) return input.dataset.colorCode;
              return input.value === '' ? ' ' : input.value.toUpperCase();
            })
          )
        );
      }
      return Array.from(card.querySelectorAll('.me-row-input')).map(input => input.value);
    });
  }

  _onSave() {
    const messages = this._readDraftFromDOM();

    // Validate simple inputs (no maxLength set; count visual chars including color codes)
    let hasError = false;
    this._cardsEl.querySelectorAll('.me-row-input').forEach(input => {
      if (countVisualChars(input.value) > 22) {
        input.classList.add('error');
        hasError = true;
      }
    });
    if (hasError) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    this.rotator.setMessages(messages);
    this.close();
  }

  _onExport() {
    const messages = this._readDraftFromDOM();
    const json = JSON.stringify(messages, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'flipoff-messages.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _onImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (
            !Array.isArray(parsed) ||
            parsed.length === 0 ||
            !parsed.every(m => Array.isArray(m) && m.length > 0 && m.every(r => typeof r === 'string'))
          ) {
            alert('Invalid format: expected an array of messages.');
            return;
          }
          const rows = getGridRows();
          this._draft = parsed.map(m =>
            m.length === rows ? m : Array.from({ length: rows }, (_, i) => m[i] ?? '')
          );
          this._advancedCards = new Set();
          this._saveAdvancedCards();
          this._renderCards();
        } catch {
          alert('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  _onReset() {
    this._draft = MESSAGES.map(m => [...m]);
    this._advancedCards = new Set();
    this._saveAdvancedCards();
    this._renderCards();
  }

  _onAddMessage() {
    this._draft = this._readDraftFromDOM();
    this._draft.push(Array(getGridRows()).fill(''));
    // New card is always simple — no index adjustment needed
    this._renderCards();
    this._cardsEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _onDeleteCard(idx) {
    this._draft = this._readDraftFromDOM();
    if (this._draft.length <= 1) return;
    this._draft.splice(idx, 1);

    // Re-index advanced card set
    const next = new Set();
    for (const i of this._advancedCards) {
      if (i < idx) next.add(i);
      else if (i > idx) next.add(i - 1);
    }
    this._advancedCards = next;
    this._saveAdvancedCards();
    this._renderCards();
  }
}
