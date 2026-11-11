#!/usr/bin/env node
// ^ The line above is called a "shebang". On Linux/macOS/Termux it lets you
//   run this file directly as `./tetris.js` (after `chmod +x tetris.js`).
//   It tells the system: "run this file with the program called node".
//   JavaScript itself ignores it.

// =============================================================================
//  TERMINAL TETRIS, WRITTEN TO BE READ AND LEARNED FROM
// =============================================================================
//
//  This file is the whole game. It runs with Node.js in a terminal (a text
//  window), not in a web browser. Start it with:   node tetris.js
//
//  HOW TO READ THIS FILE
//  ---------------------
//  Lines starting with // are COMMENTS. The computer ignores them; they are
//  notes for people. Read the file top to bottom: every idea is explained the
//  first time it appears.
//
//  The file has five parts:
//    PART 1  Numbers as rows of bits (the heart of the algorithm)
//    PART 2  The pieces
//    PART 3  The board: does a piece fit? lock it, clear full rows
//    PART 4  The game rules (score, gravity, new pieces)
//    PART 5  The terminal: drawing the screen and reading the keyboard
//
//  THE ALGORITHM IN ONE PARAGRAPH
//  ------------------------------
//  The board has 20 rows and 10 columns. Each row is stored as ONE whole
//  number. Each of its 10 columns is one "bit" of that number: 1 = a block
//  is there, 0 = empty. An empty row is the number 0. A full row (all 10
//  bits set) is the number 1023. A falling piece is also stored as small
//  numbers, one per row. To ask "does the piece fit here?" we put each piece
//  row on top of the board row with the AND operation. If the result is 0,
//  no block of the piece sits on a block of the board, so it fits, and the
//  piece may move down one more row. When it no longer fits, the piece is
//  glued into the board with the OR operation, and any row that became 1023
//  is removed.
// =============================================================================

// 'use strict' turns on JavaScript's "strict mode": the computer complains
// about some common mistakes (for example using a variable you never
// declared) instead of silently guessing. It is good practice to keep it.
'use strict';


// =============================================================================
//  PART 1: NUMBERS AS ROWS OF BITS
// =============================================================================
//
//  WHAT IS A BIT?
//  Computers store every number in BINARY: base 2, using only the digits 0 and
//  1. Each digit is called a "bit". Reading from the RIGHT, each position is
//  worth double the one before it:
//
//      position:   9    8    7    6    5    4    3    2    1    0
//      worth:    512  256  128   64   32   16    8    4    2    1
//
//  A binary number's value is the sum of the worths where the bit is 1.
//  Example: binary 0000110000 has 1s at positions 5 and 4 -> 32 + 16 = 48.
//
//  In JavaScript you can write a binary number directly by starting it with
//  0b. So 0b110000 is the same number as 48. We use this for the pieces below
//  because you can SEE the shape in the 1s and 0s.
//
//  OUR BOARD ROW
//  We use the 10 lowest bits of a number as the 10 columns of one row.
//  We decide that the LEFT column (column 0) is the BIG bit (worth 512), and
//  the RIGHT column (column 9) is the small bit (worth 1). That way, when you
//  write the number in binary, it looks exactly like the row on screen:
//
//      screen:   . . . . [][] . . . .     (blocks in columns 4 and 5)
//      binary:   0 0 0 0 1 1  0 0 0 0  = 0b0000110000 = 48
//
//  THE FOUR BIT OPERATIONS WE NEED
//  They work on every bit position separately, like 10 tiny calculations
//  done at once.
//
//    a & b   AND: bit is 1 only if it is 1 in BOTH a AND b.
//            0b1100 & 0b0110 = 0b0100.  We use it to ask "do they overlap?"
//            If (row & piece) is 0, they share no block.
//
//    a | b   OR: bit is 1 if it is 1 in a OR b (or both).
//            0b1100 | 0b0110 = 0b1110.  We use it to glue a piece into a row.
//
//    a << n  SHIFT LEFT: move every bit n positions to the left (towards the
//            big bits). 0b0011 << 2 = 0b1100. Each shift doubles the number.
//            We use it to slide a piece sideways on the board.
//    a >> n  SHIFT RIGHT: the opposite. 0b1100 >> 2 = 0b0011.
//
//    ~a      NOT: flips every bit: 1 becomes 0 and 0 becomes 1.
//
// -----------------------------------------------------------------------------

