#!/usr/bin/env node
// Terminal Tetris built on Ari's university algorithm:
//
//  * The board is an array of 20 integers, one per row.
//  * Each row uses 10 bits, one per column. 0 = empty row, 1023 = full row.
//    Column 0 (left) is the highest bit (512), column 9 (right) is bit 1.
//  * A piece is 4 small integers (its rows inside a 4x4 box). To place it,
//    each piece row is shifted to the piece's column and superimposed (AND)
//    on the board row. If every AND gives 0, the piece fits, and gravity
//    tests the next row down. When it no longer fits, the piece is merged
//    into the board with OR, and every row equal to 1023 is removed.
//
// Run: node tetris.js
// Keys: left/right move, up rotates, down soft drop, space hard drop,
//       p pause, q quit.

'use strict';

const WIDTH = 10;
const HEIGHT = 20;
const FULL = (1 << WIDTH) - 1; // 1023: all 10 columns set

// Each piece: 4 rotations, each rotation = 4 rows of 4 bits.
// Bit 8 (0b1000) is the left column of the 4x4 box.
const PIECES = {
  I: [[0b0000, 0b1111, 0b0000, 0b0000], [0b0010, 0b0010, 0b0010, 0b0010],
      [0b0000, 0b0000, 0b1111, 0b0000], [0b0100, 0b0100, 0b0100, 0b0100]],
  O: [[0b0110, 0b0110, 0b0000, 0b0000], [0b0110, 0b0110, 0b0000, 0b0000],
      [0b0110, 0b0110, 0b0000, 0b0000], [0b0110, 0b0110, 0b0000, 0b0000]],
  T: [[0b0100, 0b1110, 0b0000, 0b0000], [0b0100, 0b0110, 0b0100, 0b0000],
      [0b0000, 0b1110, 0b0100, 0b0000], [0b0100, 0b1100, 0b0100, 0b0000]],
  S: [[0b0110, 0b1100, 0b0000, 0b0000], [0b0100, 0b0110, 0b0010, 0b0000],
      [0b0000, 0b0110, 0b1100, 0b0000], [0b1000, 0b1100, 0b0100, 0b0000]],
  Z: [[0b1100, 0b0110, 0b0000, 0b0000], [0b0010, 0b0110, 0b0100, 0b0000],
      [0b0000, 0b1100, 0b0110, 0b0000], [0b0100, 0b1100, 0b1000, 0b0000]],
  J: [[0b1000, 0b1110, 0b0000, 0b0000], [0b0110, 0b0100, 0b0100, 0b0000],
      [0b0000, 0b1110, 0b0010, 0b0000], [0b0100, 0b0100, 0b1100, 0b0000]],
  L: [[0b0010, 0b1110, 0b0000, 0b0000], [0b0100, 0b0100, 0b0110, 0b0000],
      [0b0000, 0b1110, 0b1000, 0b0000], [0b1100, 0b0100, 0b0100, 0b0000]],
};
const NAMES = Object.keys(PIECES);

// Shift a 4-bit piece row so the box's left column lands on board column x.
// Box column 0 sits at bit 3 of the piece row; board column c sits at bit
// (9 - c). So the shift is (9 - x) - 3 = 6 - x. We work in a wider integer
// with 3 spare bits on the right, so x can go to 9 without a negative shift,
// and anything that lands outside the 10 columns is a wall hit.
const PAD = 3;
const WALLS = ~(FULL << PAD); // every bit outside the 10 playable columns

function shiftRow(bits, x) {
  return bits << (6 - x + PAD);
}

function emptyBoard() {
  return new Array(HEIGHT).fill(0);
}

// The core test: superimpose the piece on the board rows. 0 everywhere = fits.
function fits(board, shape, x, y) {
  for (let i = 0; i < 4; i++) {
    if (shape[i] === 0) continue;
    const row = y + i;
    const piece = shiftRow(shape[i], x);
    if (piece & WALLS) return false;          // past the left or right wall
    if (row >= HEIGHT) return false;          // below the floor
    if (row < 0) continue;                    // above the top: still free
    if ((board[row] << PAD) & piece) return false; // overlaps a block
  }
  return true;
}

// Merge the piece into the board with OR.
function lock(board, shape, x, y) {
  for (let i = 0; i < 4; i++) {
    const row = y + i;
    if (shape[i] && row >= 0 && row < HEIGHT) {
      board[row] |= shiftRow(shape[i], x) >> PAD;
    }
  }
}

// Remove every row equal to FULL, add empty rows on top. Returns the count.
function clearLines(board) {
  let cleared = 0;
  for (let row = HEIGHT - 1; row >= 0; row--) {
    if (board[row] === FULL) {
      board.splice(row, 1);
      board.unshift(0);
      cleared++;
      row++; // the row above moved down into this index; test it again
    }
  }
  return cleared;
}

// ---------------------------------------------------------------- game state

const LINE_SCORES = [0, 100, 300, 500, 800];

function newGame(random = Math.random) {
  const game = {
    board: emptyBoard(), score: 0, lines: 0, level: 1,
    piece: null, next: pick(random), over: false, paused: false, random,
  };
  spawn(game);
  return game;
}

function pick(random) {
  return NAMES[Math.floor(random() * NAMES.length)];
}

function spawn(game) {
  game.piece = { name: game.next, rot: 0, x: 3, y: -1 };
  game.next = pick(game.random);
  if (!fits(game.board, shapeOf(game.piece), game.piece.x, game.piece.y)) {
    game.over = true;
  }
}

