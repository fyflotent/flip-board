# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

No build step — open `index.html` directly in a browser or serve with any static file server:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

ES modules require a server (not `file://`). There are no dependencies, no npm, no bundler.

## Architecture

Vanilla JS ES modules wired in `main.js`. Data flows:

```
MessageRotator → Board.displayMessage(lines[]) → Board._formatToGrid() → Tile.scrambleTo()
```

**Key files:**
- `js/constants.js` — all config: grid size, charset, `FULL_CHARSET`, `COLOR_MAP`, default messages
- `js/colorParser.js` — parses inline color codes (`\r`, `\g`, etc.) in message strings
- `js/Tile.js` — individual tile: DOM structure (top/bottom halves), CSS flip animation, scramble sequence logic
- `js/Board.js` — grid manager: creates tiles, calls `_formatToGrid`, orchestrates transitions
- `js/MessageEditor.js` — modal UI for editing/saving messages; both simple (text) and advanced (per-cell) modes
- `js/settings.js` — localStorage for row count; adjusts stored messages on resize before reload
- `js/SoundEngine.js` — Web Audio API; single transition clip from base64 in `flapAudio.js`

## Tile State Model

Each tile position holds either a **character** (`'A'`, `' '`) or a **color code** (`'\\r'`, `'\\g'`) — a 2-char JS string starting with backslash. The `FULL_CHARSET` array defines the complete animation sequence:

```
['\\k', 'A'-'Z', '0'-'9', punct, ' ', '\\r', '\\o', '\\y', '\\g', '\\b', '\\p', '\\w']
```

Black (`\k`) is first; character states are in the middle; other colors are at the end. When a tile scrambles to its target, it steps forward through `FULL_CHARSET` from its current position, wrapping around.

Color tiles use a CSS variable `--tile-bg` on `.tile` which cascades to `.tile-top/.tile-bottom` backgrounds; character tiles clear this variable.

## Color Codes

| Code | Color  | Hex       |
|------|--------|-----------|
| `\k` | black  | `#000000` |
| `\r` | red    | `#FF2200` |
| `\o` | orange | `#FF8800` |
| `\y` | yellow | `#FFDD00` |
| `\g` | green  | `#22BB44` |
| `\b` | blue   | `#0088FF` |
| `\p` | purple | `#9900CC` |
| `\w` | white  | `#FFFFFF` |

Use in message strings: `"HE\rLO"` = H, E, red tile, L, O (5 columns).

## Performance Notes

- **Never use `el.offsetWidth` to flush styles** before restarting a CSS animation — it forces full synchronous layout reflow across all tiles. Use `void getComputedStyle(el).animationName` instead (style flush only).
- `contain: layout style` on `.tile` scopes browser layout work per-tile.
- Transition stagger is capped at 5 rows (`Math.min(rows, 5) * cols * STAGGER_DELAY`) regardless of actual row count, so large boards don't slow down.

## URL Params

`?kiosk` adds `body.kiosk` class — mirrors fullscreen CSS (no header, full viewport board, `cursor: none`) without requiring browser fullscreen. Useful for Chromecast / Raspberry Pi display.

## Persistent State

`localStorage` stores:
- `flipoff-messages` — array of message objects `{ rows: string[] }`
- `flipoff-grid-rows` — current row count (1–10)

`settings.js` adjusts stored messages when row count changes before page reload, ensuring `loadMessages()` length validation passes.