// `const` creates a name for a value that will never change.
// (`let`, used later, creates a name whose value CAN change.)
const WIDTH = 10;   // columns in a row
const HEIGHT = 20;  // rows on the board

// The number for a FULL row: all 10 bits set to 1.
//   1 << 10      is binary 10000000000 (a 1 followed by ten 0s) = 1024
//   1024 - 1     is binary  1111111111 (ten 1s)                 = 1023
// (Subtracting 1 from "1 followed by zeros" always gives "all ones",
// just like 1000 - 1 = 999 in decimal.)
const FULL = (1 << WIDTH) - 1; // = 1023


// =============================================================================
//  PART 2: THE PIECES
// =============================================================================
//
//  Every piece fits inside a 4 x 4 box. Each row of the box is a 4-bit number,
//  where the LEFT bit (0b1000, worth 8) is the box's left column and the right
//  bit (0b0001, worth 1) is its right column. Example, the T piece:
//
//        box row 0:   0b0100   ->   . [] .  .
//        box row 1:   0b1110   ->   [][][] .
//        box row 2:   0b0000   ->   .  .  .  .
//        box row 3:   0b0000   ->   .  .  .  .
//
//  We write down only rotation 0 of each piece by hand. The program then
//  turns it 90 degrees clockwise to make rotation 1, turns rotation 1 to make
//  rotation 2, and rotation 2 to make rotation 3. A fifth turn would give back
//  rotation 0, so 4 rotations are all there are.
//
//  JAVASCRIPT NOTES
//  [a, b, c]           is an ARRAY: a list of values. list[0] is the first one.
//  { I: ..., O: ... }  is an OBJECT: values stored under names ("keys").
//                      SHAPES.T gets the value stored under the name T.
//                      SHAPES['T'] means exactly the same thing.
// -----------------------------------------------------------------------------

// SHAPES: rotation 0 of every piece, as 4 row numbers (top row first).
// `size` is the side of the smallest square box the piece turns in:
//   4 for the I bar, 3 for J L S T Z, 2 for the O square.
// The piece always sits in the TOP-LEFT corner of the 4x4 box.
const SHAPES = {
  I: { size: 4, rows: [0b0000, 0b1111, 0b0000, 0b0000] }, // the long bar
  O: { size: 2, rows: [0b1100, 0b1100, 0b0000, 0b0000] }, // the square
  T: { size: 3, rows: [0b0100, 0b1110, 0b0000, 0b0000] }, // a T
  S: { size: 3, rows: [0b0110, 0b1100, 0b0000, 0b0000] }, // a step up to the right
  Z: { size: 3, rows: [0b1100, 0b0110, 0b0000, 0b0000] }, // a step down (mirror of S)
  J: { size: 3, rows: [0b1000, 0b1110, 0b0000, 0b0000] }, // an L with its foot left
  L: { size: 3, rows: [0b0010, 0b1110, 0b0000, 0b0000] }, // an L with its foot right
};

// rotate: turn a whole 4x4 grid 90 degrees clockwise.
//
// The rule: the old LEFT column becomes the new TOP row, read from the bottom
// row up. In general, new row r is made of old column r, and old row i lands
// at bit i of it (the bottom row, i = 3, becomes the new LEFT column, bit 8).
//
//   rows.map((_, r) => ...)   builds the 4 new rows, r = 0, 1, 2, 3.
//                             (`_` is the old row itself; we don't need it here.)
//   rows.reduce(f, 0)         starts with 0 and runs f once per old row,
//                             passing the result along: acc = "so far".
//   row >> (3 - r) & 1        the bit of old column r: shift it to the far
//                             right, keep only that bit. 0 or 1.
//   << i                      move it to bit i of the new row.
//   acc | ...                 add it to the new row so far.
const rotate = (rows) =>
  rows.map((_, r) =>
    rows.reduce((acc, row, i) => acc | (row >> (3 - r) & 1) << i, 0));

// turn: rotate a piece inside ITS OWN box, not the whole 4x4 box.
//
// A 4x4 turn spins around the centre of the 4x4 box. A smaller piece in the
// top-left corner would land in the top-RIGHT corner: (4 - size) columns too
// far right. Shifting every row left by (4 - size) puts it back.
// Moving one column left = one bit to the left = << 1.
//   I (size 4): no shift.   J L S T Z (size 3): << 1.   O (size 2): << 2.
const turn = (rows, size) => rotate(rows).map((row) => row << (4 - size));

