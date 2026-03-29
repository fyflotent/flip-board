# FlipOff.

A web-based split-flap display emulator — the kind you'd see at train stations and airports.

## Features

- Realistic split-flap animation with mechanical deceleration and jitter
- Authentic mechanical clacking sound (recorded from a real split-flap display)
- Vestaboard-style color tiles — solid color blocks via `\r`, `\g`, `\b`, etc.
- Auto-rotating messages with a built-in editor
- Adjustable row count (1–10 rows)
- Fullscreen TV mode (press `F`) and `?kiosk` URL param for unattended displays
- Keyboard controls for manual navigation
- Works offline — zero external dependencies
- Responsive from mobile to 4K displays
- Pure vanilla HTML/CSS/JS — no frameworks, no build tools, no npm

## Quick Start

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

ES modules require a server — `file://` won't work.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Next message |
| `Arrow Left` | Previous message |
| `Arrow Right` | Next message |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Escape` | Exit fullscreen |

## Color Tiles

Each tile can display a character or a solid color block (Vestaboard-style). Use `\<letter>` inline in message strings:

| Code | Color  |
|------|--------|
| `\k` | black  |
| `\r` | red    |
| `\o` | orange |
| `\y` | yellow |
| `\g` | green  |
| `\b` | blue   |
| `\p` | purple |
| `\w` | white  |

Example: `HE\rLO` = H, E, red tile, L, O

Color tiles are also selectable via color swatches in the advanced message editor.

## Customization

Edit `js/constants.js` to change messages, grid size, and timing. Messages can also be edited live via the Edit button in the UI — changes persist to `localStorage`.

## License

MIT — do whatever you want with it.
