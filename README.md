# Tetris (bit rows)

Tetris in plain JavaScript, rewritten from a university assembler version
using the same algorithm. Plays in the **browser** and in the **terminal**.
No frameworks, no dependencies. Every file is commented for learning: start
with `tetris-core.js`.

## Files

| File | What it is |
| --- | --- |
| `tetris-core.js` | The game: board, pieces, rotation, rules. Shared by both versions. |
| `index.html`, `style.css`, `browser.js` | The browser version |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make the browser version an installable, offline app |
| `terminal.js` | The terminal version |
| `tetris.test.js` | Tests for the core |

## The algorithm

1. The board is an array of 20 integers, one per row.
2. Each row uses 10 bits, one per column: `0` is an empty row, `1023` is a
   full row. Column 0 (left) is bit 512, column 9 (right) is bit 1.
3. A piece is 4 small integers: its rows inside a 4x4 box. Only rotation 0 is
   written by hand; rotations 1-3 are made by turning it 90 degrees.
4. To test a position, each piece row is shifted to the piece's column and
   superimposed on the board row with AND. If every AND gives `0`, the piece
   fits and gravity tests the next row down.
5. When the next row does not fit, the piece is merged into the board with OR.
6. Every row equal to `1023` is removed and a `0` row is added on top.
7. The side walls are bits just outside the 10 columns, so a wall hit is the
   same AND test.
8. Colours are kept in 3 **bit planes** (3 more boards of 20 integers), like
   old EGA video cards: a cell's colour number 1-7 is spread over the planes,
   one bit each.
9. The browser version creates its 200 cells once and updates only the cells
   that changed, found with XOR: `newRow ^ shownRow` has a 1 exactly on the
   changed cells.

## Play in the browser

Open the GitHub Pages site, or serve the folder with any web server
(for example `npx serve` or `python3 -m http.server`) and open it.
Opening `index.html` straight from disk does not work: browsers load
JavaScript modules only from a web server.

On a phone: drag anywhere on the screen, left or right, to move the piece
(one column per cell your finger travels), drag down to move it down, tap to
rotate, flick down fast to drop. Tap to continue after a pause. On a keyboard: arrows move
and rotate, space drops, `p` pauses.

### Install it as an app

The browser version is a PWA (Progressive Web App): it can be installed on a
phone or tablet and then plays full screen and offline.

- Android (Chrome): open the site, menu (three dots), **Install app** or
  **Add to Home screen**.
- iPhone / iPad (Safari): open the site, **Share**, **Add to Home Screen**.

`manifest.webmanifest` holds the app's name and icons, `sw.js` (the service
worker) saves the files for offline play and fetches updates when online.

## Play in the terminal

```
node terminal.js
```

or `npm start`. Needs Node.js 18 or newer (on Android: Termux,
`pkg install nodejs`).

| Key | Action |
| --- | --- |
| Left / Right (or `a` / `d`) | Move |
| Up (or `w`) | Rotate |
| Down (or `s`) | Soft drop |
| Space | Hard drop |
| `p` | Pause |
| `r` | Restart after game over |
| `q` | Quit |

## Test

```
npm test
```
