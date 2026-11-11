// =============================================================================
//  BIT ROWS CORE: THE GAME ITSELF, WRITTEN TO BE READ AND LEARNED FROM
// =============================================================================
//
//  This file holds the game's rules and its board, and NOTHING about how the
//  game is shown. Two other files show it:
//
//    terminal.js   draws it with text in a terminal     (node terminal.js)
//    browser.js    draws it in a web page               (open index.html)
//
//  Both use the very same board and rules from this file. Keeping "what the
//  game is" apart from "how it looks" means each part stays small and you can
//  read one without the other.
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
//    PART 3  The board: does a piece fit? lock it, clear full rows, colours
//    PART 4  The game rules (score, gravity, new pieces)
//    PART 5  What to draw: the board plus the falling piece, ready for display
//
//  THE ALGORITHM IN ONE PARAGRAPH
//  ------------------------------
//  The board has 21 rows and 9 columns. Each row is stored as ONE whole
//  number. Each of its 9 columns is one "bit" of that number: 1 = a block
//  is there, 0 = empty. An empty row is the number 0. A full row (all 9
//  bits set) is the number 511. A falling piece is also stored as small
//  numbers, one per row. To ask "does the piece fit here?" we put each piece
//  row on top of the board row with the AND operation. If the result is 0,
//  no block of the piece sits on a block of the board, so it fits, and the
//  piece may move down one more row. When it no longer fits, the piece is
//  glued into the board with the OR operation, and any row that became 511
//  is removed.
// =============================================================================

// THIS FILE IS A "MODULE"
// A module is a file that shares some of its names with other files. Names
// marked with the word `export` (see the end of this file) can be used by any
// file that says  import { ... } from './core.js'.
// Modules automatically run in JavaScript's "strict mode": the computer
// complains about common mistakes (like using a name you never declared)
// instead of silently guessing.


// =============================================================================
//  PART 1: NUMBERS AS ROWS OF BITS
// =============================================================================
//
//  WHAT IS A BIT?
//  Computers store every number in BINARY: base 2, using only the digits 0 and
//  1. Each digit is called a "bit". Reading from the RIGHT, each position is
//  worth double the one before it:
//
//      position:   8    7    6    5    4    3    2    1    0
//      worth:    256  128   64   32   16    8    4    2    1
//
//  A binary number's value is the sum of the worths where the bit is 1.
//  Example: binary 000110000 has 1s at positions 5 and 4 -> 32 + 16 = 48.
//
//  In JavaScript you can write a binary number directly by starting it with
//  0b. So 0b110000 is the same number as 48. We use this for the pieces below
//  because you can SEE the shape in the 1s and 0s.
//
//  OUR BOARD ROW
//  We use the 9 lowest bits of a number as the 9 columns of one row.
//  We decide that the LEFT column (column 0) is the BIG bit (worth 256), and
//  the RIGHT column (column 8) is the small bit (worth 1). That way, when you
//  write the number in binary, it looks exactly like the row on screen:
//
//      screen:   . . . [][] . . . .     (blocks in columns 3 and 4)
//      binary:   0 0 0 1 1  0 0 0 0  = 0b000110000 = 48
//
//  THE FOUR BIT OPERATIONS WE NEED
//  They work on every bit position separately, like 9 tiny calculations
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
const WIDTH = 9;    // columns in a row
const HEIGHT = 21;  // rows on the board

// The number for a FULL row: all 9 bits set to 1.
//   1 << 9       is binary 1000000000 (a 1 followed by nine 0s) = 512
//   512 - 1      is binary  111111111 (nine 1s)                 = 511
// (Subtracting 1 from "1 followed by zeros" always gives "all ones",
// just like 1000 - 1 = 999 in decimal.)
const FULL = (1 << WIDTH) - 1; // = 511


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

