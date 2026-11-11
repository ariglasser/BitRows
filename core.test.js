// =============================================================================
//  TESTS FOR THE BIT ROWS ALGORITHM
// =============================================================================
//
//  A TEST is a small program that runs your code with known inputs and checks
//  that the answer is what you expect. If someone changes core.js and breaks
//  something, a test fails and tells them, before anyone plays a broken game.
//
//  Run all tests with:   npm test      (or:  node --test)
//  You should see "pass 5" and "fail 0".
//
//  These tests never open the game screen. They load the functions from
//  core.js and check the board numbers directly.
// =============================================================================

// import loads code from another file or from Node itself.
//   node:test          Node's built-in test runner. test('name', f) registers a test.
//   node:assert        checks. If a check is wrong, it throws an error = the test fails.
//   ./core.js   our game (./ means "in this same folder").
//                      `* as T` takes everything it exports, stored as T.
//                      So T.fits is the fits function from core.js.
import test from 'node:test';
import assert from 'node:assert';
import * as T from './core.js';

// Two shapes we use a lot (see PART 2 in core.js):
const O = T.PIECES.O[0]; // the square: box rows 0b1100, 0b1100 -> box columns 0 and 1
const I = T.PIECES.I[0]; // the flat bar: box row 1 is 0b1111

// The checks we use:
//   assert.strictEqual(a, b)      a must be exactly equal to b
//   assert.deepStrictEqual(a, b)  same, but compares lists item by item
//   assert.ok(x)                  x must be true
//   !x                            means "not x", so assert.ok(!x) means x must be false

test('full row is 511 and empty row is 0', () => {
  assert.strictEqual(T.FULL, 511); // 9 columns: binary 111111111
  // A new board must be a list of 21 zeros.
  assert.deepStrictEqual(T.emptyBoard(), new Array(21).fill(0));
});

test('piece lands where the AND with the next row stops being 0', () => {
  const board = T.emptyBoard();

  // Drop the square by hand, exactly like gravity does: start at row 0 and
  // keep going down while the NEXT row still fits. x = 3 is where the square
  // appears in the game.
  let y = 0;
  while (T.fits(board, O, 3, y + 1)) y++;
  // The square is 2 rows tall, so on an empty board it stops with its top at
  // row 19 and its bottom at row 20 (the last row).
  assert.strictEqual(y, 19);

  // Glue it in with OR. (lock also writes the colour into 3 planes; this test
  // only looks at the board.)
  T.lock(board, T.emptyPlanes(), O, 3, y, T.COLOR.O);
  // Box columns 0 and 1, with the box at x = 3, are board columns 3 and 4.
  // Column 3 is bit 5 (worth 32), column 4 is bit 4 (worth 16): 32 + 16 = 48.
  assert.strictEqual(board[19], 48);
  assert.strictEqual(board[20], 48);

  // A second square fits on top of the first (rows 17-18)...
  assert.strictEqual(T.fits(board, O, 3, 17), true);
  // ...but not one row lower (rows 18-19), because row 19 is taken.
  assert.strictEqual(T.fits(board, O, 3, 18), false);
});

test('walls: I piece fits from column 0 to 5, not beyond', () => {
  const board = T.emptyBoard();

  // The flat bar is 4 wide and fills its whole box: x = 0 (columns 0-3) up to
  // x = 5 (columns 5-8) are inside the board.
  assert.ok(T.fits(board, I, 0, 0));
  assert.ok(T.fits(board, I, 5, 0));
  // One more step either way pokes into a wall.
  assert.ok(!T.fits(board, I, -1, 0));
  assert.ok(!T.fits(board, I, 6, 0));

  // The standing bar uses only box column 2. So the box itself may stick out
  // of the board: x = -2 puts the bar in column 0, x = 6 puts it in column 8.
  const V = T.PIECES.I[1];
  assert.ok(T.fits(board, V, -2, 0));
  assert.ok(T.fits(board, V, 6, 0));
  assert.ok(!T.fits(board, V, 7, 0)); // that would be column 9: no such column
});

test('full rows are removed and rows above fall', () => {
  // Build a board by hand:
  const board = T.emptyBoard();
  board[20] = 511;  // full
  board[19] = 1;    // one block in the right column (bit 0)
  board[18] = 511;  // full
  board[17] = 256;  // one block in the left column (bit 8)

  // Two full rows must disappear...
  assert.strictEqual(T.clearLines(board, T.emptyPlanes()), 2);
  // ...and the other rows fall down, in the same order.
  assert.strictEqual(board[20], 1);
  assert.strictEqual(board[19], 256);
  assert.strictEqual(board[18], 0);
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
  // Every row must still be a valid 9-bit number (0 to 511).
  for (const row of g.board) assert.ok(row >= 0 && row <= 511);
});

test('colours: bit planes hold each cell\'s colour and fall with the rows', () => {
  const board = T.emptyBoard();
  const planes = T.emptyPlanes();

  // Lock a J (colour 6 = binary 110) at the bottom: rows 19 and 20.
  T.lock(board, planes, T.PIECES.J[0], 0, 19, T.COLOR.J);
  // J rotation 0 at x = 0: row 19 = column 0 (256),
  // row 20 = columns 0-2 (256 + 128 + 64 = 448).
  assert.strictEqual(board[19], 256);
  assert.strictEqual(board[20], 448);
  // Colour 6 = 110: plane 0 empty, planes 1 and 2 hold the blocks.
  assert.strictEqual(planes[0][20], 0);
  assert.strictEqual(planes[1][20], 448);
  assert.strictEqual(planes[2][20], 448);
  assert.strictEqual(T.colorAt(planes, 20, 256), 6);
  assert.strictEqual(T.colorAt(planes, 20, 1), 0); // column 8: empty

  // Make row 20 full by hand and clear it. Row 19's J block must fall to
  // row 20 and keep its colour 6.
  board[20] = T.FULL;
  T.clearLines(board, planes);
  assert.strictEqual(board[20], 256);
  assert.strictEqual(T.colorAt(planes, 20, 256), 6);

  // The main board is always the OR of the 3 planes.
  for (let r = 0; r < T.HEIGHT; r++) {
    assert.strictEqual(board[r], planes[0][r] | planes[1][r] | planes[2][r]);
  }
});