// PIECES: all 4 rotations of every piece, built from SHAPES.
// PIECES.T[1] is the T piece's rotation 1 (4 numbers), PIECES.T[1][0] its top row.
//
// `for (const name in SHAPES)` runs once for each name in SHAPES: 'I', 'O', ...
// `const { size, rows } = SHAPES[name]` takes the two values out of the
// object in one go (called "destructuring").
const PIECES = {};
for (const name in SHAPES) {
  const { size, rows } = SHAPES[name];
  const r0 = rows;
  const r1 = turn(r0, size);
  const r2 = turn(r1, size);
  const r3 = turn(r2, size);
  PIECES[name] = [r0, r1, r2, r3];
}

// Object.keys(PIECES) gives the list of names: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'].
// We use it to choose a random piece.
const NAMES = Object.keys(PIECES);


// =============================================================================
//  PART 3: THE BOARD
// =============================================================================
//
//  SLIDING A PIECE ROW INTO PLACE (the shift)
//  ------------------------------------------
//  A piece row is a 4-bit number sitting at the far right (bits 3..0). The
//  piece has a position x = the board column where the LEFT edge of its 4x4
//  box is. We must slide the 4 bits left so they land under columns x..x+3.
//
//  Board column c is bit number (9 - c):  column 0 -> bit 9, column 9 -> bit 0.
//  The box's left column is bit 3 of the piece row. We want it to become bit
//  (9 - x). So we shift left by (9 - x) - 3 = 6 - x.
//
//      Example: piece row 0b0110, x = 3.  Shift = 6 - 3 = 3.
//      0b0110 << 3 = 0b0110000 = 48 = columns 4 and 5. Correct!
//
//  THE WALLS (the PAD trick)
//  -------------------------
//  Problem 1: when x is 7, 8 or 9, the shift 6 - x is negative (-1, -2, -3),
//  and "shift left by -1" makes no sense.
//  Problem 2: we need to notice when a piece pokes out of the left or right
//  side of the board.
//
//  Solution: we do our test with 3 extra empty bits on the right ("padding").
//  Everything is shifted 3 more places to the left, so the shift becomes
//  6 - x + 3 = 9 - x, which is never negative for x up to 9. In this padded
//  world the 10 real columns are bits 12..3, and every other bit is "wall".
//
//      bit:     ...15 14 13 | 12 11 10  9  8  7  6  5  4  3 | 2  1  0
//               wall wall.. |        the 10 real columns     | wall wall wall
//
//  If any bit of a shifted piece lands on a wall bit, the piece hit a wall.
//  Again that is a single AND test, just like checking the blocks. This is the
//  kind of trick an assembler programmer loves: no "if x < 0" special cases.
// -----------------------------------------------------------------------------

const PAD = 3; // the number of extra bits on the right

// The wall mask: a number with 1s on every bit that is NOT a real column.
//   FULL << PAD       = 1023 shifted 3 left = 1s on bits 12..3 (the columns)
//   ~(that)           = flip every bit      = 1s everywhere else (the walls)
const WALLS = ~(FULL << PAD);

// A FUNCTION is a named piece of code you can run ("call") again and again.
// `function shiftRow(bits, x) { ... }` defines a function named shiftRow that
// receives two values, called bits and x inside it. `return` sends the answer
// back to whoever called it.
//
// shiftRow: slide one 4-bit piece row so the box's left edge is at column x,
// in the padded world (see above).
function shiftRow(bits, x) {
  return bits << (6 - x + PAD);
}

// emptyBoard: make a new board = an array of 20 zeros (20 empty rows).
// `new Array(HEIGHT)` makes a list with 20 empty slots; `.fill(0)` puts 0 in
// each. board[0] is the TOP row, board[19] is the BOTTOM row.
function emptyBoard() {
  return new Array(HEIGHT).fill(0);
}

