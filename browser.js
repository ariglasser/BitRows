// =============================================================================
//  TETRIS IN THE BROWSER: drawing and controls
// =============================================================================
//
//  This file SHOWS the game in a web page and reads keys and buttons. The game
//  itself (board, pieces, rules) is in tetris-core.js: read that file first.
//
//  THE DOM
//  -------
//  When the browser reads index.html, it builds a tree of objects, one per
//  element on the page: the DOM ("Document Object Model"). JavaScript changes
//  the page by changing those objects. For example
//      element.textContent = '42'      shows the text 42 in it
//      element.className = 'cell c3'   gives it the classes cell and c3
//  and the browser redraws only what changed.
//
//  THE IDEA: DISPLAY MEMORY
//  ------------------------
//  Like writing to video memory on an old PC, we create the 200 board cells
//  ONCE, keep them in a list (our "display memory"), and from then on only
//  change the cells that changed. Nothing is ever rebuilt.
//
//  To find what changed, we keep a copy of what is on screen now (`shown`:
//  3 colour planes, see tetris-core.js) and compare it with the new picture,
//  row by row, using XOR:
//
//      a ^ b   XOR: bit is 1 when a and b DIFFER in that position.
//              0b1100 ^ 0b0110 = 0b1010
//
//  So (newRow ^ oldRow) has a 1 exactly on the cells that changed. If it is 0,
//  the row is unchanged and we skip it entirely. AND answers "does it fit?";
//  XOR answers "what changed?".
// =============================================================================

import {
  WIDTH, HEIGHT, PIECES, COLOR, emptyPlanes,
  newGame, step, hardDrop, tryMove, view, colorAt,
} from './tetris-core.js';

// document.getElementById('board') finds the element with id="board" in
// index.html. We look each one up once and keep it.
const boardEl = document.getElementById('board');
const rownumsEl = document.getElementById('rownums');
const nextEl = document.getElementById('next');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const messageEl = document.getElementById('message');


// -----------------------------------------------------------------------------
//  BUILD THE PAGE ONCE
// -----------------------------------------------------------------------------

// makeElements: create `count` new <div> elements inside `parent`, give each
// the class(es) in `className`, and return them as a list.
//   document.createElement('div')  makes a new element (not on the page yet)
//   parent.append(el)              puts it on the page, inside parent
// Array.from({ length: count }, f) makes a list of `count` items by calling f.
const makeElements = (parent, count, className) =>
  Array.from({ length: count }, () => {
    const el = document.createElement('div');
    el.className = className;
    parent.append(el);
    return el;
  });

// The board's 200 cells, all empty (c0), in a flat list:
// row r, column c is cells[r * 10 + c].
const cells = makeElements(boardEl, WIDTH * HEIGHT, 'cell c0');

// The 16 cells of the "next piece" box.
const nextCells = makeElements(nextEl, 16, 'cell c0');

// The 20 row-number labels. Every row starts empty, so every label starts
// at 0. (render only touches rows that CHANGE, so a row that stays empty
// would otherwise never get its 0.)
const rownums = makeElements(rownumsEl, HEIGHT, 'rownum');
rownums.forEach((el) => { el.textContent = 0; });

// What is on screen right now, as 3 colour planes. At the start: all empty.
let shown = emptyPlanes();

// The last values we wrote, so we only touch the page when they change.
// (Writing the same text again would be harmless, but the point here is to
// touch the page only when something really changed.)
const last = { score: null, lines: null, level: null, next: null, message: null };
const lastRowNum = new Array(HEIGHT).fill(0); // matches the 0s written above


// -----------------------------------------------------------------------------
//  RENDER: update only what changed
// -----------------------------------------------------------------------------

// setText: change an element's text only if it is different.
// `key` names the remembered value in `last`.
function setText(el, key, value) {
  if (last[key] === value) return;
  last[key] = value;
  el.textContent = value;
}

