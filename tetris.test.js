// =============================================================================
//  TESTS FOR THE TETRIS ALGORITHM
// =============================================================================
//
//  A TEST is a small program that runs your code with known inputs and checks
//  that the answer is what you expect. If someone changes tetris.js and breaks
//  something, a test fails and tells them, before anyone plays a broken game.
//
//  Run all tests with:   npm test      (or:  node --test)
//  You should see "pass 5" and "fail 0".
//
//  These tests never open the game screen. They load the functions from
//  tetris-core.js and check the board numbers directly.
// =============================================================================

// import loads code from another file or from Node itself.
//   node:test          Node's built-in test runner. test('name', f) registers a test.
//   node:assert        checks. If a check is wrong, it throws an error = the test fails.
//   ./tetris-core.js   our game (./ means "in this same folder").
//                      `* as T` takes everything it exports, stored as T.
//                      So T.fits is the fits function from tetris-core.js.
import test from 'node:test';
import assert from 'node:assert';
import * as T from './tetris-core.js';

// Two shapes we use a lot (see PART 2 in tetris.js):
const O = T.PIECES.O[0]; // the square: box rows 0b1100, 0b1100 -> box columns 0 and 1
const I = T.PIECES.I[0]; // the flat bar: box row 1 is 0b1111

// The checks we use:
//   assert.strictEqual(a, b)      a must be exactly equal to b
//   assert.deepStrictEqual(a, b)  same, but compares lists item by item
//   assert.ok(x)                  x must be true
//   !x                            means "not x", so assert.ok(!x) means x must be false

test('full row is 1023 and empty row is 0', () => {
  assert.strictEqual(T.FULL, 1023);
  // A new board must be a list of 20 zeros.
  assert.deepStrictEqual(T.emptyBoard(), new Array(20).fill(0));
});

test('piece lands where the AND with the next row stops being 0', () => {
  const board = T.emptyBoard();

  // Drop the square by hand, exactly like gravity does: start at row 0 and
  // keep going down while the NEXT row still fits.
  let y = 0;
  while (T.fits(board, O, 4, y + 1)) y++;
  // The square is 2 rows tall, so on an empty board it stops with its top at
  // row 18 and its bottom at row 19 (the last row).
  assert.strictEqual(y, 18);

  // Glue it in with OR. (lock also writes the colour into 3 planes; this test
  // only looks at the board.)
  T.lock(board, T.emptyPlanes(), O, 4, y, T.COLOR.O);
  // Box columns 0 and 1, with the box at x = 4, are board columns 4 and 5.
  // Column 4 is bit 5 (worth 32), column 5 is bit 4 (worth 16): 32 + 16 = 48.
  assert.strictEqual(board[18], 48);
  assert.strictEqual(board[19], 48);

  // A second square fits on top of the first (rows 16-17)...
  assert.strictEqual(T.fits(board, O, 4, 16), true);
  // ...but not one row lower (rows 17-18), because row 18 is taken.
  assert.strictEqual(T.fits(board, O, 4, 17), false);
});

test('walls: I piece fits from column 0 to 6, not beyond', () => {
  const board = T.emptyBoard();

  // The flat bar is 4 wide and fills its whole box: x = 0 (columns 0-3) up to
  // x = 6 (columns 6-9) are inside the board.
  assert.ok(T.fits(board, I, 0, 0));
  assert.ok(T.fits(board, I, 6, 0));
  // One more step either way pokes into a wall.
  assert.ok(!T.fits(board, I, -1, 0));
  assert.ok(!T.fits(board, I, 7, 0));

  // The standing bar uses only box column 2. So the box itself may stick out
  // of the board: x = -2 puts the bar in column 0, x = 7 puts it in column 9.
  const V = T.PIECES.I[1];
  assert.ok(T.fits(board, V, -2, 0));
  assert.ok(T.fits(board, V, 7, 0));
  assert.ok(!T.fits(board, V, 8, 0)); // that would be column 10: no such column
});

test('full rows are removed and rows above fall', () => {
  // Build a board by hand:
  const board = T.emptyBoard();
  board[19] = 1023; // full
  board[18] = 1;    // one block in the right column (bit 0)
  board[17] = 1023; // full
  board[16] = 512;  // one block in the left column (bit 9)

  // Two full rows must disappear...
  assert.strictEqual(T.clearLines(board, T.emptyPlanes()), 2);
  // ...and the other rows fall down, in the same order.
  assert.strictEqual(board[19], 1);
  assert.strictEqual(board[18], 512);
  assert.strictEqual(board[17], 0);
});

test('game: hard drops end in game over, score counts', () => {
  // A predictable "random" generator, so this test is the same every run.
  // Each call computes the next number from the previous one and returns a
  // value between 0 and 1, like Math.random() does.
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Play a whole game by only pressing "hard drop": the stack grows in the
  // middle until no new piece fits. 500 is a safety limit so the test can
  // never loop forever.
  const g = T.newGame(rnd);
  let drops = 0;
  while (!g.over && drops < 500) {
    T.hardDrop(g);
    drops++;
  }
  assert.ok(g.over);
  assert.ok(g.score > 0);
  // Every row must still be a valid 10-bit number (0 to 1023).
  for (const row of g.board) assert.ok(row >= 0 && row <= 1023);
});

test('colours: bit planes hold each cell\'s colour and fall with the rows', () => {
  const board = T.emptyBoard();
  const planes = T.emptyPlanes();

  // Lock a J (colour 6 = binary 110) at the bottom: rows 18 and 19.
  T.lock(board, planes, T.PIECES.J[0], 0, 18, T.COLOR.J);
  // J rotation 0 at x = 0: row 18 = column 0 (512), row 19 = columns 0-2 (896).
  assert.strictEqual(board[18], 512);
  assert.strictEqual(board[19], 896);
  // Colour 6 = 110: plane 0 empty, planes 1 and 2 hold the blocks.
  assert.strictEqual(planes[0][19], 0);
  assert.strictEqual(planes[1][19], 896);
  assert.strictEqual(planes[2][19], 896);
  assert.strictEqual(T.colorAt(planes, 19, 512), 6);
  assert.strictEqual(T.colorAt(planes, 19, 1), 0); // column 9: empty

  // Make row 19 full by hand and clear it. Row 18's J block must fall to
  // row 19 and keep its colour 6.
  board[19] = T.FULL;
  T.clearLines(board, planes);
  assert.strictEqual(board[19], 512);
  assert.strictEqual(T.colorAt(planes, 19, 512), 6);

  // The main board is always the OR of the 3 planes.
  for (let r = 0; r < T.HEIGHT; r++) {
    assert.strictEqual(board[r], planes[0][r] | planes[1][r] | planes[2][r]);
  }
});