// fits: THE CORE OF THE ALGORITHM.
// Can the piece `shape` (4 row numbers) stand with its box's top-left corner
// at column x, row y, without hitting a wall, the floor, or a block?
// Returns true (yes, it fits) or false (no).
//
// `y` can be negative: a new piece starts partly above the top of the board.
function fits(board, shape, x, y) {
  // A `for` loop repeats code. Read it as: start with i = 0; keep going while
  // i < 4; after each round add 1 to i (i++ means i = i + 1).
  // So the code inside runs 4 times, with i = 0, 1, 2, 3: once per box row.
  for (let i = 0; i < 4; i++) {
    // An empty piece row (0) can't hit anything. `continue` skips straight
    // to the next round of the loop. (=== means "is exactly equal to".)
    if (shape[i] === 0) continue;

    const row = y + i;                    // which board row this box row is on
    const piece = shiftRow(shape[i], x);  // the piece row, slid into place

    // 1) Wall test: does the piece row touch any wall bit?
    //    (piece & WALLS) is 0 if not; anything else means yes.
    //    In JavaScript, inside `if ( )`, 0 counts as "false" and any other
    //    number counts as "true". So `if (piece & WALLS)` means "if they
    //    share at least one bit".
    if (piece & WALLS) return false;

    // 2) Floor test: row 19 is the last row; row 20 or more is below it.
    if (row >= HEIGHT) return false;

    // 3) Above the top of the board there is nothing to hit, so this row is OK.
    if (row < 0) continue;

    // 4) Block test, the superimpose from the assembler version:
    //    board[row] << PAD moves the board row into the same padded world as
    //    the piece. If the AND is not 0, a piece block sits on a board block.
    if ((board[row] << PAD) & piece) return false;
  }
  // We checked all 4 rows and nothing was hit: the piece fits.
  return true;
}

// lock: glue the piece into the board for good, using OR.
// After this the piece is just part of the board's numbers.
function lock(board, shape, x, y) {
  for (let i = 0; i < 4; i++) {
    const row = y + i;
    // && means AND for conditions: all three must be true.
    // Only touch rows that have piece blocks and are really on the board.
    if (shape[i] && row >= 0 && row < HEIGHT) {
      // shiftRow(...) is in the padded world, so >> PAD shifts it back to the
      // normal 10-bit row. Then OR it in. `a |= b` is short for `a = a | b`.
      board[row] |= shiftRow(shape[i], x) >> PAD;
    }
  }
}

// clearLines: remove every row equal to FULL (1023) and let the rows above
// fall down. Returns how many rows were removed (0 to 4).
function clearLines(board) {
  let cleared = 0; // `let` because this number changes as we count

  // Walk from the bottom row (19) up to the top row (0). row-- means row = row - 1.
  for (let row = HEIGHT - 1; row >= 0; row--) {
    if (board[row] === FULL) {
      board.splice(row, 1); // splice(row, 1) cuts 1 item out of the list at `row`
      board.unshift(0);     // unshift(0) puts a new empty row (0) at the very top
      cleared++;
      // Every row above moved down by one, so the row now at this index is
      // a new one we haven't checked. row++ cancels the loop's row-- so we
      // test the same index again.
      row++;
    }
  }
  return cleared;
}


// =============================================================================
//  PART 4: THE GAME RULES
// =============================================================================
//
//  All the information about one game is kept in one object called `game`:
//
//    game.board    the 20 row numbers
//    game.piece    the falling piece: { name, rot, x, y }
//                    name = 'T', 'I', ...   rot = rotation 0..3
//                    x, y = column and row of the top-left corner of its box
//    game.next     the name of the piece that comes after this one
//    game.score, game.lines, game.level
//    game.over     true when no new piece can enter: game over
//    game.paused   true while the player has paused
// -----------------------------------------------------------------------------

// Points for clearing 0, 1, 2, 3 or 4 rows at once (times the level).
// Clearing 4 at once ("a Tetris") is worth much more than 4 single rows.
const LINE_SCORES = [0, 100, 300, 500, 800];

// newGame: set up a fresh game and return it.
//
// `random = Math.random` means: if the caller doesn't give a random-number
// function, use JavaScript's built-in one. Math.random() returns a number from
// 0 (included) up to 1 (not included), like 0.7314. The tests pass their own
// predictable function, so the "random" pieces are the same every test run.
function newGame(random = Math.random) {
  const game = {
    board: emptyBoard(),
    score: 0,
    lines: 0,
    level: 1,
    piece: null,          // null means "nothing yet"; spawn() sets it below
    next: pick(random),
    over: false,
    paused: false,
    random,               // short for  random: random
  };
  spawn(game);
  return game;
}

