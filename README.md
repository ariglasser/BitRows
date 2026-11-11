# Tetris (bit rows)

Terminal Tetris in plain Node.js, rewritten from a university assembler
version using the same algorithm. No dependencies.

## The algorithm

1. The board is an array of 20 integers, one per row.
2. Each row uses 10 bits, one per column: `0` is an empty row, `1023` is a
   full row. Column 0 (left) is bit 512, column 9 (right) is bit 1.
3. A piece is 4 small integers: its rows inside a 4x4 box.
4. To test a position, each piece row is shifted to the piece's column and
   superimposed on the board row with AND. If every AND gives `0`, the piece
   fits and gravity tests the next row down.
5. When the next row does not fit, the piece is merged into the board with OR.
6. Every row equal to `1023` is removed and a `0` row is added on top.
7. The side walls are bits just outside the 10 columns, so a wall hit is the
   same AND test.

The number next to each row on screen is that row's integer value.

## Run

```
node tetris.js
```

or `npm start`. Needs Node.js 18 or newer and a real terminal (on Android:
Termux, `pkg install nodejs`).

## Keys

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
