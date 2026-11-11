'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('./tetris');

const O = T.PIECES.O[0]; // rows 0b0110, 0b0110 -> box columns 1 and 2
const I = T.PIECES.I[0]; // row 1 = 0b1111

test('full row is 1023 and empty row is 0', () => {
  assert.strictEqual(T.FULL, 1023);
  assert.deepStrictEqual(T.emptyBoard(), new Array(20).fill(0));
});

test('piece lands where the AND with the next row stops being 0', () => {
  const board = T.emptyBoard();
  let y = 0;
  while (T.fits(board, O, 3, y + 1)) y++;
  assert.strictEqual(y, 18); // O occupies rows 18 and 19
  T.lock(board, O, 3, y);
  // box columns 1-2 at x=3 -> board columns 4,5 -> bits 32+16 = 48
  assert.strictEqual(board[18], 48);
  assert.strictEqual(board[19], 48);
  assert.strictEqual(T.fits(board, O, 3, 16), true);
  assert.strictEqual(T.fits(board, O, 3, 17), false);
});

test('walls: I piece fits from column 0 to 6, not beyond', () => {
  const board = T.emptyBoard();
  assert.ok(T.fits(board, I, 0, 0));
  assert.ok(T.fits(board, I, 6, 0));
  assert.ok(!T.fits(board, I, -1, 0));
  assert.ok(!T.fits(board, I, 7, 0));
  const V = T.PIECES.I[1]; // vertical, box column 2
  assert.ok(T.fits(board, V, -2, 0));
  assert.ok(T.fits(board, V, 7, 0));
  assert.ok(!T.fits(board, V, 8, 0));
});

test('full rows are removed and rows above fall', () => {
  const board = T.emptyBoard();
  board[19] = 1023;
  board[18] = 1;
  board[17] = 1023;
  board[16] = 512;
  assert.strictEqual(T.clearLines(board), 2);
  assert.strictEqual(board[19], 1);
  assert.strictEqual(board[18], 512);
  assert.strictEqual(board[17], 0);
});

test('game: hard drops end in game over, score counts', () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = T.newGame(rnd);
  let drops = 0;
  while (!g.over && drops < 500) { T.hardDrop(g); drops++; }
  assert.ok(g.over);
  assert.ok(g.score > 0);
  for (const row of g.board) assert.ok(row >= 0 && row <= 1023);
});
