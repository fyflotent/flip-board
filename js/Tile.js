import { FULL_CHARSET, COLOR_MAP } from './constants.js';

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

  // Update DOM to reflect a tile value (char or color code). Does not update currentChar.
  _renderValue(value) {
    if (value.length === 2 && value[0] === '\\') {
      const hex = COLOR_MAP[value[1]];
      this.el.style.setProperty('--tile-bg', hex);
      this.topSpan.textContent = '';
      this.bottomSpan.textContent = '';
    } else {
      this.el.style.removeProperty('--tile-bg');
      const text = value === ' ' ? '' : value;
      this.topSpan.textContent = text;
      this.bottomSpan.textContent = text;
    }
  }

  setChar(value) {
    this.currentChar = value;
    this._renderValue(value);
  }

  scrambleTo(targetChar, delay) {
    if (targetChar === this.currentChar) return;

    // Increment version to cancel any in-progress animation
    this._flipVersion++;
    const myVersion = this._flipVersion;
    const cancelled = () => this._flipVersion !== myVersion;

    this.isAnimating = true;

    // Build the sequence of states to flip through, wrapping around FULL_CHARSET
    const fromIndex = FULL_CHARSET.indexOf(this.currentChar);
    const toIndex = FULL_CHARSET.indexOf(targetChar);
    const startIndex = fromIndex === -1 ? 0 : fromIndex;
    const endIndex = toIndex === -1 ? 0 : toIndex;

    const sequence = [];
    let i = (startIndex + 1) % FULL_CHARSET.length;
    while (i !== endIndex) {
      sequence.push(FULL_CHARSET[i]);
      i = (i + 1) % FULL_CHARSET.length;
    }
    sequence.push(targetChar);

    // Base flip speed scaled so total animation stays ~1s regardless of sequence length
    const baseDuration = Math.min(150, Math.max(40, 1000 / sequence.length));

    // Last few flips slow down to simulate mechanical deceleration
    const slowSteps = Math.min(4, sequence.length);
    const getDuration = (index) => {
      const stepsFromEnd = sequence.length - 1 - index;
      if (stepsFromEnd < slowSteps) {
        const t = 1 - stepsFromEnd / slowSteps;
        return Math.round(baseDuration * (1 + t * 1.5));
      }
      return baseDuration;
    };

    const flipStep = (index) => {
      if (cancelled()) return;
      if (index >= sequence.length) {
        this.el.classList.remove('scrambling');
        this.currentChar = targetChar;
        this.isAnimating = false;
        return;
      }

      const stepDuration = getDuration(index) * (0.85 + Math.random() * 0.3);
      this.el.style.setProperty('--char-flip-duration', `${stepDuration}ms`);

      const value = sequence[index];
      this.topEl.classList.add('flipping');

      // At midpoint the top flap is edge-on (invisible) — swap both halves
      setTimeout(() => {
        if (cancelled()) return;
        this._renderValue(value);
      }, stepDuration / 2);

      setTimeout(() => {
        if (cancelled()) return;
        this.topEl.classList.remove('flipping');
        void getComputedStyle(this.topEl).animationName; // flush styles (not layout) so animation restarts
        flipStep(index + 1);
      }, stepDuration);
    };

    setTimeout(() => {
      if (cancelled()) return;
      this.el.classList.add('scrambling');
      flipStep(0);
    }, delay);
  }
}
