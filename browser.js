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
                : game.paused ? 'PAUSED - tap to continue'
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

// THE PAUSE BUTTON. 'pointerdown' fires as soon as a finger or mouse goes
// down: quicker than 'click', which waits for the finger to lift.
// stopPropagation keeps this touch from ALSO counting as a gesture below.
const pauseButton = document.getElementById('pause');
pauseButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  act('pause');
});


// -----------------------------------------------------------------------------
//  TOUCH GESTURES (phone and tablet; they also work with a mouse)
// -----------------------------------------------------------------------------
//
//   drag left / right   the piece follows the finger, one column for every
//                       cell-width the finger travels
//   drag down           one row down for every cell-height (soft drop)
//   flick down fast     hard drop
//   tap                 rotate (or: continue when paused, new game after
//                       game over)
//
//  The finger can be ANYWHERE on the page, not only on the piece: the
//  listeners below are on `document` (the whole page), and only the finger's
//  MOVEMENT matters, not where it started.
//
//  POINTER EVENTS
//  The browser reports a finger (or mouse, or pen) as a "pointer":
//    pointerdown   the finger touches the screen
//    pointermove   it moves (fires many times per second)
//    pointerup     it lifts
//  Each event has e.clientX, e.clientY: the finger's position in pixels from
//  the top-left of the window (y grows downwards, like our board rows).
//
//  THE IDEA
//  We remember an ANCHOR point. Whenever the finger is a whole cell away from
//  the anchor, we move the piece one step and move the anchor one cell along.
//  So a slow drag moves the piece cell by cell, exactly under the finger.
//
//  AXIS LOCK: once a drag has clearly gone sideways or down, the other
//  direction is ignored until the finger lifts. Without this, a drag down
//  that wobbles a little would also nudge the piece left or right.
// -----------------------------------------------------------------------------

const TAP_MOVE = 10;       // a touch that moves less than 10 px is a tap
const TAP_TIME = 250;      // ...and lasts less than 250 ms
const FLICK_SPEED = 1.2;   // px per ms: a downward flick faster than this drops

// The state of the finger currently on the screen (null when none).
let touch = null;

// cellSize: the width of one board cell on screen, in pixels, measured now
// (it depends on the screen size). getBoundingClientRect() gives an
// element's position and size.
const cellSize = () => cells[0].getBoundingClientRect().width;

document.addEventListener('pointerdown', (e) => {
  // e.isPrimary is false for a second finger: we follow only the first one.
  if (!e.isPrimary) return;
  touch = {
    startX: e.clientX, startY: e.clientY, // where the finger came down
    anchorX: e.clientX, anchorY: e.clientY,
    startTime: e.timeStamp,               // when (in ms)
    axis: null,                           // 'x' or 'y' once the drag is locked
    moved: false,                         // did the piece move in this drag?
  };
});

document.addEventListener('pointermove', (e) => {
  if (!touch || !e.isPrimary || game.over || game.paused) return;
  const size = cellSize();
  const dx = e.clientX - touch.anchorX; // how far from the anchor
  const dy = e.clientY - touch.anchorY;

  // Lock the axis on the first clear movement (half a cell).
  // Math.abs gives the size of a number without its sign: Math.abs(-5) = 5.
  if (!touch.axis) {
    if (Math.abs(dx) > size / 2 && Math.abs(dx) > Math.abs(dy)) touch.axis = 'x';
    else if (dy > size / 2) touch.axis = 'y';
    else return; // not clear yet
  }

  let changed = false;
  if (touch.axis === 'x') {
    // One step for each whole cell; the anchor follows so the next step needs
    // another whole cell. dx can pass several cells in one event, hence `while`.
    while (e.clientX - touch.anchorX >= size) {
      tryMove(game, 1, 0);
      touch.anchorX += size;
      changed = true;
    }
    while (touch.anchorX - e.clientX >= size) {
      tryMove(game, -1, 0);
      touch.anchorX -= size;
      changed = true;
    }
  } else {
    while (e.clientY - touch.anchorY >= size) {
      if (tryMove(game, 0, 1)) game.score += 1; // soft drop: 1 point per row
      touch.anchorY += size;
      changed = true;
    }
  }
  if (changed) {
    touch.moved = true;
    render(game);
  }
});

document.addEventListener('pointerup', (e) => {
  if (!touch || !e.isPrimary) return;
  const t = touch;
  touch = null;

  const dx = e.clientX - t.startX;
  const dy = e.clientY - t.startY;
  const time = e.timeStamp - t.startTime;

  // A TAP: short and almost no movement.
  if (Math.abs(dx) < TAP_MOVE && Math.abs(dy) < TAP_MOVE && time < TAP_TIME) {
    if (game.over) act('restart');        // new game
    else if (game.paused) act('pause');   // continue
    else act('rotate');
    return;
  }

  // A FLICK: a fast downward drag drops the piece. Speed = distance / time.
  if (t.axis === 'y' && dy / time > FLICK_SPEED && dy > 2 * cellSize()) {
    act('drop');
  }
});

// If the browser takes the touch away (for example a system gesture), forget it.
document.addEventListener('pointercancel', () => { touch = null; });

// Pause by itself when you switch to another tab or app.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !game.over && !game.paused) {
    game.paused = true;
    render(game);
  }
});

render(game); // the first picture
schedule();   // start gravity


// -----------------------------------------------------------------------------
//  INSTALLABLE APP: register the service worker (see sw.js)
// -----------------------------------------------------------------------------
// 'serviceWorker' in navigator: does this browser support service workers?
// register() returns a promise; .catch ignores failures, for example when
// the page is opened somewhere that doesn't allow service workers. The game
// works the same without one, just not offline.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