// pick: choose a random piece name.
// random() * 7 is a number from 0 up to (not including) 7, like 4.83.
// Math.floor removes the part after the point: 4.83 -> 4. That gives a
// whole number 0..6, which we use as a position in the NAMES list.
function pick(random) {
  return NAMES[Math.floor(random() * NAMES.length)];
}

// spawn: bring the "next" piece onto the board at the top, and choose a new
// "next". If the new piece doesn't even fit where it appears, the stack has
// reached the top: game over.
function spawn(game) {
  // x: centre the piece. (WIDTH - size) / 2 columns are left free on its
  // left: 3 for the I bar and J L S T Z, 4 for the O square, so every piece
  // appears in the middle. Math.floor rounds 3.5 down to 3.
  // y: -1 puts the box's top row one row ABOVE the board (row -1).
  // For the I piece, whose top box row is empty, that means the bar appears
  // right away in row 0. For the other pieces, their top box row starts
  // hidden above the board and slides into view on the first gravity tick.
  // fits() allows this: rows above the top count as free space.
  const size = SHAPES[game.next].size;
  game.piece = { name: game.next, rot: 0, x: Math.floor((WIDTH - size) / 2), y: -1 };
  game.next = pick(game.random);
  if (!fits(game.board, shapeOf(game.piece), game.piece.x, game.piece.y)) {
    // ! means NOT: "if it does NOT fit"
    game.over = true;
  }
}

// shapeOf: the 4 row numbers of a piece in its current rotation.
function shapeOf(p) {
  return PIECES[p.name][p.rot];
}

// tryMove: try to move the falling piece by dx columns, dy rows, and rotate it
// drot steps. If the new position fits, the piece moves and we return true.
// If not, nothing changes and we return false.
//
//   tryMove(game, -1, 0)    one column left
//   tryMove(game,  1, 0)    one column right
//   tryMove(game,  0, 1)    one row down
//   tryMove(game,  0, 0, 1) rotate clockwise
//
// `drot = 0` means: if no rotation is given, use 0 (don't rotate).
function tryMove(game, dx, dy, drot = 0) {
  const p = game.piece;

  // The new rotation number, kept in 0..3. % is "remainder after dividing":
  // 4 % 4 = 0, 5 % 4 = 1. So after rotation 3 comes rotation 0 again.
  // (+ 4 makes sure we never take the remainder of a negative number.)
  const rot = (p.rot + drot + 4) % 4;
  const shape = PIECES[p.name][rot];

  // WALL KICK: when you rotate next to a wall, the rotated piece may poke into
  // the wall. Rather than refusing, we also try nudging it 1 or 2 columns
  // sideways. For a plain move (no rotation) we only try the exact spot.
  //   condition ? A : B   means: if condition is true use A, else use B.
  const kicks = drot ? [0, -1, 1, -2, 2] : [0];

  // `for (const k of kicks)` runs the code once for each value in the list,
  // with k set to that value.
  for (const k of kicks) {
    if (fits(game.board, shape, p.x + dx + k, p.y + dy)) {
      // It fits: really move the piece. `a += b` is short for `a = a + b`.
      p.x += dx + k;
      p.y += dy;
      p.rot = rot;
      return true;
    }
  }
  return false; // none of the positions fit
}

// step: ONE TICK OF GRAVITY. This is the "test the next row" from the
// assembler version. The game calls it again and again on a timer.
function step(game) {
  if (game.over) return;

  // Does the piece fit one row lower? Then it just moves down. Done.
  if (tryMove(game, 0, 1)) return;

  // It does NOT fit one row lower: it has landed.
  lock(game.board, shapeOf(game.piece), game.piece.x, game.piece.y); // glue with OR
  const n = clearLines(game.board);   // remove full rows, n = how many
  game.lines += n;
  game.score += LINE_SCORES[n] * game.level;
  // Every 10 rows cleared, go up one level (the game gets faster).
  game.level = 1 + Math.floor(game.lines / 10);
  spawn(game); // the next piece appears at the top
}

// hardDrop: drop the piece straight down as far as it goes, then land it.
function hardDrop(game) {
  let rows = 0;
  // A `while` loop repeats as long as its condition is true. Here: keep
  // moving down while moving down still works. The body only counts rows.
  while (tryMove(game, 0, 1)) rows++;
  game.score += rows * 2; // small bonus for dropping
  step(game);             // it can't go lower, so this step lands it
}


