import { CHARSET, SCRAMBLE_DURATION, FLIP_DURATION } from './constants.js';

export class Tile {
  constructor(row, col) {
    this.row = row;
    this.col = col;
    this.currentChar = ' ';
    this.isAnimating = false;
    this._scrambleTimer = null;

    // Build DOM
    this.el = document.createElement('div');
    this.el.className = 'tile';

    this.innerEl = document.createElement('div');
    this.innerEl.className = 'tile-inner';

    this.frontEl = document.createElement('div');
    this.frontEl.className = 'tile-front';
    this.frontSpan = document.createElement('span');
    this.frontEl.appendChild(this.frontSpan);

    this.backEl = document.createElement('div');
    this.backEl.className = 'tile-back';
    this.backSpan = document.createElement('span');
    this.backEl.appendChild(this.backSpan);

    this.innerEl.appendChild(this.frontEl);
    this.innerEl.appendChild(this.backEl);
    this.el.appendChild(this.innerEl);
  }

  setChar(char) {
    this.currentChar = char;
    this.frontSpan.textContent = char === ' ' ? '' : char;
    this.backSpan.textContent = '';
    this.frontEl.style.backgroundColor = '';
  }

  scrambleTo(targetChar, delay) {
    if (targetChar === this.currentChar) return;

    // Cancel any in-progress animation
    if (this._scrambleTimer) {
      clearInterval(this._scrambleTimer);
      this._scrambleTimer = null;
    }
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

    setTimeout(() => {
      this.el.classList.add('scrambling');
      let step = 0;
      const scrambleInterval = 70;

      this._scrambleTimer = setInterval(() => {
        const char = sequence[step];
        this.frontSpan.textContent = char === ' ' ? '' : char;
        step++;

        if (step >= sequence.length) {
          clearInterval(this._scrambleTimer);
          this._scrambleTimer = null;

          // Quick flash effect: brief scale transform
          this.innerEl.style.transition = `transform ${FLIP_DURATION}ms ease-in-out`;
          this.innerEl.style.transform = 'perspective(400px) rotateX(-8deg)';

          setTimeout(() => {
            this.innerEl.style.transform = '';
            setTimeout(() => {
              this.innerEl.style.transition = '';
              this.el.classList.remove('scrambling');
              this.currentChar = targetChar;
              this.isAnimating = false;
            }, FLIP_DURATION);
          }, FLIP_DURATION / 2);
        }
      }, scrambleInterval);
    }, delay);
  }
}
