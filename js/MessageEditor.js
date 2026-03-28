import { MESSAGES } from './constants.js';

const STORAGE_KEY = 'flipoff_messages';

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

    // Delegated listener: uppercase + counter update
    this._cardsEl.addEventListener('input', (e) => {
      if (!e.target.matches('.me-row-input')) return;
      e.target.value = e.target.value.toUpperCase();
      e.target.classList.remove('error');
      const counter = e.target.nextElementSibling;
      if (counter) counter.textContent = `${e.target.value.length}/22`;
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
      this._cardsEl.appendChild(this._buildCard(message, idx));
    });
  }

  _buildCard(message, idx) {
    const card = document.createElement('div');
    card.className = 'me-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'me-card-header';

    const num = document.createElement('span');
    num.className = 'me-card-num';
    num.textContent = `Message ${idx + 1}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'me-card-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete message';
    if (this._draft.length <= 1) {
      deleteBtn.title = 'Clear message';
      deleteBtn.addEventListener('click', () => {
        card.querySelectorAll('.me-row-input').forEach(input => {
          input.value = '';
          const counter = input.nextElementSibling;
          if (counter) counter.textContent = '0/22';
        });
      });
    } else {
      deleteBtn.addEventListener('click', () => this._onDeleteCard(idx));
    }

    cardHeader.appendChild(num);
    cardHeader.appendChild(deleteBtn);
    card.appendChild(cardHeader);

    message.forEach((rowValue, rowIdx) => {
      const row = document.createElement('div');
      row.className = 'me-row';

      const label = document.createElement('span');
      label.className = 'me-row-label';
      label.textContent = `Row ${rowIdx + 1}`;

      const input = document.createElement('input');
      input.className = 'me-row-input';
      input.type = 'text';
      input.maxLength = 22;
      input.placeholder = '(blank)';
      input.value = rowValue;

      const counter = document.createElement('span');
      counter.className = 'me-row-counter';
      counter.textContent = `${rowValue.length}/22`;

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(counter);
      card.appendChild(row);
    });

    return card;
  }

  _readDraftFromDOM() {
    const cards = this._cardsEl.querySelectorAll('.me-card');
    return Array.from(cards).map(card => {
      const inputs = card.querySelectorAll('.me-row-input');
      return Array.from(inputs).map(input => input.value);
    });
  }

  _onSave() {
    const messages = this._readDraftFromDOM();

    // Validate — maxlength="22" is the primary guard but double-check here
    let hasError = false;
    const allInputs = this._cardsEl.querySelectorAll('.me-row-input');
    allInputs.forEach(input => {
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
    this._renderCards();
  }

  _onAddMessage() {
    this._draft = this._readDraftFromDOM();
    this._draft.push(['', '', '', '', '']);
    this._renderCards();
    // Scroll to the new card
    this._cardsEl.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _onDeleteCard(idx) {
    this._draft = this._readDraftFromDOM();
    if (this._draft.length <= 1) return; // always keep at least one
    this._draft.splice(idx, 1);
    this._renderCards();
  }
}
