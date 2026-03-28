import { MESSAGES } from './constants.js';

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
      !parsed.every(m => Array.isArray(m) && m.length === 5 && m.every(r => typeof r === 'string'))
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
        if (counter) counter.textContent = `${e.target.value.length}/22`;
      } else if (e.target.matches('.me-cell')) {
        e.target.value = e.target.value.toUpperCase().slice(-1);
        if (e.target.value !== '') this._moveCellFocus(e.target, 1);
      }
    });

    // Delegated keydown listener for cell grid keyboard navigation
    this._cardsEl.addEventListener('keydown', (e) => {
      if (e.target.matches('.me-cell')) this._onCellKeydown(e);
    });

    body.appendChild(this._cardsEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'me-footer';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'me-btn me-btn--ghost';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => this._onReset());

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
    footer.appendChild(resetBtn);
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
          card.querySelectorAll('.me-cell').forEach(cell => { cell.value = ''; });
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

    message.forEach((rowValue, rowIdx) => {
      const row = document.createElement('div');
      row.className = 'me-row';

      const label = document.createElement('span');
      label.className = 'me-row-label';
      label.textContent = `Row ${rowIdx + 1}`;
      row.appendChild(label);

      if (advanced) {
        row.appendChild(this._buildCellGrid(rowValue, rowIdx));
      } else {
        const input = document.createElement('input');
        input.className = 'me-row-input';
        input.type = 'text';
        input.maxLength = 22;
        input.placeholder = '(blank)';
        input.value = rowValue;

        const counter = document.createElement('span');
        counter.className = 'me-row-counter';
        counter.textContent = `${rowValue.length}/22`;

        row.appendChild(input);
        row.appendChild(counter);
      }

      card.appendChild(row);
    });

    return card;
  }

  _buildCellGrid(rowValue, rowIdx) {
    const grid = document.createElement('div');
    grid.className = 'me-cell-grid';

    const up = rowValue.toUpperCase();
    const padded = up.length >= 22 ? up.slice(0, 22) : this._expandRow(rowValue);

    for (let col = 0; col < 22; col++) {
      const cell = document.createElement('input');
      cell.className = 'me-cell';
      cell.type = 'text';
      cell.maxLength = 1;
      cell.value = padded[col] === ' ' ? '' : padded[col];
      cell.dataset.col = col;
      cell.dataset.row = rowIdx;
      cell.setAttribute('autocomplete', 'off');
      cell.setAttribute('autocorrect', 'off');
      cell.setAttribute('autocapitalize', 'characters');
      cell.setAttribute('spellcheck', 'false');
      cell.setAttribute('aria-label', `Row ${rowIdx + 1} column ${col + 1}`);
      grid.appendChild(cell);
    }

    return grid;
  }

  _expandRow(str) {
    const up = str.trim().toUpperCase();
    const padLeft = Math.floor((22 - up.length) / 2);
    return ' '.repeat(padLeft) + up + ' '.repeat(22 - padLeft - up.length);
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
    const grid = cell.closest('.me-cell-grid');
    const cells = Array.from(grid.querySelectorAll('.me-cell'));
    const idx = cells.indexOf(cell);
    const next = cells[idx + delta];
    if (next) {
      next.focus();
      next.select();
    } else if (delta > 0) {
      // End of row — move to first cell of next row's grid
      const card = cell.closest('.me-card');
      const grids = Array.from(card.querySelectorAll('.me-cell-grid'));
      const gridIdx = grids.indexOf(grid);
      grids[gridIdx + 1]?.querySelector('.me-cell')?.focus();
    } else if (delta < 0) {
      // Start of row — move to last cell of previous row's grid
      const card = cell.closest('.me-card');
      const grids = Array.from(card.querySelectorAll('.me-cell-grid'));
      const gridIdx = grids.indexOf(grid);
      const prevCells = grids[gridIdx - 1]?.querySelectorAll('.me-cell');
      if (prevCells?.length) prevCells[prevCells.length - 1].focus();
    }
  }

  _onCellKeydown(e) {
    const cell = e.target;

    switch (e.key) {
      case 'Backspace':
        if (cell.value !== '') {
          cell.value = '';
        } else {
          e.preventDefault();
          this._moveCellFocus(cell, -1);
        }
        break;

      case 'Delete':
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
        const card = cell.closest('.me-card');
        const grids = Array.from(card.querySelectorAll('.me-cell-grid'));
        const gridIdx = grids.indexOf(cell.closest('.me-cell-grid'));
        grids[gridIdx + 1]?.querySelectorAll('.me-cell')[col]?.focus();
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const col = parseInt(cell.dataset.col, 10);
        const card = cell.closest('.me-card');
        const grids = Array.from(card.querySelectorAll('.me-cell-grid'));
        const gridIdx = grids.indexOf(cell.closest('.me-cell-grid'));
        grids[gridIdx - 1]?.querySelectorAll('.me-cell')[col]?.focus();
        break;
      }

      case ' ':
        e.preventDefault();
        cell.value = ''; // empty = space on read-back
        this._moveCellFocus(cell, 1);
        break;
    }
  }

  _readDraftFromDOM() {
    const cards = this._cardsEl.querySelectorAll('.me-card');
    return Array.from(cards).map(card => {
      if (card.dataset.advanced === '1') {
        return Array.from(card.querySelectorAll('.me-cell-grid')).map(grid =>
          Array.from(grid.querySelectorAll('.me-cell'))
            .map(cell => cell.value === '' ? ' ' : cell.value.toUpperCase())
            .join('')
        );
      }
      return Array.from(card.querySelectorAll('.me-row-input')).map(input => input.value);
    });
  }

  _onSave() {
    const messages = this._readDraftFromDOM();

    // Validate simple inputs only (cell inputs are maxLength=1, can't exceed 22)
    let hasError = false;
    this._cardsEl.querySelectorAll('.me-row-input').forEach(input => {
      if (input.value.length > 22) {
        input.classList.add('error');
        hasError = true;
      }
    });
    if (hasError) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    this.rotator.setMessages(messages);
    this.close();
  }

  _onReset() {
    this._draft = MESSAGES.map(m => [...m]);
    this._advancedCards = new Set();
    this._saveAdvancedCards();
    this._renderCards();
  }

  _onAddMessage() {
    this._draft = this._readDraftFromDOM();
    this._draft.push(['', '', '', '', '']);
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
