export const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
]

export function checkWinner(cells) {
  for (const [a,b,c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]
  }
  return null
}

export function isBoardFull(cells) {
  return cells.every(c => c !== null)
}

export function createInitialState() {
  return {
    boards: Array(9).fill(null).map(() => Array(9).fill(null)),
    boardWinners: Array(9).fill(null),
    activeBoard: null,
    currentPlayer: 'X',
    gameWinner: null,
    winLine: null,
  }
}

export function getValidBoards(state) {
  if (state.activeBoard !== null) {
    if (!state.boardWinners[state.activeBoard] && !isBoardFull(state.boards[state.activeBoard])) {
      return [state.activeBoard]
    }
  }
  return state.boardWinners
    .map((w, i) => (!w && !isBoardFull(state.boards[i])) ? i : null)
    .filter(i => i !== null)
}

export function applyMove(state, boardIdx, cellIdx) {
  if (state.gameWinner) return state
  if (state.boardWinners[boardIdx]) return state
  if (state.boards[boardIdx][cellIdx]) return state

  const validBoards = getValidBoards(state)
  if (!validBoards.includes(boardIdx)) return state

  const newBoards = state.boards.map((b, i) =>
    i === boardIdx ? b.map((c, j) => j === cellIdx ? state.currentPlayer : c) : b
  )

  const newBoardWinners = [...state.boardWinners]
  const boardWinner = checkWinner(newBoards[boardIdx])
  if (boardWinner) newBoardWinners[boardIdx] = boardWinner
  else if (isBoardFull(newBoards[boardIdx])) newBoardWinners[boardIdx] = 'draw'

  const gameWinner = checkWinner(newBoardWinners)
  let winLine = null
  if (gameWinner) {
    for (const line of LINES) {
      if (newBoardWinners[line[0]] === gameWinner &&
          newBoardWinners[line[1]] === gameWinner &&
          newBoardWinners[line[2]] === gameWinner) {
        winLine = line
        break
      }
    }
  }

  const allDone = newBoardWinners.every(w => w !== null)

  let nextActive = cellIdx
  if (newBoardWinners[cellIdx] || isBoardFull(newBoards[cellIdx])) {
    nextActive = null
  }

  return {
    boards: newBoards,
    boardWinners: newBoardWinners,
    activeBoard: nextActive,
    currentPlayer: state.currentPlayer === 'X' ? 'O' : 'X',
    gameWinner: gameWinner || (allDone ? 'draw' : null),
    winLine,
  }
}

// ── AI ────────────────────────────────────────────────────────────────────────

function scoreBoard(winners, player) {
  const opp = player === 'X' ? 'O' : 'X'
  let score = 0
  for (const [a,b,c] of LINES) {
    const line = [winners[a], winners[b], winners[c]]
    const mine = line.filter(v => v === player).length
    const theirs = line.filter(v => v === opp).length
    if (theirs === 0) score += mine * mine * 10
    if (mine === 0) score -= theirs * theirs * 10
  }
  return score
}

function minimax(state, depth, alpha, beta, maximizing, aiPlayer) {
  const opp = aiPlayer === 'X' ? 'O' : 'X'
  if (state.gameWinner === aiPlayer) return 10000 + depth
  if (state.gameWinner === opp) return -10000 - depth
  if (state.gameWinner === 'draw') return 0
  if (depth === 0) return scoreBoard(state.boardWinners, aiPlayer)

  const validBoards = getValidBoards(state)
  let best = maximizing ? -Infinity : Infinity

  for (const bIdx of validBoards) {
    const cells = state.boards[bIdx]
    for (let cIdx = 0; cIdx < 9; cIdx++) {
      if (cells[cIdx]) continue
      const next = applyMove(state, bIdx, cIdx)
      const score = minimax(next, depth - 1, alpha, beta, !maximizing, aiPlayer)
      if (maximizing) {
        best = Math.max(best, score)
        alpha = Math.max(alpha, score)
      } else {
        best = Math.min(best, score)
        beta = Math.min(beta, score)
      }
      if (beta <= alpha) return best
    }
  }
  return best
}

export function getAIMove(state, difficulty) {
  const validBoards = getValidBoards(state)
  const moves = []
  for (const bIdx of validBoards) {
    for (let cIdx = 0; cIdx < 9; cIdx++) {
      if (!state.boards[bIdx][cIdx]) moves.push([bIdx, cIdx])
    }
  }
  if (!moves.length) return null

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  const depth = difficulty === 'hard' ? 5 : 3
  let bestScore = -Infinity
  let bestMove = moves[0]

  for (const [bIdx, cIdx] of moves) {
    const next = applyMove(state, bIdx, cIdx)
    const score = minimax(next, depth - 1, -Infinity, Infinity, false, state.currentPlayer)
    if (score > bestScore) {
      bestScore = score
      bestMove = [bIdx, cIdx]
    }
  }
  return bestMove
}
