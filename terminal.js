#!/usr/bin/env node
// ^ The line above is called a "shebang". On Linux/macOS/Termux it lets you
//   run this file directly as `./terminal.js` (after `chmod +x terminal.js`).
//   It tells the system: "run this file with the program called node".
//   JavaScript itself ignores it.

// =============================================================================
//  BIT ROWS IN THE TERMINAL
// =============================================================================
//
//  This file only SHOWS the game in a terminal (a text window) and reads the
//  keyboard. The game itself (board, pieces, rules) is in core.js:
//  read that file first.
//
//  Start it with:   node terminal.js     (or: npm start)
// =============================================================================

// import: take these names from the module core.js (./ means "in this
// same folder"). `* as T` would take all of them; here we list what we use.
import {
  WIDTH, HEIGHT, PIECES, newGame, step, hardDrop, tryMove, view, colorAt,
} from './core.js';

// =============================================================================
//  DRAWING WITH TEXT
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

// Terminal colour codes for the colour numbers 0..7 from core.js
// (index 0 = empty cell, unused). 36 = cyan for the I, 33 = yellow for the O...
const ANSI = [0, 36, 33, 35, 32, 31, 34, 37];

// render: draw the whole screen once.
function render(game) {
  // The board WITH the falling piece, as 3 colour planes (see PART 5 of
  // core.js).
  const planes = view(game);
  const nextShape = PIECES[game.next][0]; // the next piece, rotation 0

  // We build the picture as a list of text lines, then print them all at once.
  // `lines.push(x)` adds x to the end of the list.
  const lines = [];
  lines.push('  BIT ROWS');
  // '--'.repeat(9) makes '--' nine times. The + joins pieces of text.
  lines.push('  +' + '--'.repeat(WIDTH) + '+');

  for (let r = 0; r < HEIGHT; r++) {      // for each board row, top to bottom
    let s = '  |';                        // the text for this line, so far
    for (let c = 0; c < WIDTH; c++) {     // for each column, left to right
      // The bit for column c: column 0 is 1 << 8 = 256, column 8 is 1 << 0 = 1.
      const bit = 1 << (WIDTH - 1 - c);
      // The cell's colour number: 0 = empty, 1..7 = a block of that colour.
      const color = colorAt(planes, r, bit);
      // Text in `backticks` can include values with ${...}: here we wrap
      // '[]' in the colour code and the "normal colour" code.
      if (color) s += `${ESC}${ANSI[color]}m[]${ESC}0m`;
      else s += ' .';
    }
    s += '|';

    // To the right of each row, show the row's NUMBER, so you can watch the
    // algorithm work: the 3 planes OR'ed together = which cells are full,
    // piece included. padStart(4) adds spaces in front so all numbers line up
    // (e.g. '  48', ' 511').
    const full = planes[0][r] | planes[1][r] | planes[2][r];
    s += ' ' + String(full).padStart(4);

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
    console.error('Run this in a terminal: node terminal.js');
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

// Start the game.
run();
