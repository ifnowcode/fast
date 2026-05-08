const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const passBtn = document.getElementById('passBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

const BOARD_SIZE = 9;
const PADDING = 40;
const GRID_SIZE = (canvas.width - 2 * PADDING) / (BOARD_SIZE - 1);
const STONE_RADIUS = GRID_SIZE * 0.45;

const EMPTY = 0;
const BLACK = 1; // human
const WHITE = 2; // AI

let board;
let currentPlayer;
let lastBoardHash = null;
let consecutivePasses = 0;

function initGame() {
  board = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(EMPTY)
  );
  currentPlayer = BLACK;
  lastBoardHash = null;
  consecutivePasses = 0;
  drawBoard();
  updateStatus();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c9a26b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = PADDING + i * GRID_SIZE;
    const y = PADDING + i * GRID_SIZE;

    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(canvas.width - PADDING, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, PADDING);
    ctx.lineTo(x, canvas.height - PADDING);
    ctx.stroke();
  }

  if (BOARD_SIZE === 9) {
    const stars = [
      [2, 2], [2, 6],
      [6, 2], [6, 6],
      [4, 4]
    ];
    ctx.fillStyle = '#000';
    for (const [r, c] of stars) {
      const { x, y } = coordToPixel(r, c);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c]);
      }
    }
  }
}

function coordToPixel(row, col) {
  return {
    x: PADDING + col * GRID_SIZE,
    y: PADDING + row * GRID_SIZE
  };
}

function pixelToCoord(x, y) {
  const col = Math.round((x - PADDING) / GRID_SIZE);
  const row = Math.round((y - PADDING) / GRID_SIZE);
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE)
    return null;

  const { x: gx, y: gy } = coordToPixel(row, col);
  const dx = x - gx;
  const dy = y - gy;
  if (Math.sqrt(dx * dx + dy * dy) > GRID_SIZE * 0.5) return null;

  return { row, col };
}

function drawStone(row, col, color) {
  const { x, y } = coordToPixel(row, col);
  ctx.beginPath();
  ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color === BLACK ? '#111' : '#eee';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function neighbors(row, col) {
  const res = [];
  if (row > 0) res.push([row - 1, col]);
  if (row < BOARD_SIZE - 1) res.push([row + 1, col]);
  if (col > 0) res.push([row, col - 1]);
  if (col < BOARD_SIZE - 1) res.push([row, col + 1]);
  return res;
}

function cloneBoard(b) {
  return b.map(row => row.slice());
}

function boardHash(b) {
  return b.map(row => row.join('')).join('|');
}

function getGroupAndLiberties(b, row, col) {
  const color = b[row][col];
  const visited = new Set();
  const group = [];
  let liberties = 0;

  const stack = [[row, col]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const key = r + ',' + c;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push([r, c]);

    for (const [nr, nc] of neighbors(r, c)) {
      if (b[nr][nc] === EMPTY) {
        liberties++;
      } else if (b[nr][nc] === color) {
        stack.push([nr, nc]);
      }
    }
  }

  return { group, liberties };
}

function removeGroup(b, group) {
  for (const [r, c] of group) {
    b[r][c] = EMPTY;
  }
}

function applyMove(row, col, color, b) {
  const newBoard = cloneBoard(b);
  newBoard[row][col] = color;

  const opponent = color === BLACK ? WHITE : BLACK;
  let totalCaptured = 0;

  for (const [nr, nc] of neighbors(row, col)) {
    if (newBoard[nr][nc] === opponent) {
      const { group, liberties } = getGroupAndLiberties(newBoard, nr, nc);
      if (liberties === 0) {
        totalCaptured += group.length;
        removeGroup(newBoard, group);
      }
    }
  }

  const { group, liberties } = getGroupAndLiberties(newBoard, row, col);
  if (liberties === 0 && totalCaptured === 0) {
    return null;
  }

  return { board: newBoard, captured: totalCaptured };
}

function handleClick(evt) {
  if (currentPlayer !== BLACK) return;
  if (consecutivePasses >= 2) return;

  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (canvas.height / rect.height);

  const coord = pixelToCoord(x, y);
  if (!coord) return;

  const { row, col } = coord;
  if (board[row][col] !== EMPTY) return;

  const result = applyMove(row, col, BLACK, board);
  if (!result) return;

  const newHash = boardHash(result.board);
  if (newHash === lastBoardHash) return;

  board = result.board;
  lastBoardHash = newHash;
  consecutivePasses = 0;
  currentPlayer = WHITE;

  drawBoard();
  updateStatus();

  setTimeout(aiMove, 300);
}

function aiMove() {
  if (consecutivePasses >= 2) return;

  let bestMoves = [];
  let bestCapture = 0;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== EMPTY) continue;

      const result = applyMove(r, c, WHITE, board);
      if (!result) continue;

      if (result.captured > bestCapture) {
        bestCapture = result.captured;
        bestMoves = [[r, c]];
      } else if (result.captured === bestCapture) {
        bestMoves.push([r, c]);
      }
    }
  }

  if (bestMoves.length === 0) {
    passTurn();
    drawBoard();
    return;
  }

  const [r, c] = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  const result = applyMove(r, c, WHITE, board);

  board = result.board;
  lastBoardHash = boardHash(board);
  consecutivePasses = 0;
  currentPlayer = BLACK;

  drawBoard();
  updateStatus();
}

function passTurn() {
  consecutivePasses++;
  if (consecutivePasses >= 2) {
    updateStatus(true);
    return;
  }
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  updateStatus();
}

function countScore() {
  let black = 0, white = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === BLACK) black++;
      if (board[r][c] === WHITE) white++;
    }
  }
  return { black, white };
}

function updateStatus(gameOver = false) {
  if (gameOver) {
    const { black, white } = countScore();
    let msg = `Game over. Stones — Black: ${black}, White: ${white}. `;
    if (black > white) msg += 'Black wins.';
    else if (white > black) msg += 'White wins.';
    else msg += 'Tie game.';
    statusEl.textContent = msg;
    return;
  }

  const playerText = currentPlayer === BLACK ? 'Your turn (Black)' : 'AI thinking (White)';
  statusEl.textContent = `${playerText}. Passes: ${consecutivePasses}`;
}

canvas.addEventListener('click', handleClick);
passBtn.addEventListener('click', () => {
  passTurn();
  drawBoard();
  if (currentPlayer === WHITE) setTimeout(aiMove, 300);
});
resetBtn.addEventListener('click', () => {
  initGame();
});

initGame();