function shapeOf(p) {
  return PIECES[p.name][p.rot];
}

function tryMove(game, dx, dy, drot = 0) {
  const p = game.piece;
  const rot = (p.rot + drot + 4) % 4;
  const shape = PIECES[p.name][rot];
  // Rotation tries a small wall kick: same place, then 1 left, 1 right, 2 left/right.
  const kicks = drot ? [0, -1, 1, -2, 2] : [0];
  for (const k of kicks) {
    if (fits(game.board, shape, p.x + dx + k, p.y + dy)) {
      p.x += dx + k; p.y += dy; p.rot = rot;
      return true;
    }
  }
  return false;
}

// One gravity step: test the next row; if it does not fit, lock the piece.
function step(game) {
  if (game.over) return;
  if (tryMove(game, 0, 1)) return;
  lock(game.board, shapeOf(game.piece), game.piece.x, game.piece.y);
  const n = clearLines(game.board);
  game.lines += n;
  game.score += LINE_SCORES[n] * game.level;
  game.level = 1 + Math.floor(game.lines / 10);
  spawn(game);
}

function hardDrop(game) {
  let rows = 0;
  while (tryMove(game, 0, 1)) rows++;
  game.score += rows * 2;
  step(game);
}

// ---------------------------------------------------------------- terminal

const ESC = '\x1b[';
const COLORS = { I: 36, O: 33, T: 35, S: 32, Z: 31, J: 34, L: 37 };

function render(game) {
  // Copy of the board with the moving piece OR'ed in, for drawing only.
  const view = game.board.slice();
  const shape = shapeOf(game.piece);
  const pieceRows = new Array(HEIGHT).fill(0);
  for (let i = 0; i < 4; i++) {
    const row = game.piece.y + i;
    if (row >= 0 && row < HEIGHT) pieceRows[row] = shiftRow(shape[i], game.piece.x) >> PAD;
  }
  const color = COLORS[game.piece.name];
  const nextShape = PIECES[game.next][0];

  const lines = [];
  lines.push('  TETRIS (bit rows)');
  lines.push('  +' + '--'.repeat(WIDTH) + '+');
  for (let r = 0; r < HEIGHT; r++) {
    let s = '  |';
    for (let c = 0; c < WIDTH; c++) {
      const bit = 1 << (WIDTH - 1 - c);
      if (pieceRows[r] & bit) s += `${ESC}${color}m[]${ESC}0m`;
      else if (view[r] & bit) s += '[]';
      else s += ' .';
    }
    s += '|';
    // Side panel: row value in decimal, plus info.
    s += ' ' + String(view[r] | pieceRows[r]).padStart(4);
    if (r === 1) s += '   Next:';
    if (r >= 2 && r <= 5) {
      s += '   ';
      for (let c = 0; c < 4; c++) s += (nextShape[r - 2] & (8 >> c)) ? '[]' : '  ';
    }
    if (r === 8) s += `   Score: ${game.score}`;
    if (r === 9) s += `   Lines: ${game.lines}`;
    if (r === 10) s += `   Level: ${game.level}`;
    if (r === 13) s += '   arrows: move/rotate';
    if (r === 14) s += '   space: drop  p: pause';
    if (r === 15) s += '   q: quit';
    lines.push(s);
  }
  lines.push('  +' + '--'.repeat(WIDTH) + '+');
  if (game.over) lines.push('  GAME OVER - press q to quit, r to restart');
  else if (game.paused) lines.push('  PAUSED - press p to continue');
  else lines.push('');
  process.stdout.write(ESC + 'H' + lines.map((l) => l + ESC + 'K').join('\n'));
}

function run() {
  if (!process.stdin.isTTY) {
    console.error('Run this in a terminal: node tetris.js');
    process.exit(1);
  }
  let game = newGame();
  let timer = null;

  const speed = () => Math.max(80, 800 - (game.level - 1) * 70);
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(tick, speed());
  };
  const tick = () => {
    if (!game.paused && !game.over) step(game);
    render(game);
    schedule();
  };
  const quit = () => {
    clearTimeout(timer);
    process.stdout.write(ESC + '?25h' + ESC + '2J' + ESC + 'H');
    console.log(`Score: ${game.score}  Lines: ${game.lines}`);
    process.exit(0);
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdout.write(ESC + '?25l' + ESC + '2J');

  process.stdin.on('data', (key) => {
    if (key === 'q' || key === '\u0003') return quit();
    if (key === 'r' && game.over) { game = newGame(); render(game); return schedule(); }
    if (key === 'p') { game.paused = !game.paused; return render(game); }
    if (game.paused || game.over) return;
    switch (key) {
      case '\x1b[D': case 'a': tryMove(game, -1, 0); break;
      case '\x1b[C': case 'd': tryMove(game, 1, 0); break;
      case '\x1b[A': case 'w': tryMove(game, 0, 0, 1); break;
      case '\x1b[B': case 's': if (tryMove(game, 0, 1)) game.score += 1; break;
      case ' ': hardDrop(game); schedule(); break;
      default: return;
    }
    render(game);
  });
  process.on('exit', () => process.stdout.write(ESC + '?25h'));

  render(game);
  schedule();
}

if (require.main === module) run();

module.exports = {
  WIDTH, HEIGHT, FULL, PIECES, emptyBoard, fits, lock, clearLines,
  newGame, step, hardDrop, tryMove, shiftRow, PAD,
};