// =============================================================================
//  PART 5: THE TERMINAL (drawing and keyboard)
// =============================================================================
//
//  ESCAPE CODES
//  A terminal shows the text a program writes. But it also understands special
//  hidden commands, called "ANSI escape codes", that start with the ESC
//  character (written '\x1b' in JavaScript: character number 1b in hexadecimal
//  = 27). The ones we use:
//
//    ESC[H       move the cursor to the top-left corner
//    ESC[2J      clear the whole screen
//    ESC[K       clear from the cursor to the end of the line
//    ESC[?25l    hide the blinking cursor     ESC[?25h  show it again
//    ESC[36m     switch the text color (36 = cyan, 31 = red, ...)
//    ESC[0m      back to the normal color
//
//  Instead of clearing the screen every frame (which flickers), we move the
//  cursor to the top-left and write the new picture over the old one.
//
//  `process.stdout.write(text)` sends text to the terminal (stdout = "standard
//  output", the screen). `process.stdin` is the keyboard ("standard input").
// -----------------------------------------------------------------------------

const ESC = '\x1b[';

// A color for each piece (terminal color numbers).
const COLORS = { I: 36, O: 33, T: 35, S: 32, Z: 31, J: 34, L: 37 };

// render: draw the whole screen once.
function render(game) {
  // The falling piece is NOT part of game.board until it lands. To draw it,
  // we work out, for each board row, which bits the piece covers there.
  const shape = shapeOf(game.piece);
  const pieceRows = new Array(HEIGHT).fill(0); // 20 zeros, like an empty board
  for (let i = 0; i < 4; i++) {
    const row = game.piece.y + i;
    if (row >= 0 && row < HEIGHT) {
      pieceRows[row] = shiftRow(shape[i], game.piece.x) >> PAD;
    }
  }
  const color = COLORS[game.piece.name];
  const nextShape = PIECES[game.next][0]; // the next piece, rotation 0

  // We build the picture as a list of text lines, then print them all at once.
  // `lines.push(x)` adds x to the end of the list.
  const lines = [];
  lines.push('  TETRIS (bit rows)');
  // '--'.repeat(10) makes '--' ten times. The + joins pieces of text.
  lines.push('  +' + '--'.repeat(WIDTH) + '+');

  for (let r = 0; r < HEIGHT; r++) {      // for each board row, top to bottom
    let s = '  |';                        // the text for this line, so far
    for (let c = 0; c < WIDTH; c++) {     // for each column, left to right
      // The bit for column c: column 0 is 1 << 9 = 512, column 9 is 1 << 0 = 1.
      const bit = 1 << (WIDTH - 1 - c);
      // Is this bit set in the falling piece? In the board? Or empty?
      // Text in `backticks` can include values with ${...}: here we wrap
      // '[]' in the color code and the "normal color" code.
      if (pieceRows[r] & bit) s += `${ESC}${color}m[]${ESC}0m`;
      else if (game.board[r] & bit) s += '[]';
      else s += ' .';
    }
    s += '|';

    // To the right of each row, show the row's NUMBER, so you can watch the
    // algorithm work: piece and board OR'ed together. padStart(4) adds spaces
    // in front so all numbers line up (e.g. '  48', '1023').
    s += ' ' + String(game.board[r] | pieceRows[r]).padStart(4);

    // The side panel: on some rows, add extra text after the number.
    if (r === 1) s += '   Next:';
    if (r >= 2 && r <= 5) {
      // Draw the next piece: box row (r - 2), its 4 bits from left to right.
      // 8 >> c is 8, 4, 2, 1 for c = 0..3: the bit for box column c.
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

  // Go to the top-left (ESC[H), then print every line followed by ESC[K
  // (erase leftovers of the previous, possibly longer, line).
  // lines.map(f) makes a new list by running f on each line.
  // (l) => l + ESC + 'K' is a short way to write a small function:
  //   "given l, return l + ESC + 'K'".
  // .join('\n') glues the list into one text with a line break between items.
  process.stdout.write(ESC + 'H' + lines.map((l) => l + ESC + 'K').join('\n'));
}

// run: start the game in the terminal. Everything above was preparation;
// this is where the program actually begins doing things.
function run() {
  // isTTY is true when we are connected to a real terminal (not, for example,
  // a file). Without one we can't read single key presses, so we stop.
  if (!process.stdin.isTTY) {
    console.error('Run this in a terminal: node tetris.js');
    process.exit(1); // end the program; 1 means "ended with a problem"
  }

  let game = newGame();
  let timer = null; // the gravity timer, set by schedule()

  // HOW TIME WORKS HERE
  // setTimeout(f, ms) asks Node: "call function f once, ms milliseconds from
  // now" (1000 ms = 1 second). Meanwhile Node keeps listening for keys.
  // Each gravity tick sets up the next one, so the piece falls forever.
  // This "wait for things to happen and react" style is called the EVENT LOOP.

  // speed: milliseconds between gravity ticks. Level 1: 800 ms. Each level is
  // 70 ms faster, but never faster than 80 ms. Math.max picks the bigger number.
  const speed = () => Math.max(80, 800 - (game.level - 1) * 70);

  // schedule: cancel any waiting tick and set up a new one.
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(tick, speed());
  };

  // tick: what happens on every gravity tick.
  const tick = () => {
    if (!game.paused && !game.over) step(game); // gravity: one row down
    render(game);                               // redraw
    schedule();                                 // set up the next tick
  };

  // quit: put the terminal back to normal and end the program.
  const quit = () => {
    clearTimeout(timer);
    process.stdout.write(ESC + '?25h' + ESC + '2J' + ESC + 'H'); // cursor on, clear
    console.log(`Score: ${game.score}  Lines: ${game.lines}`);
    process.exit(0); // 0 means "ended normally"
  };

  // RAW MODE: normally the terminal collects a whole line and only gives it
  // to the program after you press Enter. In raw mode every key press is sent
  // immediately, which a game needs.
  process.stdin.setRawMode(true);
  process.stdin.resume();             // start listening to the keyboard
  process.stdin.setEncoding('utf8');  // give us key presses as text
  process.stdout.write(ESC + '?25l' + ESC + '2J'); // hide cursor, clear screen

  // stdin.on('data', f): "every time a key is pressed, call f with that key".
  //
  // What arrives for each key:
  //   letters are themselves: 'q', 'p', 'a', ...
  //   an arrow key sends 3 characters: ESC [ and a letter.
  //     up = '\x1b[A'   down = '\x1b[B'   right = '\x1b[C'   left = '\x1b[D'
  //   Ctrl+C arrives as character number 3, written '\u0003'.
  process.stdin.on('data', (key) => {
    // || means OR for conditions: either one is enough.
    if (key === 'q' || key === '\u0003') return quit();
    if (key === 'r' && game.over) {
      game = newGame(); // a brand new game
      render(game);
      return schedule();
    }
    if (key === 'p') {
      game.paused = !game.paused; // flip: true becomes false, false becomes true
      return render(game);
    }
    if (game.paused || game.over) return; // ignore other keys while stopped

    // `switch` compares `key` with each `case` and runs the code after the one
    // that matches, up to the next `break`. Two cases in a row share the code.
    switch (key) {
      case '\x1b[D': case 'a': tryMove(game, -1, 0); break;    // left
      case '\x1b[C': case 'd': tryMove(game, 1, 0); break;     // right
      case '\x1b[A': case 'w': tryMove(game, 0, 0, 1); break;  // rotate
      case '\x1b[B': case 's':                                 // down (soft drop)
        if (tryMove(game, 0, 1)) game.score += 1;              // 1 point per row
        break;
      case ' ':                                                // space: hard drop
        hardDrop(game);
        schedule(); // the new piece gets a full tick before it starts falling
        break;
      default: return; // any other key: do nothing, don't even redraw
    }
    render(game); // show the result of the key
  });

  // When the program ends for any reason, show the cursor again, so the
  // terminal isn't left without one.
  process.on('exit', () => process.stdout.write(ESC + '?25h'));

  render(game); // first picture
  schedule();   // start gravity
}

// `require.main === module` is true only when this file was started directly
// (`node tetris.js`). When the TEST file loads this file with require(), it
// is false, so the game doesn't start; the tests just use the functions.
if (require.main === module) run();

// module.exports lists what other files get when they require() this file.
// The tests use these to check the algorithm without a terminal.
module.exports = {
  WIDTH, HEIGHT, FULL, SHAPES, PIECES, rotate, turn, emptyBoard, fits, lock, clearLines,
  newGame, step, hardDrop, tryMove, shiftRow, PAD,
};