// COLOUR NUMBERS: each piece gets a number 1..7 (0 means "empty cell").
// 7 fits in 3 bits (binary 111), which is why the colour is stored in 3 bit
// planes (see PART 3). The display files turn the number into a real colour.
const COLOR = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };


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
//  Board column c is bit number (8 - c):  column 0 -> bit 8, column 8 -> bit 0.
//  The box's left column is bit 3 of the piece row. We want it to become bit
//  (8 - x). So we shift left by (8 - x) - 3 = 5 - x.
//  (In general, with WIDTH columns: WIDTH - 4 - x. The code uses that, so
//  the board width can be changed in one place.)
//
//      Example: piece row 0b0110, x = 2.  Shift = 5 - 2 = 3.
//      0b0110 << 3 = 0b0110000 = 48 = columns 3 and 4. Correct!
//
//  THE WALLS (the PAD trick)
//  -------------------------
//  Problem 1: when x is 6, 7 or 8, the shift 5 - x is negative (-1, -2, -3),
//  and "shift left by -1" makes no sense.
//  Problem 2: we need to notice when a piece pokes out of the left or right
//  side of the board.
//
//  Solution: we do our test with 3 extra empty bits on the right ("padding").
//  Everything is shifted 3 more places to the left, so the shift becomes
//  5 - x + 3 = 8 - x, which is never negative for x up to 8. In this padded
//  world the 9 real columns are bits 11..3, and every other bit is "wall".
//
//      bit:     ...14 13 12 | 11 10  9  8  7  6  5  4  3 | 2  1  0
//               wall wall.. |     the 9 real columns      | wall wall wall
//
//  If any bit of a shifted piece lands on a wall bit, the piece hit a wall.
//  Again that is a single AND test, just like checking the blocks. This is the
//  kind of trick an assembler programmer loves: no "if x < 0" special cases.
//
//  COLOURS: BIT PLANES
//  -------------------
//  The board says only WHETHER a cell is full (1 bit per cell), not WHICH
//  piece filled it. To remember colours we use the trick old video cards (EGA)
//  used: BIT PLANES. We keep 3 more boards, exactly like the main one: 21
//  numbers each. A cell's colour number (1..7) is written in binary across
//  them, one bit per plane:
//
//      colour 6 (J) = binary 110  ->  plane 0: 0   plane 1: 1   plane 2: 1
//
//  So to read a cell's colour, take its bit from each plane:
//      colour = (bit in plane 0) * 1 + (bit in plane 1) * 2 + (bit in plane 2) * 4
//
//  Nice consequences:
//    * The main board is always  plane0 | plane1 | plane2  (any colour is not 0),
//      so fits() and the AND test don't change at all.
//    * Clearing a row removes it from all 4 boards, so colours fall with blocks.
// -----------------------------------------------------------------------------

const PAD = 3; // the number of extra bits on the right

// The wall mask: a number with 1s on every bit that is NOT a real column.
//   FULL << PAD       = 511 shifted 3 left = 1s on bits 11..3 (the columns)
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
  return bits << (WIDTH - 4 - x + PAD); // = 5 - x + 3 on our 9-wide board
}

// emptyBoard: make a new board = an array of 21 zeros (21 empty rows).
// `new Array(HEIGHT)` makes a list with 21 empty slots; `.fill(0)` puts 0 in
// each. board[0] is the TOP row, board[20] is the BOTTOM row.
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

    // 2) Floor test: row 20 is the last row; row 21 or more is below it.
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

// emptyPlanes: 3 empty colour planes (3 boards of 21 zeros).
// [1, 2, 3].map(f) runs f for each item and collects the answers in a new
// list. Here we ignore the items and just make 3 empty boards.
function emptyPlanes() {
  return [0, 1, 2].map(() => emptyBoard());
}

// lock: glue the piece into the board for good, using OR, and write its
// colour number into the bit planes.
// After this the piece is just part of the board's numbers.
function lock(board, planes, shape, x, y, color) {
  for (let i = 0; i < 4; i++) {
    const row = y + i;
    // && means AND for conditions: all three must be true.
    // Only touch rows that have piece blocks and are really on the board.
    if (shape[i] && row >= 0 && row < HEIGHT) {
      // shiftRow(...) is in the padded world, so >> PAD shifts it back to the
      // normal 9-bit row.
      const bits = shiftRow(shape[i], x) >> PAD;
      // Glue it into the board. `a |= b` is short for `a = a | b`.
      board[row] |= bits;
      // Colour: for plane b (0, 1, 2), look at bit b of the colour number.
      // (color >> b) & 1 is that bit: 1 means "this plane gets the blocks".
      for (let b = 0; b < 3; b++) {
        if ((color >> b) & 1) planes[b][row] |= bits;
      }
    }
  }
}

