import { CHARSET } from './constants.js';

export class Tile {
  constructor(row, col) {
    this.row = row;
    this.col = col;
    this.currentChar = ' ';
    this.isAnimating = false;
    this._flipVersion = 0;

    this.el = document.createElement('div');
    this.el.className = 'tile';

    this.topEl = document.createElement('div');
    this.topEl.className = 'tile-top';
    this.topSpan = document.createElement('span');
    this.topEl.appendChild(this.topSpan);

    this.bottomEl = document.createElement('div');
    this.bottomEl.className = 'tile-bottom';
    this.bottomSpan = document.createElement('span');
    this.bottomEl.appendChild(this.bottomSpan);

    this.el.appendChild(this.topEl);
    this.el.appendChild(this.bottomEl);
  }

  setChar(char) {
    this.currentChar = char;
    const text = char === ' ' ? '' : char;
    this.topSpan.textContent = text;
    this.bottomSpan.textContent = text;
  }

  scrambleTo(targetChar, delay) {
    if (targetChar === this.currentChar) return;

    // Increment version to cancel any in-progress animation
    this._flipVersion++;
    const myVersion = this._flipVersion;
    const cancelled = () => this._flipVersion !== myVersion;

    this.isAnimating = true;

    // Build the sequence of chars to flip through, wrapping around the charset
    const fromIndex = CHARSET.indexOf(this.currentChar);
    const toIndex = CHARSET.indexOf(targetChar);
    const startIndex = fromIndex === -1 ? 0 : fromIndex;
    const endIndex = toIndex === -1 ? 0 : toIndex;

    const sequence = [];
    let i = (startIndex + 1) % CHARSET.length;
    while (i !== endIndex) {
      sequence.push(CHARSET[i]);
      i = (i + 1) % CHARSET.length;
    }
    sequence.push(targetChar);

    // Scale flip speed so total animation stays ~1s regardless of sequence length
    const flipDuration = Math.min(150, Math.max(40, 1000 / sequence.length));
    this.el.style.setProperty('--char-flip-duration', `${flipDuration}ms`);

    const flipStep = (index) => {
      if (cancelled()) return;
      if (index >= sequence.length) {
        this.el.classList.remove('scrambling');
        this.currentChar = targetChar;
        this.isAnimating = false;
        return;
      }

      const char = sequence[index];
      this.topEl.classList.add('flipping');

      // At midpoint the top flap is edge-on (invisible) — swap both halves
      setTimeout(() => {
        if (cancelled()) return;
        const text = char === ' ' ? '' : char;
        this.topSpan.textContent = text;
        this.bottomSpan.textContent = text;
      }, flipDuration / 2);

      setTimeout(() => {
        if (cancelled()) return;
        this.topEl.classList.remove('flipping');
        void this.topEl.offsetWidth; // force reflow so animation restarts next step
        flipStep(index + 1);
      }, flipDuration);
    };

    setTimeout(() => {
      if (cancelled()) return;
      this.el.classList.add('scrambling');
      flipStep(0);
    }, delay);
  }
}