function render(game) {
  // The new picture: board plus falling piece, as 3 colour planes.
  const planes = view(game);

  for (let r = 0; r < HEIGHT; r++) {
    // Which cells of row r changed? XOR each plane with what is shown, and OR
    // the 3 results: a cell changed if ANY of its 3 colour bits changed.
    const changed = (planes[0][r] ^ shown[0][r])
                  | (planes[1][r] ^ shown[1][r])
                  | (planes[2][r] ^ shown[2][r]);
    if (changed === 0) continue; // nothing changed in this row: skip it

    for (let c = 0; c < WIDTH; c++) {
      const bit = 1 << (WIDTH - 1 - c); // column 0 = 512 ... column 9 = 1
      if (changed & bit) {
        // Only this cell changed. Give it the class of its new colour:
        // 'cell c0' for empty, 'cell c3' for a T block, and so on.
        cells[r * WIDTH + c].className = 'cell c' + colorAt(planes, r, bit);
      }
    }

    // The row number shown next to the board: which cells are full.
    const full = planes[0][r] | planes[1][r] | planes[2][r];
    if (lastRowNum[r] !== full) {
      lastRowNum[r] = full;
      rownums[r].textContent = full;
    }
  }
  shown = planes; // the screen now shows this picture

  // The next piece: redraw its 16 small cells only when it changes.
  if (last.next !== game.next) {
    last.next = game.next;
    const shape = PIECES[game.next][0];
    const color = COLOR[game.next];
    nextCells.forEach((el, i) => {
      // Cell i of the 4x4 box is row (i / 4, rounded down), column (i % 4).
      // 8 >> column is that column's bit in a 4-bit piece row.
      const on = shape[Math.floor(i / 4)] & (8 >> (i % 4));
      el.className = 'cell c' + (on ? color : 0);
    });
  }

  setText(scoreEl, 'score', game.score);
  setText(linesEl, 'lines', game.lines);
  setText(levelEl, 'level', game.level);

  // The message box: shown when paused or game over, hidden otherwise.
  const message = game.over ? 'GAME OVER - tap to play again'
                : game.paused ? 'PAUSED'
                : '';
  if (last.message !== message) {
    last.message = message;
    messageEl.textContent = message;
    messageEl.hidden = message === ''; // `hidden` removes it from view
  }
}


// -----------------------------------------------------------------------------
//  TIME AND CONTROLS
// -----------------------------------------------------------------------------

let game = newGame();
let timer = null; // the gravity timer

// setTimeout(f, ms) asks the browser: "call f once, ms milliseconds from now".
// Each gravity tick sets up the next one, so the piece keeps falling.
// Level 1: 800 ms between ticks; each level 70 ms faster, never below 80 ms.
const speed = () => Math.max(80, 800 - (game.level - 1) * 70);

const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(tick, speed());
};

const tick = () => {
  if (!game.paused && !game.over) step(game); // gravity: one row down
  render(game);
  schedule();
};

// act: do one action, from a key or a button. The names match the buttons'
// data-action labels in index.html.
function act(action) {
  if (game.over) {
    // Any action after game over starts a new game.
    game = newGame();
    render(game);
    schedule();
    return;
  }
  if (action === 'pause') {
    game.paused = !game.paused; // flip true <-> false
    render(game);
    return;
  }
  if (game.paused) return; // ignore moves while paused

  switch (action) {
    case 'left': tryMove(game, -1, 0); break;
    case 'right': tryMove(game, 1, 0); break;
    case 'rotate': tryMove(game, 0, 0, 1); break;
    case 'down': if (tryMove(game, 0, 1)) game.score += 1; break;
    case 'drop': hardDrop(game); schedule(); break;
  }
  render(game);
}

// KEYBOARD: which key does what. e.key is the key's name, like 'ArrowLeft'.
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down',
  ' ': 'drop', p: 'pause', P: 'pause',
};

// addEventListener('keydown', f): "every time a key goes down, call f".
document.addEventListener('keydown', (e) => {
  const action = KEYS[e.key];
  if (!action) return;  // not one of our keys: let the browser handle it
  e.preventDefault();   // stop arrows and space from scrolling the page
  act(action);
});

// BUTTONS: one listener for all of them. e.target.closest('button') finds the
// button that was touched (even if the touch landed on its symbol).
// 'pointerdown' fires as soon as a finger or mouse goes down: quicker than
// 'click', which waits for the finger to lift.
document.querySelector('.pad').addEventListener('pointerdown', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  e.preventDefault();
  act(button.dataset.action); // dataset.action reads data-action="..."
});

// Tapping the "game over" message also starts a new game.
messageEl.addEventListener('pointerdown', () => act('restart'));

// Pause by itself when you switch to another tab or app.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !game.over && !game.paused) {
    game.paused = true;
    render(game);
  }
});

render(game); // the first picture
schedule();   // start gravity