// clearLines: remove every row equal to FULL (511) and let the rows above
// fall down, in the board AND in the 3 colour planes, so colours fall too.
// Returns how many rows were removed (0 to 4).
function clearLines(board, planes) {
  let cleared = 0; // `let` because this number changes as we count

  // Walk from the bottom row (20) up to the top row (0). row-- means row = row - 1.
  for (let row = HEIGHT - 1; row >= 0; row--) {
    if (board[row] === FULL) {
      // [board, ...planes] is one list with the board and the 3 planes
      // (`...` spreads the planes' list out into the new list).
      // We do the same thing to all 4 of them:
      for (const layer of [board, ...planes]) {
        layer.splice(row, 1); // splice(row, 1) cuts 1 item out of the list at `row`
        layer.unshift(0);     // unshift(0) puts a new empty row (0) at the very top
      }
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
//    game.board    the 21 row numbers (which cells are full)
//    game.planes   3 more lists of 21 row numbers: the colours (bit planes)
//    game.piece    the falling piece: { name, rot, x, y }
//                    name = 'T', 'I', ...   rot = rotation 0..3
//                    x, y = column and row of the top-left corner of its box
//    game.next     the name of the piece that comes after this one
//    game.score, game.lines, game.level
//    game.over     true when no new piece can enter: game over
//    game.paused   true while the player has paused
// -----------------------------------------------------------------------------

// Points for clearing 0, 1, 2, 3 or 4 rows at once (times the level).
// Clearing 4 at once is worth much more than 4 single rows.
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
    planes: emptyPlanes(),
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
  // left, rounded down by Math.floor: 2 for the I bar (2.5 -> 2), 3 for
  // J L S T Z, 3 for the O square (3.5 -> 3), so every piece appears in the
  // middle of the 9 columns.
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
  const p = game.piece;
  lock(game.board, game.planes, shapeOf(p), p.x, p.y, COLOR[p.name]); // glue with OR
  const n = clearLines(game.board, game.planes); // remove full rows, n = how many
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
//  PART 5: WHAT TO DRAW
// =============================================================================
//
//  The falling piece is NOT part of the board until it lands. A display needs
//  the board WITH the piece. view(game) makes that picture, as 3 colour planes
//  (21 numbers each), without changing the game. Both terminal.js and
//  browser.js draw from it.
// -----------------------------------------------------------------------------

// view: copies of the 3 colour planes with the falling piece added.
function view(game) {
  // plane.slice() makes a COPY of a list, so changing the copy leaves the
  // real game untouched.
  const planes = game.planes.map((plane) => plane.slice());
  const p = game.piece;
  const shape = shapeOf(p);
  const color = COLOR[p.name];
  for (let i = 0; i < 4; i++) {
    const row = p.y + i;
    if (shape[i] && row >= 0 && row < HEIGHT) {
      const bits = shiftRow(shape[i], p.x) >> PAD;
      for (let b = 0; b < 3; b++) {
        if ((color >> b) & 1) planes[b][row] |= bits;
      }
    }
  }
  return planes;
}

// colorAt: the colour number (0..7) of one cell in a set of 3 planes.
// `bit` is the cell's column bit (column 0 = 256 ... column 8 = 1).
// (plane[row] & bit) is not 0 when the plane has that cell; `? 1 : 0` turns
// that into 1 or 0. Plane 0 is worth 1, plane 1 worth 2, plane 2 worth 4.
function colorAt(planes, row, bit) {
  return ((planes[0][row] & bit) ? 1 : 0)
       | ((planes[1][row] & bit) ? 2 : 0)
       | ((planes[2][row] & bit) ? 4 : 0);
}

// The list of names other files may import from this module.
export {
  WIDTH, HEIGHT, FULL, SHAPES, PIECES, COLOR, rotate, turn,
  emptyBoard, emptyPlanes, fits, lock, clearLines, shiftRow, PAD,
  newGame, step, hardDrop, tryMove, shapeOf, view, colorAt,
};
